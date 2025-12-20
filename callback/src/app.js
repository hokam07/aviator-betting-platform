const express = require('express');
const callbackRoute = require('./routes/callback.route');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/', callbackRoute);

module.exports = app;