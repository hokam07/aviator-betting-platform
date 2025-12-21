require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWebSocket } = require('./ws/socket.handler');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Initialize WebSocket
initWebSocket(server);

const instance = server.listen(PORT, () => {
    console.log(`Gateway service running on port ${PORT}`);
    console.log(`WebSocket server ready`);
});

// Graceful Shutdown
const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    instance.close(async () => {
        console.log('HTTP server closed');
        try {
            const { closeAll } = require('./redis.client');
            await closeAll();
            console.log('Redis disconnected');

            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
