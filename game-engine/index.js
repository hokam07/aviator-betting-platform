const { Redis } = require('ioredis');
const { Kafka } = require('kafkajs');
require('dotenv').config();

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9093').split(',');

const redis = new Redis(REDIS_URL);
const kafka = new Kafka({ clientId: 'game-engine', brokers: KAFKA_BROKERS });
const producer = kafka.producer();

const GAME_STATE = {
    WAITING: 'WAITING',
    FLYING: 'FLYING',
    CRASHED: 'CRASHED'
};

let currentRound = {
    id: null,
    status: GAME_STATE.WAITING,
    multiplier: 1.0,
    startTime: null,
    crashMultiplier: 0
};

/**
 * Generates a crash multiplier based on a house edge
 * Using a simple formula: 0.99 / (1 - X) where X is 0..1
 */
function generateCrashMultiplier() {
    const r = Math.random();
    // 3% instant crash (1.0x)
    if (r < 0.03) return 1.0;

    // Formula for long tail distribution
    const multiplier = 0.99 / (1 - Math.random());
    return Math.max(1.0, Math.min(1000, multiplier));
}

async function broadcastState() {
    await redis.publish('game_updates', JSON.stringify(currentRound));
}

async function gameLoop() {
    await producer.connect();
    console.log('🚀 Game Engine Started');

    while (true) {
        // 1. WAITING PHASE
        currentRound = {
            id: require('crypto').randomUUID(),
            status: GAME_STATE.WAITING,
            multiplier: 1.0,
            startTime: Date.now(),
            waitTime: 5000 // 5 seconds to bet
        };
        console.log(`[ROUND] ${currentRound.id} - Waiting for bets...`);

        let waitStarted = Date.now();
        while (Date.now() - waitStarted < 5000) {
            await broadcastState();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 2. FLYING PHASE
        currentRound.status = GAME_STATE.FLYING;
        currentRound.startTime = Date.now();
        currentRound.crashMultiplier = generateCrashMultiplier();
        console.log(`[ROUND] ${currentRound.id} - Flying! (Will crash at ${currentRound.crashMultiplier.toFixed(2)}x)`);

        while (currentRound.status === GAME_STATE.FLYING) {
            const elapsed = (Date.now() - currentRound.startTime) / 1000;
            // Exponential growth: 1.0 * e^(0.1 * t)
            currentRound.multiplier = Math.pow(Math.E, 0.1 * elapsed);

            if (currentRound.multiplier >= currentRound.crashMultiplier) {
                currentRound.multiplier = currentRound.crashMultiplier;
                currentRound.status = GAME_STATE.CRASHED;
            }

            await broadcastState();
            await new Promise(resolve => setTimeout(resolve, 100)); // 10Hz broadcast
        }

        // 3. CRASHED PHASE
        console.log(`[ROUND] ${currentRound.id} - CRASHED at ${currentRound.multiplier.toFixed(2)}x`);

        // Notify Kafka for settlement
        await producer.send({
            topic: 'game-results',
            messages: [{
                value: JSON.stringify({
                    roundId: currentRound.id,
                    crashMultiplier: currentRound.multiplier,
                    timestamp: Date.now()
                })
            }]
        });

        let crashStarted = Date.now();
        while (Date.now() - crashStarted < 3000) { // 3s pause at crash
            await broadcastState();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

gameLoop().catch(console.error);
