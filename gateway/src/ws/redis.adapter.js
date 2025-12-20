// src/ws/redis.adapter.js
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const pubClient = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => console.log('Redis adapter clients connected'))
    .catch(err => console.error('Redis adapter connection failed:', err));

module.exports = createAdapter(pubClient, subClient);