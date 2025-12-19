const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { placeBet } = require('./aggregator.client');
const { publishBetEvent } = require('./event.publisher');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

async function getUserBalance(userId) {
    const balance = await redis.get(`balance:${userId}`);
    return parseFloat(balance || 0);
}

async function updateProjectedBalance(userId, amount) {
    await redis.incrbyfloat(`balance:${userId}`, -Math.abs(amount));
}

async function processBet(userId, amount, gameData) {
    const betRoundId = uuidv4();
    const currentBalance = await getUserBalance(userId);

    if (currentBalance < amount) {
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

    return {
        bet_round_id: betRoundId,
        balance: newBalance,
        status: 'pending'
    };
}

module.exports = { processBet, getUserBalance };
