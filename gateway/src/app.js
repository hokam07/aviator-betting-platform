const express = require('express');
const betRoute = require('./routes/bet.route');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api', betRoute);

module.exports = app;
