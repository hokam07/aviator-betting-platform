const client = require('../cassandra/client');
const Decimal = require('decimal.js');

const GET_USER = 'SELECT balance, pending_debits, version FROM users WHERE user_id = ?';
const CREATE_USER = `
  INSERT INTO users (user_id, balance, pending_debits, version, created_at)
  VALUES (?, ?, ?, ?, toTimestamp(now()))
  IF NOT EXISTS
`;

async function initializeUserWallet(userId, initialBalance = 1000) {
    const normalizedBalance = parseFloat(initialBalance).toFixed(2);

    const result = await client.execute(CREATE_USER, [
        userId,
        normalizedBalance,
        0,
        0
    ], { prepare: true });

    if (result['[applied]']) {
        console.log(`Wallet initialized for user ${userId} with balance ${normalizedBalance}`);
        return { user_id: userId, balance: normalizedBalance, created: true };
    } else {
        console.log(`Wallet already exists for user ${userId}`);
        const existing = await getUserWallet(userId);
        return { ...existing, created: false };
    }
}

async function getUserWallet(userId) {
    const result = await client.execute(GET_USER, [userId], { prepare: true });
    const user = result.first();

    if (!user) {
        return null;
    }

    return {
        user_id: userId,
        balance: parseFloat(user.balance || 0).toFixed(2),
        pending_debits: parseFloat(user.pending_debits || 0).toFixed(2),
        version: user.version
    };
}

module.exports = {
    initializeUserWallet,
    getUserWallet
};
