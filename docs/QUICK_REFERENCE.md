# Quick Reference Card

Essential commands and information for the Cassandra-Kafka Betting System.

## 🚀 Getting Started

```bash
# Automated setup
./scripts/quick-start.sh

# Manual setup
make up
make health
```

## 📋 Common Commands

### Service Management
```bash
make up              # Start all services
make down            # Stop all services
make restart         # Restart all services
make build           # Rebuild images
make clean           # Remove everything
make logs            # View all logs
```

### Testing
```bash
make test-bet        # Test bet placement
make test-callback   # Test callback
make load-test       # Run load test (10 users, 60s)
```

### Monitoring
```bash
make health          # Check service health
make monitor         # Real-time dashboard
```

### Utilities
```bash
make init-data       # Initialize test users
./scripts/cleanup.sh # Clean up system
```

## 🌐 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Gateway | http://localhost:3000 | REST API & WebSocket |
| Callback | http://localhost:3001 | Aggregator callbacks |
| Cassandra | localhost:9042 | Database |
| Kafka | localhost:9092 | Event streaming |
| Redis | localhost:6379 | Cache & pub/sub |

## 📡 API Endpoints

### Gateway (Port 3000)

#### Place Bet
```bash
POST /api/bet
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 100,
  "game_data": {"game": "aviator"}
}
```

#### Get Balance
```bash
GET /api/balance/:userId
```

#### Health Check
```bash
GET /health
```

### Callback (Port 3001)

#### Process Callback
```bash
POST /callback
Headers: x-signature: <hmac>
{
  "type": "win",
  "external_tx_id": "unique-id",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "bet_round_id": "round-id",
  "amount": 250
}
```

Event types: `bet`, `win`, `loss`, `rollback-bet`, `rollback-win`

## 🧪 Quick Tests

### Test Bet
```bash
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","amount":100,"game_data":{"game":"aviator"}}'
```

### Test Balance
```bash
curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000
```

### Test Win Callback
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{"type":"win","external_tx_id":"win-123","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-123","amount":250}'
```

## 🔍 Debugging

### View Logs
```bash
docker-compose logs -f gateway
docker-compose logs -f callback
docker-compose logs -f ledger-worker
```

### Check Cassandra
```bash
docker exec -it $(docker ps -qf "name=cassandra") cqlsh
cqlsh> USE betting_ledger;
cqlsh:betting_ledger> SELECT * FROM users;
```

### Check Redis
```bash
docker exec -it $(docker ps -qf "name=redis") redis-cli
> KEYS balance:*
> GET balance:550e8400-e29b-41d4-a716-446655440000
```

### Check Kafka
```bash
# List topics
docker exec $(docker ps -qf "name=kafka") kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Consume messages
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic bet-events \
  --from-beginning
```

## 📊 Load Testing

```bash
# Setup
make load-test-setup

# Run tests
make load-test-light    # 5 users, 30s
make load-test-medium   # 20 users, 60s
make load-test-heavy    # 50 users, 120s

# Custom
cd load-test-client
node index.js --users 30 --duration 90
```

## 🔧 Troubleshooting

### Services won't start
```bash
# Check Docker
docker ps -a

# Check logs
make logs

# Clean and restart
make clean
make up
```

### Kafka issues
```bash
# Wait longer (Kafka takes 30-60s to start)
sleep 60

# Check Kafka logs
docker-compose logs kafka
```

### Balance not updating
```bash
# Check Redis
docker exec $(docker ps -qf "name=redis") redis-cli ping

# Check ledger worker
docker-compose logs ledger-worker

# Check Kafka messages
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic aggregator-callbacks \
  --from-beginning
```

## 📚 Documentation

| File | Description |
|------|-------------|
| README.md | Overview and quick start |
| API.md | Complete API reference |
| TESTING.md | Testing guide |
| ARCHITECTURE.md | Architecture details |
| CONTRIBUTING.md | Development guide |
| PROJECT_SUMMARY.md | Project overview |

## 🎯 Test User IDs

Default test users (0-49):
```
550e8400-e29b-41d4-a716-44665544000X
```

Where X is 00-49 (e.g., `550e8400-e29b-41d4-a716-446655440000`)

## 🔑 Environment Variables

Key variables in `.env`:
- `KAFKA_BROKER` - Kafka connection
- `CASSANDRA_HOSTS` - Cassandra hosts
- `REDIS_URL` - Redis connection
- `HMAC_SECRET` - Callback signature secret
- `AGGREGATOR_URL` - Game aggregator URL

## 💡 Tips

1. **Wait for initialization**: Services take 30-60s to start
2. **Check health first**: Run `make health` before testing
3. **Monitor in real-time**: Use `make monitor` for live stats
4. **Check logs often**: `make logs` shows all service logs
5. **Clean start**: Use `make clean && make up` for fresh start

## 🆘 Getting Help

1. Check logs: `make logs`
2. Check health: `make health`
3. Review documentation in project root
4. Check TESTING.md for detailed procedures
5. Review ARCHITECTURE.md for system design

## 📦 Backup & Restore

```bash
# Backup
./scripts/backup-cassandra.sh

# Cleanup
./scripts/cleanup.sh
```

## 🎮 WebSocket Testing

```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('subscribe', '550e8400-e29b-41d4-a716-446655440000');
});

socket.on('balance_update', (data) => {
  console.log('Balance:', data.balance);
});
```

## 📈 Performance Targets

- Bet placement: < 50ms (p99)
- Balance query: < 10ms (p99)
- Callback processing: < 100ms (p99)
- Throughput: 10,000+ bets/sec

## ✅ Health Check Checklist

- [ ] Docker running
- [ ] All containers up: `docker ps`
- [ ] Gateway responding: `curl http://localhost:3000/health`
- [ ] Callback responding: `curl http://localhost:3001/health`
- [ ] Cassandra ready: `docker exec $(docker ps -qf "name=cassandra") cqlsh -e "DESCRIBE KEYSPACES"`
- [ ] Kafka ready: `docker exec $(docker ps -qf "name=kafka") kafka-topics.sh --bootstrap-server localhost:9092 --list`
- [ ] Redis ready: `docker exec $(docker ps -qf "name=redis") redis-cli ping`

---

**Keep this card handy for quick reference!** 📌
