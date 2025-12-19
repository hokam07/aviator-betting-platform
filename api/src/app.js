const express = require('express');
const eventsRoute = require('./routes/events.route');

const app = express();
app.use(express.json());
app.use('/events', eventsRoute);

module.exports = app;
