const express = require('express');
const callbackRoute = require('./routes/callback.route');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/', callbackRoute);

module.exports = app;