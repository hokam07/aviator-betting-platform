const express = require('express');
const { processBet, getUserBalance } = require('../services/bet.service');

const router = express.Router();

router.post('/bet', async (req, res) => {
    const { user_id, amount, game_data } = req.body;

    if (!user_id || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid bet request' });
    }

    try {
        const result = await processBet(user_id, amount, game_data);
        res.status(200).json(result);
    } catch (err) {
        console.error('Bet processing error:', err);
        res.status(400).json({ error: err.message });
    }
});

router.get('/balance/:userId', async (req, res) => {
    try {
        const balance = await getUserBalance(req.params.userId);
        res.status(200).json({ user_id: req.params.userId, balance });
    } catch (err) {
        console.error('Balance fetch error:', err);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

module.exports = router;
