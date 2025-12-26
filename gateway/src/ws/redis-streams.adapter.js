// src/ws/redis-streams.adapter.js
const { createAdapter } = require('@socket.io/redis-streams-adapter');
const { pubClient, subClient } = require('../redis.client');

// Redis Streams adapter uses consumer groups for better horizontal scaling
// This is more efficient than Pub/Sub for multi-gateway deployments
module.exports = createAdapter(pubClient, subClient);
