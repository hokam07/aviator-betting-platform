const { Kafka } = require('kafkajs');
const { processCallbackEvent, getUserBalance } = require('./repo/ledger.repo');
const { syncBalanceToRedis } = require('./services/balance.sync');

const kafkaClient = new Kafka({
    brokers: [process.env.KAFKA_BROKERS || 'kafka:9093']
});

const consumer = kafkaClient.consumer({ groupId: 'ledger-unified-group' });
const producer = kafkaClient.producer();

async function main() {
    await consumer.connect();
    await producer.connect();
    console.log('Unified Ledger Consumer connected');
    console.log('Ledger Producer connected');

    // Verify Cassandra connection
    try {
        const client = require('./cassandra/client');
        await client.execute('SELECT now() FROM system.local');
        console.log('Cassandra connection verified');
    } catch (err) {
        console.error('Cassandra connection failed:', err);
    }

    // Only subscribe to aggregator-callbacks topic
    await consumer.subscribe({ topics: ['aggregator-callbacks'], fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                const event = JSON.parse(message.value.toString());

                console.log('Processing callback:', event.type, event.external_tx_id);
                const result = await processCallbackEvent(event);

                if (result.applied) {
                    console.log('Callback applied:', event.external_tx_id);

                    // If this was a 'bet' event, publish to bet-events topic for bet resolver
                    if (event.type === 'bet') {
                        await producer.send({
                            topic: 'bet-events',
                            messages: [
                                {
                                    key: event.user_id?.toString() || 'unknown',
                                    value: JSON.stringify({
                                        type: 'bet_pending',
                                        user_id: event.user_id,
                                        bet_round_id: event.bet_round_id,
                                        amount: event.amount,
                                        timestamp: new Date().toISOString()
                                    }),
                                    timestamp: Date.now().toString()
                                }
                            ]
                        });
                        console.log('Published bet_pending to bet-events for resolver:', event.bet_round_id);
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

        await producer.disconnect();
        console.log('Kafka producer disconnected');

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