# Database Setup Guide

## Quick Start

Initialize all databases and topics at once:
```bash
make init-all
```

This will:
1. Initialize Cassandra keyspaces and tables
2. Create required Kafka topics
3. Verify the setup

## Individual Commands

### Cassandra

**Initialize Schema**
```bash
make cassandra-init
```

This command:
- Waits for Cassandra to be ready
- Executes `cassandra-init/schema.cql`
- Creates `aviator` and `chat` keyspaces
- Creates all required tables
- Verifies the setup

**Check Status**
```bash
make cassandra-status
```

Shows:
- All keyspaces
- Tables in aviator keyspace
- Tables in chat keyspace
- User count

**Manual Schema Execution**
```bash
docker exec -i cassandra cqlsh < cassandra-init/schema.cql
```

### Kafka

**Create Topics**
```bash
make kafka-topics
```

Creates:
- `bet-events` topic (3 partitions, 24h retention)
- `aggregator-callbacks` topic (3 partitions, 24h retention)

**Check Status**
```bash
make kafka-status
```

Shows:
- All topics
- Consumer groups
- Topic details (partitions, replication)

**Manual Topic Creation**
```bash
docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic bet-events \
  --partitions 3 --replication-factor 1
```

## Schema Details

### Aviator Keyspace

**Tables:**
- `users` - User balances and metadata
- `ledger_transactions` - Immutable transaction log
- `callback_idempotency` - Prevents duplicate processing
- `pending_bets` - Temporary bet tracking (1h TTL)
- `game_rounds` - Game round data
- `fraud_logs` - Fraud detection logs
- `analytics_counters` - Metrics and counters

### Chat Keyspace

**Tables:**
- `messages` - Chat messages (24h TTL)

## Troubleshooting

### Cassandra Not Ready
If you see "Cassandra not ready yet, waiting...":
- Wait 30-60 seconds for Cassandra to fully start
- Check logs: `docker logs cassandra`
- Verify container is running: `docker ps | grep cassandra`

### Schema Already Exists
The commands use `IF NOT EXISTS` clauses, so they're safe to run multiple times.

### Kafka Topics Already Exist
The `--if-not-exists` flag prevents errors when topics already exist.

### Reset Everything
To completely reset databases:
```bash
make clean  # Removes all containers and volumes
make up     # Start fresh
make init-all  # Reinitialize
```

## Verification

After initialization, verify everything is working:

```bash
# Check Cassandra
make cassandra-status

# Check Kafka
make kafka-status

# Run system verification
./scripts/verify-load-test-ready.sh

# Test the system
make test-all
```

## Auto-Initialization

Cassandra schema is automatically initialized on first container start via:
```yaml
volumes:
  - ./cassandra-init/schema.cql:/docker-entrypoint-initdb.d/schema.cql
```

However, if this fails or you need to reinitialize, use `make cassandra-init`.

## Production Considerations

For production deployments:

1. **Cassandra:**
   - Increase replication factor: `'replication_factor': 3`
   - Use NetworkTopologyStrategy
   - Adjust heap sizes based on load
   - Enable authentication

2. **Kafka:**
   - Increase replication factor to 3
   - Adjust partition count based on throughput
   - Configure retention based on compliance needs
   - Enable authentication and encryption

3. **Monitoring:**
   - Set up Cassandra metrics (nodetool, JMX)
   - Monitor Kafka consumer lag
   - Track topic sizes and partition distribution
