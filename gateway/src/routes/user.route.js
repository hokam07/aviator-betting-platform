const express = require('express');
const { getUserStats, getUserBalance } = require('../services/bet.service');
const router = express.Router();

router.get('/user/stats/:userId', async (req, res) => {
    try {
        const stats = await getUserStats(req.params.userId);
        res.status(200).json(stats);
    } catch (err) {
        console.error('Failed to fetch user stats:', err);
        res.status(500).json({ error: 'Failed to fetch user stats' });
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
