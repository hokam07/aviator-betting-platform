const axios = require('axios');

const CALLBACK_URL = 'http://localhost:3001/callback';
const RESOLUTION_DELAY_MS = 1500; // Time to simulate game round

// In-memory tracking of pending bets
const pendingBets = new Map();

/**
 * Mock Aggregator Service
 * Simulates a game provider that resolves bets with win/loss outcomes
 */
class MockAggregator {
    constructor() {
        this.winRate = 0.45; // 45% win chance
        this.multiplier = 2.0; // 2x payout on win
    }

    /**
     * Register a bet for resolution
     */
    registerBet(userId, betRoundId, externalTxId, amount) {
        pendingBets.set(betRoundId, {
            userId,
            betRoundId,
            externalTxId,
            amount,
            placedAt: Date.now()
        });

        // Schedule resolution
        setTimeout(() => {
            this.resolveBet(betRoundId);
        }, RESOLUTION_DELAY_MS);

        console.log(`📝 Registered bet: ${betRoundId} for user ${userId.slice(0, 8)}... amount: $${amount}`);
    }

    /**
     * Resolve a bet with win or loss
     */
    async resolveBet(betRoundId) {
        const bet = pendingBets.get(betRoundId);
        if (!bet) {
            console.warn(`⚠️  Bet ${betRoundId} not found for resolution`);
            return;
        }

        const didWin = Math.random() < this.winRate;

        try {
            if (didWin) {
                // Send WIN callback
                const winAmount = bet.amount * this.multiplier;
                await axios.post(CALLBACK_URL, {
                    type: 'win',
                    external_tx_id: `${bet.externalTxId}-win`,
                    user_id: bet.userId,
                    bet_round_id: bet.betRoundId,
                    amount: winAmount
                }, { headers: { 'x-signature': 'dummy' } });

                console.log(`✅ WIN: ${bet.betRoundId} - User ${bet.userId.slice(0, 8)}... won $${winAmount}`);
            } else {
                // Send LOSS callback
                await axios.post(CALLBACK_URL, {
                    type: 'loss',
                    external_tx_id: `${bet.externalTxId}-loss`,
                    user_id: bet.userId,
                    bet_round_id: bet.betRoundId,
                    amount: bet.amount
                }, { headers: { 'x-signature': 'dummy' } });

                console.log(`❌ LOSS: ${bet.betRoundId} - User ${bet.userId.slice(0, 8)}... lost $${bet.amount}`);
            }
        } catch (error) {
            console.error(`❗ Error resolving bet ${betRoundId}:`, error.message);
        } finally {
            pendingBets.delete(betRoundId);
        }
    }
}

// Singleton instance
const aggregator = new MockAggregator();

/**
 * Express middleware to intercept bet callbacks
 */
function interceptBetCallback(req, res, next) {
    if (req.body && req.body.type === 'bet') {
        const { user_id, bet_round_id, external_tx_id, amount } = req.body;

        // Register bet for auto-resolution
        aggregator.registerBet(user_id, bet_round_id, external_tx_id, amount);
    }

    // Continue to normal callback processing
    next();
}

module.exports = { interceptBetCallback, aggregator };
