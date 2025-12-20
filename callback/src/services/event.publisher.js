const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'callback-service',
    brokers: [process.env.KAFKA_BROKERS || 'kafka:9093']
});

const producer = kafka.producer();

async function init() {
    await producer.connect();
    console.log('Kafka producer connected');
}

async function publishCallbackEvent(event) {
    await producer.send({
        topic: 'aggregator-callbacks',
        messages: [
            {
                key: event.user_id?.toString() || 'unknown',
                value: JSON.stringify(event),
                timestamp: Date.now().toString()
            }
        ]
    });

    // Also publish bet events to bet-events topic for bet resolver
    if (event.type === 'bet') {
        await producer.send({
            topic: 'bet-events',
            messages: [
                {
                    key: event.user_id?.toString() || 'unknown',
                    value: JSON.stringify({
                        event_type: 'bet_pending',
                        user_id: event.user_id,
                        bet_round_id: event.bet_round_id,
                        amount: event.amount,
                        timestamp: new Date().toISOString()
                    }),
                    timestamp: Date.now().toString()
                }
            ]
        });
    }
}

module.exports = { init, publishCallbackEvent };