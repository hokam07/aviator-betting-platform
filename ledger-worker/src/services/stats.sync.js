const redis = require('./redis.client');

/**
 * Syncs user stats to Redis for real-time dashboard tracking.
 * Uses HINCRBY to keep increments atomic in Redis too.
 */
async function incUserStatsInRedis(userId, metrics) {
    const key = `user_stats:${userId}`;
    const pipeline = redis.pipeline();

    if (metrics.bet) {
        pipeline.hincrby(key, 'total_bet_count', 1);
        pipeline.hincrby(key, 'total_wagered_amount_cents', metrics.bet_cents);
    }
    if (metrics.win) {
        pipeline.hincrby(key, 'total_win_count', 1);
        pipeline.hincrby(key, 'total_won_amount_cents', metrics.win_cents);
    }
    if (metrics.loss) {
        pipeline.hincrby(key, 'total_loss_count', 1);
    }

    // Reset TTL whenever stats are updated (keep hot for 24h)
    pipeline.expire(key, 86400);

    try {
        await pipeline.exec();
    } catch (err) {
        console.error(`Failed to sync stats to Redis for user ${userId}:`, err);
    }
}

module.exports = { incUserStatsInRedis };
