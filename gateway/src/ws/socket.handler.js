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
                let cachedBalance = await redis.get(`balance:${userId}`);

                // AUTO-FUNDING: If new user (no balance), credit $1000
                if (!cachedBalance) {
                    console.log(`[WS] Auto-funding new user ${userId} with $1000`);
                    const axios = require('axios');
                    const CALLBACK_URL = process.env.AGGREGATOR_CALLBACK_URL || 'http://callback:3000/callback';
                    await axios.post(CALLBACK_URL, {
                        type: 'win',
                        user_id: userId,
                        amount: 1000,
                        external_tx_id: `auto-fund-${userId}`,
                        bet_round_id: 'initial',
                        provider: 'system'
                    }, { headers: { 'x-signature': 'dummy' } });

                    cachedBalance = "1000.00";
                }

                io.to(userId).emit('balance_update', {
                    user_id: userId,
                    balance: parseFloat(cachedBalance)
                });
            } catch (err) {
                console.error('Redis balance/auto-funding error:', err);
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

            // Validate amount
            if (!amount || amount <= 0) {
                return socket.emit('error', { message: 'Invalid bet amount' });
            }

            console.log(`[WS] Bet placed: User ${userId} for round ${roundId} amount ${amount}`);

            try {
                const axios = require('axios');
                const CALLBACK_URL = process.env.AGGREGATOR_CALLBACK_URL || 'http://callback:3000/callback';

                // Track bet in Redis to prevent multiple bets per round per socket (basic lock)
                const betKey = `active_bet:${roundId}:${userId}`;
                const alreadyBet = await redis.get(betKey);
                if (alreadyBet) {
                    return socket.emit('error', { message: 'Already placed a bet for this round' });
                }

                await axios.post(CALLBACK_URL, {
                    type: 'bet',
                    user_id: userId,
                    amount,
                    external_tx_id: `ws-${roundId}-${userId}`,
                    bet_round_id: roundId
                }, { headers: { 'x-signature': 'dummy' } });

                // Mark as bet placed in Redis (expires in 2 mins)
                await redis.set(betKey, amount, 'EX', 120);

                socket.emit('bet_confirmed', { roundId, amount });
            } catch (err) {
                console.error('[WS] Bet placement failed:', err.message);
                socket.emit('error', { message: 'Failed to place bet' });
            }
        });

        socket.on('cash_out', async (data) => {
            const { userId, roundId, multiplier } = data;
            console.log(`[WS] Cash out: User ${userId} at ${multiplier}x`);

            try {
                // Get the original bet amount from Redis
                const betKey = `active_bet:${roundId}:${userId}`;
                const betAmountStr = await redis.get(betKey);

                if (!betAmountStr) {
                    return socket.emit('error', { message: 'No active bet found for this round' });
                }

                const betAmount = parseFloat(betAmountStr);
                const winAmount = (betAmount * multiplier).toFixed(2);

                console.log(`[WS] Processing win for ${userId}: $${betAmount} x ${multiplier} = $${winAmount}`);

                const axios = require('axios');
                const CALLBACK_URL = process.env.AGGREGATOR_CALLBACK_URL || 'http://callback:3000/callback';
                await axios.post(CALLBACK_URL, {
                    type: 'win',
                    user_id: userId,
                    amount: parseFloat(winAmount),
                    external_tx_id: `win-${roundId}-${userId}`,
                    bet_round_id: roundId,
                    is_cashout: true
                }, { headers: { 'x-signature': 'dummy' } });

                // Remove active bet so they can't cash out twice
                await redis.del(betKey);

                socket.emit('cashout_confirmed', { multiplier, winAmount: parseFloat(winAmount) });
            } catch (err) {
                console.error('[WS] Cash out failed:', err.message);
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
