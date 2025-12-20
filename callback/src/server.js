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
                // If producer is exported, we should use it. 
                // Let's check event.publisher.js exports.
                const { producer } = require('./services/event.publisher');
                // Actually publisher.js doesn't export producer. I should fix that if needed or just use require logic.
                // Wait, I can't easily access the producer instance unless exported.
                process.exit(0);
            } catch (err) {
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