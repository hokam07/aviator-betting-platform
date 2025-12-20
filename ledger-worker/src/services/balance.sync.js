const Redis = require('ioredis');
const client = require('../cassandra/client');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

const GET_USER = 'SELECT balance, pending_debits, version FROM users WHERE user_id = ?';

async function syncBalanceToRedis(userId, balance = null) {
    try {
        let finalBalance;

        if (balance !== null) {
            // Use provided balance
            finalBalance = parseFloat(balance).toFixed(2);
        } else {
            // Query Cassandra directly to avoid circular dependency
            const result = await client.execute(GET_USER, [userId], { prepare: true });
            const user = result.first() || { balance: 0, pending_debits: 0, version: 0 };
            finalBalance = parseFloat(user.balance || 0).toFixed(2);
        }

        await redis.set(`balance:${userId}`, finalBalance);

        // Publish balance update for WebSocket clients
        await redis.publish('balance_updates', JSON.stringify({
            user_id: userId,
            balance: parseFloat(finalBalance),
            timestamp: new Date().toISOString()
        }));

        // Detect if this was a win (balance increase) - simpler heuristic for now
        // Ideally we pass event type, but balance.sync is generic. 
        // For now, let's rely on the worker to publish public wins explicitly if needed.
        // BUT, the task says update balance.sync. Let's do a best effort or move logic to ledger.repo.
        // BETTER APPROACH: Update ledger.repo.js to publish 'win' to 'public_feed' directly.
        // Balance sync is for USER private balance. Public feed is separate.

        console.log(`Balance synced for user ${userId}: ${finalBalance}`);
        return finalBalance;
    } catch (err) {
        console.error(`Failed to sync balance for user ${userId}:`, err);
        throw err;
    }
}

module.exports = { syncBalanceToRedis };
