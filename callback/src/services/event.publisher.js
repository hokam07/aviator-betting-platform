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
}

module.exports = { init, publishCallbackEvent };