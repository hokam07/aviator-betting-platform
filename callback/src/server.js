require('dotenv').config();
const app = require('./app');
const { init } = require('./services/event.publisher');

const PORT = process.env.PORT || 3000;

init().then(() => {
    const server = app.listen(PORT, () => {
        console.log(`Callback service running on port ${PORT}`);
    });

    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Shutting down callback service...`);
        server.close(async () => {
            try {
                const { producer } = require('./services/event.publisher');
                await producer.disconnect();
                console.log('Kafka producer disconnected');
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
    console.error('Failed to start callback service', err);
    process.exit(1);
});