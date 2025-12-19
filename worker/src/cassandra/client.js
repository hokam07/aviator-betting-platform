const cassandra = require('cassandra-driver');

module.exports = new cassandra.Client({
  contactPoints: ['cassandra'],
  localDataCenter: 'datacenter1',
  keyspace: 'app_db'
});

