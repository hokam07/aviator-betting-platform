const { Server } = require('socket.io');
const Redis = require('ioredis');

let io;
const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
const redisSub = new Redis(process.env.REDIS_URL || 'redis://redis:6379');

function initWebSocket(server) {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('subscribe', async (userId) => {
            socket.join(`user:${userId}`);
            console.log(`User ${userId} subscribed via ${socket.id}`);

            // Send current balance
            const balance = await redis.get(`balance:${userId}`);
            socket.emit('balance_update', {
                user_id: userId,
                balance: parseFloat(balance || 0),
                timestamp: new Date().toISOString()
            });
        });

        // Chat handling
        socket.on('chat_message', (msg) => {
            // Broadcast to all clients
            io.emit('chat_message', {
                user: msg.user,
                text: msg.text,
                timestamp: new Date().toISOString()
            });
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    // Subscribe to Redis pub/sub for balance updates and public feed
    redisSub.subscribe('balance_updates', 'public_feed', (err) => {
        if (err) {
            console.error('Redis subscribe error:', err);
        } else {
            console.log('Subscribed to Redis channels');
        }
    });

    redisSub.on('message', (channel, message) => {
        try {
            const data = JSON.parse(message);

            if (channel === 'balance_updates') {
                io.to(`user:${data.user_id}`).emit('balance_update', data);
            } else if (channel === 'public_feed') {
                console.log(`[WS] Emitting public_feed: ${data.type} for ${data.user_id}`);
                io.emit('public_feed', data);
            }
        } catch (err) {
            console.error(`Error parsing message on ${channel}:`, err);
        }
    });

    return io;
}

function broadcastBalanceUpdate(userId, balance) {
    if (io) {
        io.to(`user:${userId}`).emit('balance_update', {
            user_id: userId,
            balance,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = { initWebSocket, broadcastBalanceUpdate };
