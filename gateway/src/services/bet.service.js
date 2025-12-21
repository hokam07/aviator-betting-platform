const { redis } = require('../redis.client');
const cassandra = require('../cassandra/client');

async function getUserBalance(userId) {
    const balance = await redis.get(`balance:${userId}`);
    return parseFloat(balance || 0);
}

async function getUserStats(userId) {
    const key = `user_stats:${userId}`;

    // 1. Try Redis
    const cached = await redis.hgetall(key);
    if (cached && Object.keys(cached).length > 0) {
        return {
            total_bet_count: parseInt(cached.total_bet_count || 0),
            total_win_count: parseInt(cached.total_win_count || 0),
            total_loss_count: parseInt(cached.total_loss_count || 0),
            total_wagered_amount: parseFloat(cached.total_wagered_amount_cents || 0) / 100,
            total_won_amount: parseFloat(cached.total_won_amount_cents || 0) / 100
        };
    }

    // 2. Fallback to Cassandra
    console.log(`Cache miss for user_stats:${userId}, fetching from Cassandra...`);
    const query = 'SELECT * FROM user_stats WHERE user_id = ?';
    const result = await cassandra.execute(query, [userId], { prepare: true });
    const row = result.first();

    const stats = {
        total_bet_count: row ? parseInt(row.total_bet_count || 0) : 0,
        total_win_count: row ? parseInt(row.total_win_count || 0) : 0,
        total_loss_count: row ? parseInt(row.total_loss_count || 0) : 0,
        total_wagered_amount: row ? parseFloat(row.total_wagered_amount_cents || 0) / 100 : 0,
        total_won_amount: row ? parseFloat(row.total_won_amount_cents || 0) / 100 : 0
    };

    // 3. Populate Cache
    if (row) {
        await redis.hset(key, {
            total_bet_count: stats.total_bet_count,
            total_win_count: stats.total_win_count,
            total_loss_count: stats.total_loss_count,
            total_wagered_amount_cents: Math.round(stats.total_wagered_amount * 100),
            total_won_amount_cents: Math.round(stats.total_won_amount * 100)
        });
        await redis.expire(key, 86400);
    }

    return stats;
}

module.exports = { getUserBalance, getUserStats };
