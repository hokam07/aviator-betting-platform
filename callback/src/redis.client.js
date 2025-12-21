const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.on('connect', () => console.log('Redis connected in Callback service'));

module.exports = redis;
