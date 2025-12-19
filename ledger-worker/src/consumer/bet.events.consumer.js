const { Kafka } = require('kafkajs');
const { pendingDebit } = require('../repo/ledger.repo');

const kafkaClient = new Kafka({
    brokers: [process.env.KAFKA_BROKERS]
});

const consumer = kafkaClient.consumer({ groupId: 'ledger-bet-group' });

async function startBetEventsConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'bet-events', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }) => {
            try {
                const event = JSON.parse(message.value.toString());
                console.log('Processing bet event:', event.type, event.bet_round_id);

                if (event.type === 'bet_pending') {
                    const dateBucket = new Date().toISOString().slice(0, 7);
                    await pendingDebit(
                        event.user_id,
                        event.amount,
                        event.bet_round_id,
                        dateBucket
                    );
                    console.log(`Pending debit recorded: ${event.bet_round_id}`);
                }
            } catch (err) {
                console.error('Error processing bet event:', err);
            }
        }
    });

    console.log('Bet events consumer running...');
}

module.exports = { startBetEventsConsumer };
