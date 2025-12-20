// src/ws/socket.handler.js
const redisAdapter = require('./redis.adapter');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

async function initWebSocket(server) {
    const io = require('socket.io')(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['websocket'],
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
    });

    // Apply Redis adapter for multi-node broadcasting
    io.adapter(redisAdapter);

    // Connection handling
    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on('subscribe', async (userId) => {
            if (!userId) return;

            socket.join(userId); // Room per user
            console.log(`User ${userId} subscribed (socket ${socket.id})`);

            // Send current balance from Redis cache
            try {
                const cachedBalance = await redis.get(`balance:${userId}`);
                if (cachedBalance) {
                    socket.emit('balance_update', {
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