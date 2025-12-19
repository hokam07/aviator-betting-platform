const { Kafka } = require('kafkajs');

const kafka = new Kafka({
    clientId: 'gateway-service',
    brokers: [process.env.KAFKA_BROKERS || 'kafka:9092']
});

const producer = kafka.producer();

async function init() {
    await producer.connect();
    console.log('Gateway Kafka producer connected');
}

async function publishBetEvent(event) {
    await producer.send({
        topic: 'bet-events',
        messages: [
            {
                key: event.user_id?.toString() || 'unknown',
                value: JSON.stringify(event),
                timestamp: Date.now().toString()
            }
        ]
    });
}

module.exports = { init, publishBetEvent };
