const client = require('../cassandra/client');
const crypto = require('crypto');
const Decimal = require('decimal.js');

const GET_USER = 'SELECT balance, pending_debits, version FROM users WHERE user_id = ?';
const UPDATE_BALANCE_CONDITIONAL = `
  UPDATE users 
  SET balance = ?, pending_debits = ?, version = version + 1 
  WHERE user_id = ? 
  IF version = ?
`;

const INSERT_TXN = `
  INSERT INTO ledger_transactions (
    user_id, date_bucket, tx_id, amount, direction, status,
    bet_round_id, external_tx_id, event_type, provider,
    created_at
  ) VALUES (
    ?, ?, now(), ?, ?, ?,
    ?, ?, ?, ?,
    toTimestamp(now())
  )
`;

const CHECK_IDEMPOTENCY = 'SELECT processed_at FROM callback_idempotency WHERE provider = ? AND external_tx_id = ?';
const MARK_IDEMPOTENT = `
  INSERT INTO callback_idempotency (
    provider, external_tx_id, processed_at, payload_hash, user_id, bet_round_id
  ) VALUES (?, ?, toTimestamp(now()), ?, ?, ?)
`;

const CONFIRM_PENDING_DEBIT = `
  UPDATE ledger_transactions 
  SET status = 'CONFIRMED', external_tx_id = ?
  WHERE user_id = ? AND date_bucket = ? AND tx_id = ?
  IF status = 'PENDING'
`;

async function getUserBalance(userId) {
    const result = await client.execute(GET_USER, [userId], { prepare: true });
    return result.first() || { balance: 0, pending_debits: 0, version: 0 };
}

async function pendingDebit(userId, amount, betRoundId, dateBucket) {
    const user = await getUserBalance(userId);

    // Conditional update with optimistic lock
    const newBalance = user.balance; // not changing confirmed balance yet
    const newPending = (user.pending_debits || 0) + amount;

    const result = await client.execute(UPDATE_BALANCE_CONDITIONAL, [
        newBalance, newPending, userId, user.version
    ], { prepare: true });

    if (!result['[applied]']) {
        throw new Error('Balance update conflict - retry');
    }

    // Insert pending txn
    await client.execute(INSERT_TXN, [
        userId, dateBucket, amount, 'DEBIT', 'PENDING',
        betRoundId, null, 'bet', 'aviator-aggregator'
    ], { prepare: true });

    return true;
}

async function processCallbackEvent(event) {
    const {
        type, user_id, bet_round_id, amount, external_tx_id,
        provider = 'aviator-aggregator', payload
    } = event;

    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const dateBucket = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Idempotency check
    const idempCheck = await client.execute(CHECK_IDEMPOTENCY, [provider, external_tx_id], { prepare: true });
    if (idempCheck.rowLength > 0) {
        console.log(`Duplicate callback ignored: ${external_tx_id}`);
        return { status: 'duplicate' };
    }

    const user = await getUserBalance(user_id);

    let applied = false;
    switch (type) {
        case 'bet_confirmed': {
            // Confirm pending debit
            // In real: find the pending tx_id via query, here we assume one per round
            // For simplicity: just reduce pending_debits
            let newBalance = new Decimal(user.balance);
            let newPending = new Decimal(user.pending_debits || 0).minus(amount);
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });
            }
            break;
        }
        case 'win': {
            let newBalance = new Decimal(user.balance);
            let newPending = new Decimal(user.pending_debits || 0).plus(amount);
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, amount, 'CREDIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'win', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });
            }
            break;
        }

        case 'loss': {
            let newBalance = new Decimal(user.balance);
            let newPending = new Decimal(user.pending_debits || 0).minus(amount);
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            break;
        }

        case 'rollback': {
            // Refund pending debit
            let newBalance = new Decimal(user.balance).plus(amount);
            let newPending = new Decimal(user.pending_debits || 0).minus(amount);
            applied = await applyConditionalUpdate(
                user_id, newBalance.toString(), newPending.toString(), user.version
            );
            if (applied) {
                await client.execute(INSERT_TXN, [
                    user_id, dateBucket, amount, 'CREDIT', 'CONFIRMED',
                    bet_round_id, external_tx_id, 'rollback', provider
                ], { prepare: true });
                await client.execute(MARK_IDEMPOTENT, [provider, external_tx_id, payloadHash, user_id, bet_round_id], { prepare: true });
            }
            break;
        }
    }

    return { applied, new_balance: applied ? (await getUserBalance(user_id)).balance : user.balance };
}

async function applyConditionalUpdate(userId, newBalance, newPending, expectedVersion) {
    const result = await client.execute(UPDATE_BALANCE_CONDITIONAL, [
        newBalance, newPending, userId, expectedVersion
    ], { prepare: true });
    return result['[applied]'];
}

module.exports = {
    pendingDebit,
    processCallbackEvent,
    getUserBalance
};