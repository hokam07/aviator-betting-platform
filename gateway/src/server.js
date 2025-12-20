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
                const { getProducer } = require('./services/event.publisher');
                const producer = getProducer();
                if (producer) await producer.disconnect();
                console.log('Kafka producer disconnected');

                // Close Redis clients used in services
                const { redis } = require('./services/bet.service'); // if exported, or just require and quit
                // Actually bet.service might have its own redis instance
                // But ws/socket.handler also has. 
                // Let's just create a shared one later if needed, but for now:
                const Redis = require('ioredis');
                const globalRedis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
                await globalRedis.quit();

                process.exit(0);
            } catch (err) {
                console.error('Error during shutdown:', err);
                process.exit(1);
            }
        });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

}).catch(err => {
    console.error('Failed to start gateway service', err);
    process.exit(1);
});
