const client = require('../cassandra/client');
const crypto = require('crypto');
const Decimal = require('decimal.js');
const redis = require('../services/redis.client');
const { syncBalanceToRedis } = require('../services/balance.sync');
const { incUserStatsInRedis } = require('../services/stats.sync');
const { winsProcessed } = require('../metrics');

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

// Removed unused CONFIRM_PENDING_DEBIT query - pending debits are tracked but not currently confirmed
// The pending_debits field is incremented on bet placement but not decremented on resolution
// This is intentional as it tracks outstanding bets that haven't been resolved yet

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
    const normalizedAmount = new Decimal(parseFloat(amount).toFixed(2));
    if (normalizedAmount.isNaN() || normalizedAmount.lessThan(0)) {
        throw new Error(`Invalid amount: ${amount}`);
    }

    const user = await getUserBalance(userId);

    const newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2));
    const newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2)).plus(normalizedAmount);

    const applied = await applyConditionalUpdate(
        userId, newBalance.toString(), newPending.toString(), user.version
    );

    if (!applied) {
        throw new Error('Balance update conflict - retry');
    }

    // Insert pending txn
    await client.execute(INSERT_TXN, [
        userId, dateBucket, normalizedAmount.toString(), 'DEBIT', 'PENDING',
        betRoundId, null, 'bet', 'aviator-aggregator'
    ], { prepare: true });
    console.log(`[TRACE] Transaction inserted for user ${userId}`);

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
                try {
                    await incUserStatsInRedis(user_id, { bet: true, bet_cents: amountCents });
                } catch (statsErr) {
                    console.error(`Stats sync failed for user ${user_id}:`, statsErr);
                }

                // Stats updated above, balance synced to redis
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
                try {
                    await incUserStatsInRedis(user_id, { win: true, win_cents: amountCents });
                } catch (statsErr) {
                    console.error(`Stats sync failed for user ${user_id}:`, statsErr);
                }

                // Stats updated above, balance synced to redis
                winsProcessed.inc();
            }
            break;
        }

        case 'loss': {
            // Loss event: bet was already deducted when placed, just update stats
            // No balance change needed, no transaction needed (bet deduction already recorded)
            let newBalance = new Decimal(parseFloat(user.balance || 0).toFixed(2));
            let newPending = new Decimal(parseFloat(user.pending_debits || 0).toFixed(2));

            // Mark as applied to trigger idempotency and stats update
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );

            if (applied) {
                // Mark idempotent to prevent duplicate processing
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });

                // Update Stats only
                await client.execute(INC_STATS_LOSS, [user_id], { prepare: true });
                try {
                    await incUserStatsInRedis(user_id, { loss: true });
                } catch (statsErr) {
                    console.error(`Stats sync failed for user ${user_id}:`, statsErr);
                }
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