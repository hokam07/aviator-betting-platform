const client = require('../cassandra/client');
const crypto = require('crypto');
const Decimal = require('decimal.js');
const redis = require('../services/redis.client');
const { syncBalanceToRedis } = require('../services/balance.sync');
const { incUserStatsInRedis } = require('../services/stats.sync');

const GET_USER = 'SELECT balance, pending_debits, version FROM users WHERE user_id = ?';
const UPDATE_BALANCE_CONDITIONAL = `
  UPDATE users 
  SET balance = ?, pending_debits = ?, version = version + 1 
  WHERE user_id = ?
  IF version = ?
`;

const INSERT_USER = `
  INSERT INTO users(user_id, balance, pending_debits, version, created_at, last_activity)
  VALUES(?, ?, ?, 0, toTimestamp(now()), toTimestamp(now()))
  IF NOT EXISTS
`;


const INSERT_TXN = `
  INSERT INTO ledger_transactions(
        user_id, date_bucket, tx_id, amount, direction, status,
        bet_round_id, external_tx_id, event_type, provider,
        created_at
    ) VALUES(
    ?, ?, now(), ?, ?, ?,
    ?, ?, ?, ?,
        toTimestamp(now())
    )
        `;

const CHECK_IDEMPOTENCY = 'SELECT processed_at FROM callback_idempotency WHERE provider = ? AND external_tx_id = ?';
const MARK_IDEMPOTENT = `
  INSERT INTO callback_idempotency(
            provider, external_tx_id, processed_at, payload_hash, user_id, bet_round_id
        ) VALUES(?, ?, toTimestamp(now()), ?, ?, ?)
            `;

const CONFIRM_PENDING_DEBIT = `
  UPDATE ledger_transactions 
  SET status = 'CONFIRMED', external_tx_id = ?
    WHERE user_id = ? AND date_bucket = ? AND tx_id = ?
        IF status = 'PENDING'
            `;

const INC_STATS_BET = 'UPDATE user_stats SET total_bet_count = total_bet_count + 1, total_wagered_amount_cents = total_wagered_amount_cents + ? WHERE user_id = ?';
const INC_STATS_WIN = 'UPDATE user_stats SET total_win_count = total_win_count + 1, total_won_amount_cents = total_won_amount_cents + ? WHERE user_id = ?';
const INC_STATS_LOSS = 'UPDATE user_stats SET total_loss_count = total_loss_count + 1 WHERE user_id = ?';

async function getUserBalance(userId) {
    // Ensure userId is a valid UUID string
    const uuidStr = typeof userId === 'string' ? userId : userId.toString();
    const result = await client.execute(GET_USER, [uuidStr], { prepare: true });
    return result.first() || { balance: 0, pending_debits: 0, version: -1 };
}

async function pendingDebit(userId, amount, betRoundId, dateBucket) {
    // Validate and normalize amount to 2 decimal places
    const normalizedAmount = parseFloat(amount).toFixed(2);
    if (isNaN(normalizedAmount) || normalizedAmount < 0) {
        throw new Error(`Invalid amount: ${amount} `);
    }

    const user = await getUserBalance(userId);

    // Conditional update with optimistic lock
    const newBalance = user.balance; // not changing confirmed balance yet
    const newPending = (user.pending_debits || 0) + parseFloat(normalizedAmount);

    const result = await client.execute(UPDATE_BALANCE_CONDITIONAL, [
        newBalance, newPending, userId, user.version
    ], { prepare: true });

    if (!result.wasApplied()) {
        throw new Error('Balance update conflict - retry');
    }

    // Insert pending txn
    await client.execute(INSERT_TXN, [
        userId, dateBucket, normalizedAmount, 'DEBIT', 'PENDING',
        betRoundId, null, 'bet', 'aviator-aggregator'
    ], { prepare: true });

    return true;
}

async function processCallbackEvent(event) {
    const {
        type, user_id, bet_round_id, amount, external_tx_id,
        provider = 'aviator-aggregator', payload
    } = event;

    // Validate and normalize amount to 2 decimal places
    const normalizedAmount = parseFloat(amount).toFixed(2);
    if (isNaN(normalizedAmount) || normalizedAmount < 0) {
        console.error(`[ERROR] Invalid amount: ${amount} `);
        throw new Error(`Invalid amount: ${amount} `);
    }

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const dateBucket = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Idempotency check
    const idempCheck = await client.execute(CHECK_IDEMPOTENCY, [provider, external_tx_id], { prepare: true });
    if (idempCheck.rowLength > 0) {
        console.log(`Duplicate callback ignored: ${external_tx_id} `);
        return { status: 'duplicate' };
    }

    const user = await getUserBalance(user_id);

    let applied = false;
    switch (type) {
        case 'bet': {
            // Deduct balance for bet
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2)).minus(normalizedAmount);
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));

            if (newBalance.lessThan(0)) {
                console.warn(`Insufficient balance for bet: ${user_id} `);
                return { applied: false, error: 'Insufficient balance' };
            }

            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, normalizedAmount, 'DEBIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'bet', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });

                // Update Stats
                const amountCents = Math.round(parseFloat(normalizedAmount) * 100);
                await client.execute(INC_STATS_BET, [amountCents, user_id], { prepare: true });
                await incUserStatsInRedis(user_id, { bet: true, bet_cents: amountCents });

                // Publish Bet to Public Feed
                await redis.publish('public_feed', JSON.stringify({
                    type: 'bet',
                    user_id: user_id,
                    amount: parseFloat(new Decimal(normalizedAmount).toString()),
                    timestamp: new Date().toISOString()
                }));
            }
            break;
        }

        case 'win': {
            // Credit balance for win (only if bet exists)
            // TODO: Add check to verify bet_round_id exists
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2)).plus(normalizedAmount);
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, normalizedAmount, 'CREDIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'win', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });

                // Update Stats
                const amountCents = Math.round(parseFloat(normalizedAmount) * 100);
                await client.execute(INC_STATS_WIN, [amountCents, user_id], { prepare: true });
                await incUserStatsInRedis(user_id, { win: true, win_cents: amountCents });

                // Publish Win to Public Feed
                await redis.publish('public_feed', JSON.stringify({
                    type: 'win',
                    user_id: user_id,
                    amount: parseFloat(new Decimal(normalizedAmount).toString()),
                    timestamp: new Date().toISOString()
                }));
            }
            break;
        }

        case 'loss': {
            // Just mark as loss, no balance change
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2));
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, normalizedAmount, 'DEBIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'loss', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });

                // Update Stats
                await client.execute(INC_STATS_LOSS, [user_id], { prepare: true });
                await incUserStatsInRedis(user_id, { loss: true });
            }
            break;
        }

        case 'rollback-bet': {
            // Rollback bet - credit back the bet amount
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2)).plus(normalizedAmount);
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, normalizedAmount, 'CREDIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'rollback-bet', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });
            }
            break;
        }

        case 'rollback-win': {
            // Rollback win - debit back the win amount
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2)).minus(normalizedAmount);
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, normalizedAmount, 'DEBIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'rollback-win', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });
            }
            break;
        }
    }

    return { applied, new_balance: applied ? (await getUserBalance(user_id)).balance : user.balance, user_id };
}

async function applyConditionalUpdate(userId, newBalance, newPending, expectedVersion) {
    // If user doesn't exist (version = -1), insert them first
    if (expectedVersion === -1) {
        const insertResult = await client.execute(INSERT_USER, [
            userId, newBalance, newPending
        ], { prepare: true });

        const applied = insertResult.wasApplied();

        // Sync balance to Redis if insert was successful
        if (applied) {
            await syncBalanceToRedis(userId, newBalance);
        }

        return applied;
    }

    // Otherwise, do conditional update
    const result = await client.execute(UPDATE_BALANCE_CONDITIONAL, [
        newBalance, newPending, userId, expectedVersion
    ], { prepare: true });

    const applied = result.wasApplied();

    // Sync balance to Redis if update was successful
    if (applied) {
        await syncBalanceToRedis(userId, newBalance);
    }

    return applied;
}

module.exports = {
    pendingDebit,
    processCallbackEvent,
    getUserBalance
};