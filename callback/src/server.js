require('dotenv').config();
const app = require('./app');
const { init } = require('./services/event.publisher');

const PORT = process.env.PORT || 3000;

init().then(() => {
    app.listen(PORT, () => {
        console.log(`Callback service running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start callback service', err);
    process.exit(1);
});