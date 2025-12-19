# System Overview

## Completed Components

### 1. Gateway Service ✅
- **Location**: `gateway/`
- **Port**: 3000
- **Features**:
  - REST API for bet placement (`POST /api/bet`)
  - Balance queries (`GET /api/balance/:userId`)
  - WebSocket server for real-time updates
  - Redis integration for fast balance caching
  - Kafka producer for bet events
  - Aggregator client for forwarding bets

### 2. Callback Service ✅
- **Location**: `callback/`
- **Port**: 3001
- **Features**:
  - Receives callbacks from game aggregator
  - HMAC signature validation (currently disabled for testing)
  - Publishes to Kafka `aggregator-callbacks` topic
  - Idempotency handling via external_tx_id

### 3. Ledger Worker ✅
- **Location**: `ledger-worker/`
- **Features**:
  - Kafka consumer for `aggregator-callbacks` topic
  - Cassandra integration for persistent ledger
  - Processes: bet_confirmed, win, loss, rollback events
  - Optimistic locking with version control
  - Idempotency checks
  - Decimal precision handling (fixed)

### 4. Infrastructure ✅
- **Cassandra**: Ledger storage with schema
- **Kafka + Zookeeper**: Event streaming
- **Redis**: Balance caching and pub/sub

## Fixed Issues

1. **DecimalError in Ledger Worker**: 
   - Problem: Cassandra returning numbers without proper decimal formatting
   - Solution: Added `parseFloat().toFixed(2)` normalization for all numeric values

## Data Flow

```
User → Gateway → Redis (balance update)
              ↓
            Kafka (bet-events)
              ↓
         Aggregator
              ↓
    Callback Service → Kafka (aggregator-callbacks)
                            ↓
                      Ledger Worker → Cassandra
```

## Testing

Run the complete test flow:
```bash
./test-flow.sh
```

Or use Makefile commands:
```bash
make test-bet      # Test bet placement
make test-callback # Test callback processing
```

## Next Steps (Optional Enhancements)

1. Enable HMAC validation in callback service
2. Add balance reconciliation between Redis and Cassandra
3. Implement retry logic for failed aggregator calls
4. Add monitoring and alerting
5. Implement rate limiting
6. Add authentication/authorization
7. Create admin dashboard
8. Add comprehensive test suite
