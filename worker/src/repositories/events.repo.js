const cassandra = require('cassandra-driver');
const client = require('../cassandra/client');

exports.insert = async (event) => {
  try {
    const userId = cassandra.types.Uuid.fromString(event.userId);
    const eventId = cassandra.types.Uuid.fromString(event.eventId);
    const eventTime = event.eventTime ? new Date(event.eventTime) : new Date();

    return await client.execute(
      `
      INSERT INTO events_by_user
      (user_id, event_time, event_id, event_type, payload)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        userId,
        eventTime,
        eventId,
        event.eventType,
        JSON.stringify(event.payload)
      ],
      { prepare: true }
    );
  } catch (error) {
    console.error('❌ Error inserting event:', error.message);
    console.error('📝 Event data:', JSON.stringify(event, null, 2));
    throw error;
  }
};