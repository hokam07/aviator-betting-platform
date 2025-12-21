// src/ws/redis.adapter.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { pubClient, subClient } = require('../redis.client');

// ioredis auto-connects, no need to call connect()
// Just create and export the adapter
module.exports = createAdapter(pubClient, subClient);