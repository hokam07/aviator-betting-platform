require('dotenv').config();
const http = require('http');
const app = require('./app');
const { init } = require('./services/event.publisher');
const { initWebSocket } = require('./ws/socket.handler');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize WebSocket
initWebSocket(server);

// Initialize Kafka producer
init().then(() => {
    server.listen(PORT, () => {
        console.log(`Gateway service running on port ${PORT}`);
        console.log(`WebSocket server ready`);
    });
}).catch(err => {
    console.error('Failed to start gateway service', err);
    process.exit(1);
});
