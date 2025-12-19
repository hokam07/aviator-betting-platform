const { Queue } = require("bullmq");

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

const queue = new Queue('events-queue', { connection });

async function sendEvent(event) {
  await queue.add('event', event);
  console.log('✅ Event sent:', event);
}
module.exports = { sendEvent };