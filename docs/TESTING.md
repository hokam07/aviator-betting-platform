# Testing Guide

Comprehensive testing guide for the Cassandra-Kafka Betting System.

## Prerequisites

1. All services running: `make up`
2. Wait 30-60 seconds for services to initialize
3. Verify health: `./scripts/health-check.sh`

## Unit Testing

### Test Bet Placement

```bash
# Place a bet
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100,
    "game_data": {"game": "aviator", "multiplier": 2.5}
  }'

# Expected response:
# {
#   "bet_round_id": "uuid",
#   "balance": 900,
#   "status": "pending"
# }
```

### Test Balance Query

```bash
curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000

# Expected response:
# {
#   "user_id": "550e8400-e29b-41d4-a716-446655440000",
#   "balance": 900
# }
```

### Test Callbacks

#### Win Callback
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "win",
    "external_tx_id": "win-'$(date +%s)'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-001",
    "amount": 250
  }'
```

#### Loss Callback
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "loss",
    "external_tx_id": "loss-'$(date +%s)'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-002",
    "amount": 100
  }'
```

#### Rollback Bet
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "rollback-bet",
    "external_tx_id": "rollback-bet-'$(date +%s)'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-003",
    "amount": 100
  }'
```

## Integration Testing

### Test Complete Flow

```bash
# 1. Check initial balance
curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000

# 2. Place bet
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100,
    "game_data": {"game": "aviator"}
  }'

# 3. Wait 2 seconds for processing
sleep 2

# 4. Send win callback
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "win",
    "external_tx_id": "win-'$(date +%s)'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-001",
    "amount": 250
  }'

# 5. Wait 2 seconds for processing
sleep 2

# 6. Check final balance (should be initial + 150)
curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000
```

### Test Idempotency

```bash
# Send same callback twice
EXTERNAL_TX_ID="idempotency-test-$(date +%s)"

# First call - should succeed
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "win",
    "external_tx_id": "'$EXTERNAL_TX_ID'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-001",
    "amount": 100
  }'

# Second call - should be ignored (check logs)
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "win",
    "external_tx_id": "'$EXTERNAL_TX_ID'",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-001",
    "amount": 100
  }'
```

### Test Insufficient Balance

```bash
# Try to bet more than balance
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 999999,
    "game_data": {"game": "aviator"}
  }'

# Expected response:
# {
#   "error": "Insufficient balance"
# }
```

## Load Testing

### Light Load (5 users, 30 seconds)
```bash
make load-test-light
```

### Medium Load (20 users, 60 seconds)
```bash
make load-test-medium
```

### Heavy Load (50 users, 120 seconds)
```bash
make load-test-heavy
```

### Custom Load Test
```bash
cd load-test-client
node index.js --users 30 --duration 90 --bet-interval 500 --bet-interval-max 3000
```

## WebSocket Testing

### Using wscat

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# Subscribe to user updates
> {"type": "subscribe", "user_id": "550e8400-e29b-41d4-a716-446655440000"}

# You should receive balance updates in real-time
```

### Using Browser Console

```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('subscribe', '550e8400-e29b-41d4-a716-446655440000');
});

socket.on('balance_update', (data) => {
  console.log('Balance update:', data);
});
```

## Database Verification

### Check Cassandra Data

```bash
# Connect to Cassandra
docker exec -it $(docker ps -qf "name=cassandra") cqlsh

# Query user balance
cqlsh> USE betting_ledger;
cqlsh:betting_ledger> SELECT * FROM users WHERE user_id = 550e8400-e29b-41d4-a716-446655440000;

# Query transactions
cqlsh:betting_ledger> SELECT * FROM ledger_transactions WHERE user_id = 550e8400-e29b-41d4-a716-446655440000;

# Check idempotency
cqlsh:betting_ledger> SELECT * FROM callback_idempotency;
```

### Check Redis Data

```bash
# Connect to Redis
docker exec -it $(docker ps -qf "name=redis") redis-cli

# Get user balance
> GET balance:550e8400-e29b-41d4-a716-446655440000

# List all balance keys
> KEYS balance:*

# Monitor pub/sub messages
> SUBSCRIBE balance_updates
```

### Check Kafka Messages

```bash
# List topics
docker exec $(docker ps -qf "name=kafka") kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Consume bet events
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic bet-events \
  --from-beginning

# Consume callback events
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic aggregator-callbacks \
  --from-beginning
```

## Monitoring

### Real-time Monitor
```bash
./scripts/monitor.sh
```

### View Logs
```bash
# All services
make logs

# Specific service
docker-compose logs -f gateway
docker-compose logs -f callback
docker-compose logs -f ledger-worker
```

## Troubleshooting

### Services not starting
```bash
# Check container status
docker ps -a

# Check logs for errors
docker-compose logs

# Restart services
make restart
```

### Kafka connection issues
```bash
# Wait longer for Kafka to initialize (can take 30-60 seconds)
sleep 60

# Check Kafka logs
docker-compose logs kafka
```

### Cassandra connection issues
```bash
# Check Cassandra logs
docker-compose logs cassandra

# Verify schema
docker exec -it $(docker ps -qf "name=cassandra") cqlsh -e "DESCRIBE KEYSPACE betting_ledger"
```

### Balance not updating
```bash
# Check Redis connection
docker exec $(docker ps -qf "name=redis") redis-cli ping

# Check ledger worker logs
docker-compose logs ledger-worker

# Verify Kafka messages
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic aggregator-callbacks \
  --from-beginning
```
