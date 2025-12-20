const { Kafka } = require('kafkajs');
const { processCallbackEvent, pendingDebit, getUserBalance } = require('./repo/ledger.repo');
const { syncBalanceToRedis } = require('./services/balance.sync');

const kafkaClient = new Kafka({
    brokers: [process.env.KAFKA_BROKERS || 'kafka:9093']
});

const consumer = kafkaClient.consumer({ groupId: 'ledger-unified-group' });

async function main() {
    await consumer.connect();
    console.log('Unified Ledger Consumer connected');

    // Verify Cassandra connection
    try {
        const client = require('./cassandra/client');
        await client.execute('SELECT now() FROM system.local');
        console.log('Cassandra connection verified');
    } catch (err) {
        console.error('Cassandra connection failed:', err);
    }

    await consumer.subscribe({ topics: ['aggregator-callbacks', 'bet-events'], fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                const event = JSON.parse(message.value.toString());

                if (topic === 'aggregator-callbacks') {
                    console.log('Processing callback:', event.type, event.external_tx_id);
                    const result = await processCallbackEvent(event);
                    if (result.applied) {
                        console.log('Callback applied:', event.external_tx_id);
                    }
                } else if (topic === 'bet-events') {
                    if (event.type === 'bet_pending' || event.event_type === 'bet_pending') {
                        console.log('Processing bet_pending:', event.bet_round_id);
                        const dateBucket = new Date().toISOString().slice(0, 7);
                        await pendingDebit(
                            event.user_id,
                            event.amount,
                            event.bet_round_id,
                            dateBucket
                        );

                        // Sync balance to Redis
                        const user = await getUserBalance(event.user_id);
                        await syncBalanceToRedis(event.user_id, user.balance);
                        console.log('Bet pending recorded:', event.bet_round_id);
                    }
                }
            } catch (err) {
                console.error(`Error processing message from ${topic}:`, err);
            }
        }
    });

    console.log('Ledger worker running (Unified)...');
}

main().catch(console.error);

// Graceful Shutdown
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    try {
        await consumer.disconnect();
        console.log('Kafka consumer disconnected');

        const redis = require('./services/redis.client');
        await redis.quit();
        console.log('Redis client disconnected');

        const cassandraClient = require('./cassandra/client');
        await cassandraClient.shutdown();
        console.log('Cassandra client disconnected');

        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
});