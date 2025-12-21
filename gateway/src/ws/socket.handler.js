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
     * Subscribe to Redis channels
     */
    redisSub.subscribe('balance_updates', 'public_feed', 'game_updates', (err) => {
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
                io.emit('public_feed', data);
            }

            if (channel === 'game_updates') {
                io.emit('game_update', data);
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
            io.emit('chat_message', {
                user: data.user || 'Anonymous',
                text: data.text,
                timestamp: new Date().toISOString()
            });
        });

        // Interactive Gaming Handlers
        socket.on('place_bet', async (data) => {
            const { userId, amount, roundId } = data;
            console.log(`[WS] Bet placed: User ${userId} for round ${roundId} amount ${amount}`);

            // In a real system, we would validate round state here
            // and write to a 'bets' collection in Redis for that round.
            // For now, we'll hit the Callback service to simulate the financial flow
            try {
                const axios = require('axios');
                const CALLBACK_URL = process.env.AGGREGATOR_CALLBACK_URL || 'http://callback:3000/callback';
                await axios.post(CALLBACK_URL, {
                    type: 'bet',
                    user_id: userId,
                    amount,
                    external_tx_id: `ws-${roundId}-${userId}`,
                    bet_round_id: roundId
                }, { headers: { 'x-signature': 'dummy' } });

                socket.emit('bet_confirmed', { roundId, amount });
            } catch (err) {
                socket.emit('error', { message: 'Failed to place bet' });
            }
        });

        socket.on('cash_out', async (data) => {
            const { userId, roundId, multiplier } = data;
            console.log(`[WS] Cash out: User ${userId} at ${multiplier}x`);

            try {
                const axios = require('axios');
                const CALLBACK_URL = process.env.AGGREGATOR_CALLBACK_URL || 'http://callback:3000/callback';
                await axios.post(CALLBACK_URL, {
                    type: 'win',
                    user_id: userId,
                    amount: multiplier, // In this simplified test, we use multiplier as win amount or similar
                    external_tx_id: `win-${roundId}-${userId}`,
                    bet_round_id: roundId,
                    is_cashout: true
                }, { headers: { 'x-signature': 'dummy' } });

                socket.emit('cashout_confirmed', { multiplier });
            } catch (err) {
                socket.emit('error', { message: 'Cash out failed' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    console.log('WebSocket server initialized with Redis adapter');
}

module.exports = { initWebSocket };
