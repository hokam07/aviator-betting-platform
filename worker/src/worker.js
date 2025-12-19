const { Worker } = require("bullmq");
const repo = require("./repositories/events.repo")
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
};

const worker = new Worker(
  'events-queue',
  async job => {
    const event = job.data;
    try {
      await repo.insert(event);
      console.log('Processed event:', event.eventId);
    } catch (err) {
      console.error('Error processing event:', err);
      throw err;
    }
  },
  { connection }
);

worker.on('failed', (job, err) => {
  console.error(`Job failed: ${job.id}, error:`, err);
});

console.log('🚀 Worker started, listening to events-queue...');
