// src/metrics.js
const client = require('prom-client');

// Collect default Node.js metrics (CPU, memory, GC, event loop, etc.)
client.collectDefaultMetrics();

// Custom counters (customize per service)
const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
});

const kafkaMessagesProcessed = new client.Counter({
    name: 'kafka_messages_processed_total',
    help: 'Total Kafka messages processed',
    labelNames: ['topic', 'status']
});

const betsPlaced = new client.Counter({
    name: 'bets_placed_total',
    help: 'Total bets placed',
});

const winsProcessed = new client.Counter({
    name: 'wins_processed_total',
    help: 'Total wins processed',
});

module.exports = {
    client,
    httpRequestsTotal,
    kafkaMessagesProcessed,
    betsPlaced,
    winsProcessed,
    // Add more as needed
};