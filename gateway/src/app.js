const express = require('express');
const userRoute = require('./routes/user.route');
const { client } = require('./metrics');

const app = express();

// collect metrics
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

const cors = require('cors');
const { httpRequestsTotal } = require('./metrics');

app.use(cors({
    origin: true, // Allow any origin
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
    res.on('finish', () => {
        httpRequestsTotal.inc({
            method: req.method,
            route: req.route?.path || req.path,
            status: res.statusCode
        });
    });
    next();
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api', userRoute);

module.exports = app;
