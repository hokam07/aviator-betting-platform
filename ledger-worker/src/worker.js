const { Kafka } = require('kafkajs');
const { processCallbackEvent } = require('./repo/ledger.repo');

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

    // Only subscribe to aggregator-callbacks topic
    await consumer.subscribe({ topics: ['aggregator-callbacks'], fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                console.log('Processing callback:', event.type, event.external_tx_id);
                await processCallbackEvent(event);
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