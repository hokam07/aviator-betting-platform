const Redis = require('ioredis');

const REDIS_MODE = process.env.REDIS_MODE || 'single'; // 'single' or 'cluster'
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

let redis;

if (REDIS_MODE === 'cluster') {
    // Redis Cluster mode (6+ nodes)
    const clusterNodes = (process.env.REDIS_CLUSTER_NODES || 'redis-1:6379,redis-2:6379,redis-3:6379')
        .split(',')
        .map(node => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port) };
        });

    console.log('Connecting to Redis Cluster:', clusterNodes);

    redis = new Redis.Cluster(clusterNodes, {
        redisOptions: {
            password: process.env.REDIS_PASSWORD,
        },
        clusterRetryStrategy: (times) => Math.min(times * 100, 2000),
    });
} else {
    // Single instance mode (default)
    console.log('Connecting to single Redis instance:', REDIS_URL);
    redis = new Redis(REDIS_URL);
}

redis.on('error', (err) => {
    console.error('Redis error:', err);
});

redis.on('ready', () => {
    console.log('Redis client ready');
});

module.exports = redis;
