const express = require('express');
const betRoute = require('./routes/bet.route');
const userRoute = require('./routes/user.route');

const app = express();
const cors = require('cors');

app.use(cors({
    origin: true, // Allow any origin
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api', betRoute);
app.use('/api/user', userRoute);

module.exports = app;
