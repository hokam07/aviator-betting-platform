const client = require('../cassandra/client');
const { syncBalanceToRedis } = require('./balance.sync');

const GET_ALL_USERS = 'SELECT user_id, balance FROM users';

async function reconcileAllBalances() {
    console.log('Starting balance reconciliation...');

    const result = await client.execute(GET_ALL_USERS, [], { prepare: true });
    const users = result.rows;

    let synced = 0;
    let failed = 0;

    for (const user of users) {
        try {
            await syncBalanceToRedis(user.user_id, user.balance);
            synced++;
        } catch (err) {
            console.error(`Failed to sync balance for user ${user.user_id}:`, err.message);
            failed++;
        }
    }

    console.log(`Reconciliation complete: ${synced} synced, ${failed} failed`);
    return { synced, failed, total: users.length };
}

// Run reconciliation periodically
function startReconciliationScheduler(intervalMs = 300000) { // 5 minutes
    setInterval(async () => {
        try {
            await reconcileAllBalances();
        } catch (err) {
            console.error('Reconciliation error:', err);
        }
    }, intervalMs);

    console.log(`Reconciliation scheduler started (interval: ${intervalMs}ms)`);
}

module.exports = {
    reconcileAllBalances,
    startReconciliationScheduler
};
