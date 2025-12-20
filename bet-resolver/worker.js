require('dotenv').config();
const { Kafka } = require('kafkajs');
const axios = require('axios');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:9093').split(',');
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://callback:3000/callback';

const kafka = new Kafka({
    clientId: 'bet-resolver',
    brokers: KAFKA_BROKERS,
    retry: {
        retries: 10,
        initialRetryTime: 300
    }
});

const consumer = kafka.consumer({ groupId: 'bet-resolver-group' });

/**
 * Bet Resolver Worker
 * Consumes bet events from Kafka and simulates game outcomes
 */
class BetResolver {
    constructor() {
        this.winRate = 0.45; // 45% win chance
        this.multiplier = 2.0; // 2x payout on win
    }

    async start() {
        await consumer.connect();
        await consumer.subscribe({ topic: 'bet-events', fromBeginning: false });

        console.log('🎰 Bet Resolver Worker running...');
        console.log(`📊 Win Rate: ${this.winRate * 100}% | Multiplier: ${this.multiplier}x`);

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const event = JSON.parse(message.value.toString());

                    // Only process bet_pending events
                    if (event.event_type === 'bet_pending') {
                        await this.resolveBet(event);
                    }
                } catch (error) {
                    console.error('Error processing bet event:', error.message);
                }
            }
        });
    }

    async resolveBet(betEvent) {
        const { user_id, bet_round_id, amount } = betEvent;

        console.log(`🎲 Resolving bet: ${bet_round_id.slice(0, 8)}... for user ${user_id.slice(0, 8)}... amount: $${amount}`);

        const didWin = Math.random() < this.winRate;

        try {
            if (didWin) {
                // Send WIN callback
                const winAmount = amount * this.multiplier;
                await axios.post(CALLBACK_URL, {
                    type: 'win',
                    external_tx_id: `${bet_round_id}-win`,
                    user_id: user_id,
                    bet_round_id: bet_round_id,
                    amount: winAmount,
                    provider: 'mock-game'
                }, {
                    headers: { 'x-signature': 'dummy' },
                    timeout: 5000
                });

                console.log(`✅ WIN: User ${user_id.slice(0, 8)}... won $${winAmount.toFixed(2)} (${this.multiplier}x)`);
            } else {
                // Send LOSS callback
                await axios.post(CALLBACK_URL, {
                    type: 'loss',
                    external_tx_id: `${bet_round_id}-loss`,
                    user_id: user_id,
                    bet_round_id: bet_round_id,
                    amount: amount,
                    provider: 'mock-game'
                }, {
                    headers: { 'x-signature': 'dummy' },
                    timeout: 5000
                });

                console.log(`❌ LOSS: User ${user_id.slice(0, 8)}... lost $${amount.toFixed(2)}`);
            }
        } catch (error) {
            console.error(`❗ Error sending callback for bet ${bet_round_id}:`, error.message);
        }
    }
}

// Start the resolver
const resolver = new BetResolver();
resolver.start().catch(err => {
    console.error('Failed to start bet resolver:', err);
    process.exit(1);
});

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down bet resolver...`);
    try {
        await consumer.disconnect();
        console.log('Kafka consumer disconnected');
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
