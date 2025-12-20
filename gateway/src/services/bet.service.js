const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { placeBet } = require('./aggregator.client');
const { publishBetEvent } = require('./event.publisher');
const cassandra = require('../cassandra/client');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

async function getUserBalance(userId) {
    const balance = await redis.get(`balance:${userId}`);
    return parseFloat(balance || 0);
}

async function updateProjectedBalance(userId, amount) {
    await redis.incrbyfloat(`balance:${userId}`, -Math.abs(amount));
}

async function processBet(userId, amount, gameData = {}) {
    console.log(`[BET] Processing bet for user ${userId}: ${amount}`);
    const betRoundId = uuidv4();
    const currentBalance = await getUserBalance(userId);

    if (currentBalance < amount) {
        console.warn(`[BET] Insufficient balance for user ${userId}: ${currentBalance} < ${amount}`);
        throw new Error('Insufficient balance');
    }

    // Optimistically update balance
    await updateProjectedBalance(userId, amount);
    const newBalance = currentBalance - amount;

    // Publish to Kafka for ledger processing
    await publishBetEvent({
        type: 'bet_pending',
        user_id: userId,
        bet_round_id: betRoundId,
        amount: parseFloat(amount).toFixed(2),
        game_data: gameData,
        timestamp: new Date().toISOString()
    });

    // Forward to aggregator (async, don't wait)
    placeBet({
        user_id: userId,
        bet_round_id: betRoundId,
        amount,
        game_data: gameData
    }).catch(err => {
        console.error('Aggregator forward failed:', err.message);
    });

    // Publish to public feed for live stats
    const safeMultiplier = (gameData && gameData.multiplier) || 1.0;

    redis.publish('public_feed', JSON.stringify({
        type: 'bet',
        user_id: userId,
        amount: parseFloat(amount),
        multiplier: safeMultiplier,
        timestamp: new Date().toISOString()
    })).catch(err => console.error('Redis publish failed:', err));

    return {
        bet_round_id: betRoundId,
        balance: newBalance,
        status: 'pending'
    };
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

module.exports = { processBet, getUserBalance, getUserStats };
