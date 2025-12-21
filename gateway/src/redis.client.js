// Shared Redis client for Gateway service
// Consolidates multiple Redis connections into reusable instances
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Main Redis client for general operations (balance, stats)
const redis = new Redis(REDIS_URL);

// Pub client for Socket.IO adapter
const pubClient = new Redis(REDIS_URL);

// Sub client for Socket.IO adapter
const subClient = pubClient.duplicate();

// Subscriber for pub/sub events (balance_updates, public_feed)
const redisSub = new Redis(REDIS_URL);

// Event handlers for connection monitoring
redis.on('ready', () => console.log('[Redis] Main client ready'));
redis.on('error', (err) => console.error('[Redis] Main client error:', err));

pubClient.on('ready', () => console.log('[Redis] Pub client ready'));
pubClient.on('error', (err) => console.error('[Redis] Pub client error:', err));

subClient.on('ready', () => console.log('[Redis] Sub client ready'));
subClient.on('error', (err) => console.error('[Redis] Sub client error:', err));

redisSub.on('ready', () => console.log('[Redis] Subscriber client ready'));
redisSub.on('error', (err) => console.error('[Redis] Subscriber client error:', err));

// Graceful shutdown helper
async function closeAll() {
    console.log('[Redis] Closing all connections...');
    await Promise.all([
        redis.quit(),
        pubClient.quit(),
        subClient.quit(),
        redisSub.quit()
    ]);
    console.log('[Redis] All connections closed');
}

module.exports = {
    redis,
    pubClient,
    subClient,
    redisSub,
    closeAll
};
