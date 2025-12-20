require('dotenv').config();
const { Kafka } = require('kafkajs');
const { processCallbackEvent } = require('./repo/ledger.repo');
const { startBetEventsConsumer } = require('./consumer/bet.events.consumer');
console.log("KAFKA_BROKERS::::")
const kafkaClient = new Kafka({
    brokers: [process.env.KAFKA_BROKERS]
});

const consumer = kafkaClient.consumer({ groupId: 'ledger-group' });

async function main() {
    await consumer.connect();

    // Verify Cassandra connection
    try {
        const client = require('./cassandra/client');
        await client.execute('SELECT now() FROM system.local');
        console.log('Cassandra query test passed');
    } catch (err) {
        console.error('Cassandra query test failed', err);
    }

    await consumer.subscribe({ topic: 'aggregator-callbacks', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                console.log('Processing event:', event.type, event.external_tx_id);

                const result = await processCallbackEvent(event);
                console.log('Result:', result);

                // Balance sync is already handled in applyConditionalUpdate
                // No need to sync again here to avoid redundant Redis calls
            } catch (err) {
                console.error('Error processing event', err);
                // Don't requeue critical failures — log and alert
            }
        }
    });

    console.log('Ledger worker running...');

    // Start bet events consumer
    await startBetEventsConsumer();
}

main().catch(console.error);