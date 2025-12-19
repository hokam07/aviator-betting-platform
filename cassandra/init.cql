CREATE KEYSPACE IF NOT EXISTS app_db
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 1
};

USE app_db;

CREATE TABLE IF NOT EXISTS events_by_user (
  user_id UUID,
  event_time TIMESTAMP,
  event_id UUID,
  event_type TEXT,
  payload TEXT,
  PRIMARY KEY (user_id, event_time, event_id)
) WITH CLUSTERING ORDER BY (event_time DESC);