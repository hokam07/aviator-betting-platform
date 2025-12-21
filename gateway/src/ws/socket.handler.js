// src/ws/socket.handler.js
const redisAdapter = require('./redis.adapter');
const { redis, redisSub } = require('../redis.client');

async function initWebSocket(server) {
    const io = require('socket.io')(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        // transports: ['websocket'],
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        autoConnect: true
    });

    // Apply Redis adapter for multi-node broadcasting
    io.adapter(redisAdapter);

    /**
     * Subscribe to Redis channels (same as second file)
     */
    redisSub.subscribe('balance_updates', 'public_feed', (err) => {
        if (err) {
            console.error('[WS] Redis subscribe error:', err);
        } else {
            console.log('[WS] Subscribed to Redis channels');
        }
    });

    /**
     * Redis pub/sub → WebSocket emit
     */
    redisSub.on('message', (channel, message) => {
        try {
            const data = JSON.parse(message);

            if (channel === 'balance_updates') {
                io.to(data.user_id).emit('balance_update', data);
            }

            if (channel === 'public_feed') {
                console.log(`[WS] Emitting public_feed: ${data.type} for ${data.user_id}`);
                io.emit('public_feed', data);
            }
        } catch (err) {
            console.error(`[WS] Error parsing message on ${channel}:`, err);
        }
    });

    // Connection handling
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('subscribe', async (userId) => {
            if (!userId) return;

            socket.join(userId);
            console.log(`User ${userId} subscribed (socket ${socket.id})`);

            try {
                const cachedBalance = await redis.get(`balance:${userId}`);
                if (cachedBalance) {
                    io.to(userId).emit('balance_update', {
                        user_id: userId,
                        balance: parseFloat(cachedBalance)
                    });
                }
            } catch (err) {
                console.error('Redis balance fetch error:', err);
            }
        });

        socket.on('chat_message', (data) => {
            // Broadcast chat to all (or per-round room later)
            io.emit('chat_message', {
                user: data.user || 'Anonymous',
                text: data.text,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    console.log('WebSocket server initialized with Redis adapter');
}

module.exports = { initWebSocket };
