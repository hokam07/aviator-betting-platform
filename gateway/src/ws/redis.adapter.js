// src/ws/redis.adapter.js
const { pubClient, subClient } = require('../redis.client');

// Support both Pub/Sub (default) and Streams adapters via environment variable
const adapterType = process.env.SOCKET_ADAPTER_TYPE || 'pubsub';

let adapter;
if (adapterType === 'streams') {
    console.log('Using Redis Streams adapter for Socket.io');
    const { createAdapter } = require('@socket.io/redis-streams-adapter');
    adapter = createAdapter(pubClient, subClient);
} else {
    console.log('Using Redis Pub/Sub adapter for Socket.io (default)');
    const { createAdapter } = require('@socket.io/redis-adapter');
    adapter = createAdapter(pubClient, subClient);
}

module.exports = adapter;