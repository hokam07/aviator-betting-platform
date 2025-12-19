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

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    // Subscribe to Redis pub/sub for balance updates
    redisSub.subscribe('balance_updates', (err) => {
        if (err) {
            console.error('Redis subscribe error:', err);
        } else {
            console.log('Subscribed to balance_updates channel');
        }
    });

    redisSub.on('message', (channel, message) => {
        if (channel === 'balance_updates') {
            try {
                const data = JSON.parse(message);
                io.to(`user:${data.user_id}`).emit('balance_update', data);
            } catch (err) {
                console.error('Error parsing balance update:', err);
            }
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
