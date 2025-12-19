require('dotenv').config();
const { Kafka } = require('kafkajs');
const { processCallbackEvent } = require('./repo/ledger.repo');
const { startBetEventsConsumer } = require('./consumer/bet.events.consumer');
const { syncBalanceToRedis } = require('./services/balance.sync');

const kafkaClient = new Kafka({
    brokers: [process.env.KAFKA_BROKERS]
});

const consumer = kafkaClient.consumer({ groupId: 'ledger-group' });

async function main() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'aggregator-callbacks', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                console.log('Processing event:', event.type, event.external_tx_id);
                const result = await processCallbackEvent(event);

                // Sync balance to Redis after successful processing
                if (result.applied && result.user_id) {
                    await syncBalanceToRedis(result.user_id).catch(err => {
                        console.error('Failed to sync balance to Redis:', err);
                    });
                }
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