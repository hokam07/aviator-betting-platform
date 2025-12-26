// Shared Redis client for Gateway service
// Supports both single instance and Redis Cluster modes
const Redis = require('ioredis');

const REDIS_MODE = process.env.REDIS_MODE || 'single'; // 'single' or 'cluster'
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let redis, pubClient, subClient, redisSub;

if (REDIS_MODE === 'cluster') {
    // Redis Cluster mode (6+ nodes)
    const clusterNodes = (process.env.REDIS_CLUSTER_NODES || 'redis-1:6379,redis-2:6379,redis-3:6379')
        .split(',')
        .map(node => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port) };
        });

    console.log('[Redis] Connecting to Redis Cluster:', clusterNodes);

    const clusterOptions = {
        redisOptions: {
            password: process.env.REDIS_PASSWORD,
        },
        clusterRetryStrategy: (times) => Math.min(times * 100, 2000),
    };

    redis = new Redis.Cluster(clusterNodes, clusterOptions);
    pubClient = new Redis.Cluster(clusterNodes, clusterOptions);
    subClient = new Redis.Cluster(clusterNodes, clusterOptions);
    redisSub = new Redis.Cluster(clusterNodes, clusterOptions);
} else {
    // Single instance mode (default)
    console.log('[Redis] Connecting to single Redis instance:', REDIS_URL);

    redis = new Redis(REDIS_URL);
    pubClient = new Redis(REDIS_URL);
    subClient = pubClient.duplicate();
    redisSub = new Redis(REDIS_URL);
}

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
