const express = require('express');
const { getUserStats } = require('../services/bet.service');
const router = express.Router();

router.get('/stats/:userId', async (req, res) => {
    try {
        const stats = await getUserStats(req.params.userId);
        res.status(200).json(stats);
    } catch (err) {
        console.error('Failed to fetch user stats:', err);
        res.status(500).json({ error: 'Failed to fetch user stats' });
    }
});

module.exports = router;
