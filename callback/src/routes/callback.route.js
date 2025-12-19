const express = require('express');
const { validateHmac } = require('../services/hmac.validator');
const { publishCallbackEvent } = require('../services/event.publisher');

const router = express.Router();

router.post('/callback', async (req, res) => {
    const payload = req.body;
    const signature = req.headers['x-signature'] || req.headers['x-hmac'];

    const secret = process.env.HMAC_SECRET;

    // Basic validation
    if (!payload || !payload.type || !payload.external_tx_id || !payload.user_id) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    // HMAC validation
    if (!validateHmac(payload, signature, secret)) {
        console.warn('Invalid HMAC signature', { external_tx_id: payload.external_tx_id });
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Expected event types
    const validTypes = ['bet', 'win', 'loss', 'rollback-bet', 'rollback-win'];
    if (!validTypes.includes(payload.type)) {
        return res.status(400).json({ error: 'Invalid event type' });
    }

    try {
        await publishCallbackEvent({
            ...payload,
            received_at: new Date().toISOString(),
            payload // store raw for audit if needed
        });

        console.log(`Callback processed: ${payload.type} - ${payload.external_tx_id}`);
        res.status(200).json({ status: 'accepted' });
    } catch (err) {
        console.error('Failed to publish to Kafka', err);
        // Still return 200 to prevent aggregator retries — we'll replay via logs if needed
        res.status(200).json({ status: 'queued' });
    }
});

module.exports = router;