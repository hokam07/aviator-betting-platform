const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
    contactPoints: [process.env.CASSANDRA_HOSTS || 'localhost'],
    localDataCenter: 'datacenter1',
    keyspace: process.env.CASSANDRA_KEYSPACE || 'aviator'
});

client.connect()
    .then(() => console.log('Cassandra connected'))
    .catch(err => console.error('Cassandra connection failed', err));

module.exports = client;