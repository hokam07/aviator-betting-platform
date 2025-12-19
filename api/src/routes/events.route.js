const router = require('express').Router();
const crypto = require('crypto');
const { sendEvent } = require('../services/sqs.service');

router.post('/', async (req, res) => {
  const event = {
    eventId: crypto.randomUUID(),
    userId: req.body.userId,
    eventType: req.body.eventType,
    payload: req.body.payload,
    eventTime: new Date().toISOString()
  };

  await sendEvent(event);
  res.status(202).json({ status: 'queued' });
});

module.exports = router;
