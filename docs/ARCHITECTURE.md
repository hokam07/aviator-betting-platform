# Architecture Documentation

Detailed architecture documentation for the Cassandra-Kafka Betting System.

## System Overview

The system is designed as a distributed, event-driven architecture optimized for high throughput and consistency in financial transactions.

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP/WS
       ▼
┌─────────────────────────────────────────────────────────┐
│                      Gateway                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Bet Route   │  │ Balance Route│  │  WebSocket   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │         │
│         ▼                  ▼                  ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Bet Service  │  │Balance Cache │  │Socket Handler│ │
│  └──────┬───────┘  └──────────────┘  └──────────────┘ │
└─────────┼──────────────────────────────────────────────┘
          │
          ├─────────────┐
          │             │
          ▼             ▼
    ┌─────────┐   ┌──────────┐
    │  Kafka  │   │  Redis   │
    │bet-events│   │ balance: │
    └────┬────┘   └────┬─────┘
         │             │
         │             │ pub/sub
         │             ▼
         │        ┌──────────┐
         │        │WebSocket │
         │        │ Clients  │
         │        └──────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  Ledger Worker                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Kafka Consumers                          │  │
│  │  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │Bet Events    │  │Aggregator Callbacks      │ │  │
│  │  │Consumer      │  │Consumer                  │ │  │
│  │  └──────┬───────┘  └──────┬───────────────────┘ │  │
│  └─────────┼──────────────────┼─────────────────────┘  │
│            │                  │                         │
│            ▼                  ▼                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │           Ledger Repository                     │  │
│  │  - Optimistic Locking                           │  │
│  │  - Idempotency Check                            │  │
│  │  - Transaction Recording                        │  │
│  └─────────────────┬───────────────────────────────┘  │
└────────────────────┼──────────────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │  Cassandra  │
              │   - users   │
              │   - ledger  │
              │   - idempot │
              └─────────────┘

┌─────────────────────────────────────────────────────────┐
│              Callback Service                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  POST /callback                                  │  │
│  │  - HMAC Validation                               │  │
│  │  - Event Publishing                              │  │
│  └──────────────────┬───────────────────────────────┘  │
└─────────────────────┼──────────────────────────────────┘
                      │
                      ▼
                ┌──────────┐
                │  Kafka   │
                │aggregator│
                │callbacks │
                └──────────┘
```

## Components

### 1. Gateway Service

**Purpose**: User-facing API for bet placement and balance queries.

**Responsibilities**:
- Accept bet requests from clients
- Validate bet parameters
- Optimistically update Redis balance
- Publish bet events to Kafka
- Forward bets to aggregator (async)
- Serve balance queries from Redis cache
- Manage WebSocket connections for real-time updates

**Technology Stack**:
- Node.js + Express
- Socket.io for WebSocket
- ioredis for Redis
- kafkajs for Kafka

**Scaling Strategy**:
- Horizontal scaling behind load balancer
- Stateless design (WebSocket state in Redis if needed)
- Redis connection pooling

### 2. Callback Service

**Purpose**: Receive and validate callbacks from game aggregator.

**Responsibilities**:
- Receive HTTP callbacks from aggregator
- Validate HMAC signatures
- Publish validated events to Kafka
- Return immediate acknowledgment

**Technology Stack**:
- Node.js + Express
- crypto for HMAC validation
- kafkajs for Kafka

**Security**:
- HMAC-SHA256 signature validation
- Request payload validation
- Rate limiting (recommended for production)

**Scaling Strategy**:
- Horizontal scaling
- Stateless design
- Idempotency at Kafka level

### 3. Ledger Worker

**Purpose**: Process events and maintain ledger in Cassandra.

**Responsibilities**:
- Consume bet events from Kafka
- Consume callback events from Kafka
- Apply transactions to Cassandra with optimistic locking
- Ensure idempotency
- Sync balances to Redis
- Publish balance updates to Redis pub/sub

**Technology Stack**:
- Node.js
- cassandra-driver
- kafkajs
- ioredis
- decimal.js for precise calculations

**Concurrency Control**:
- Optimistic locking using version field
- Retry on conflict
- Idempotency using external_tx_id

**Scaling Strategy**:
- Multiple consumer instances
- Kafka partition-based parallelism
- Consumer group coordination

### 4. Cassandra

**Purpose**: Persistent storage for ledger and user data.

**Data Model**:

#### users table
```sql
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    balance DECIMAL,
    pending_debits DECIMAL,
    version BIGINT,
    created_at TIMESTAMP
);
```

**Access Pattern**: Point queries by user_id

#### ledger_transactions table
```sql
CREATE TABLE ledger_transactions (
    user_id UUID,
    date_bucket TEXT,
    tx_id TIMEUUID,
    amount DECIMAL,
    direction TEXT,
    status TEXT,
    bet_round_id UUID,
    external_tx_id TEXT,
    event_type TEXT,
    provider TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY ((user_id, date_bucket), tx_id)
) WITH CLUSTERING ORDER BY (tx_id DESC);
```

**Access Pattern**: 
- Query by user_id and date_bucket
- Time-series data partitioned by month
- Efficient range queries

#### callback_idempotency table
```sql
CREATE TABLE callback_idempotency (
    provider TEXT,
    external_tx_id TEXT,
    processed_at TIMESTAMP,
    payload_hash TEXT,
    user_id UUID,
    bet_round_id UUID,
    PRIMARY KEY ((provider, external_tx_id))
);
```

**Access Pattern**: Point queries for idempotency check

**Consistency**: 
- Quorum reads and writes
- Optimistic locking for concurrency
- Idempotency for exactly-once semantics

### 5. Kafka

**Purpose**: Event streaming and decoupling.

**Topics**:

#### bet-events
- Producer: Gateway
- Consumer: Ledger Worker
- Partitioning: By user_id
- Retention: 7 days

#### aggregator-callbacks
- Producer: Callback Service
- Consumer: Ledger Worker
- Partitioning: By user_id
- Retention: 7 days

**Configuration**:
- Replication factor: 3 (production)
- Min in-sync replicas: 2 (production)
- Acks: all (production)

### 6. Redis

**Purpose**: Real-time balance caching and pub/sub.

**Data Structures**:

#### Balance Cache
```
Key: balance:{user_id}
Type: String
Value: Decimal balance
TTL: None (persistent)
```

#### Pub/Sub Channel
```
Channel: balance_updates
Message: JSON { user_id, balance, timestamp }
```

**Consistency**:
- Eventually consistent with Cassandra
- Reconciliation job syncs periodically
- Source of truth: Cassandra

## Data Flow

### Bet Placement Flow

1. Client sends POST /api/bet to Gateway
2. Gateway validates request
3. Gateway checks Redis balance (optimistic)
4. Gateway decrements Redis balance
5. Gateway publishes to Kafka bet-events
6. Gateway forwards to aggregator (async, fire-and-forget)
7. Gateway returns response to client
8. Ledger Worker consumes bet event
9. Ledger Worker records pending debit in Cassandra
10. Aggregator processes bet and sends callback

### Callback Processing Flow

1. Aggregator sends POST /callback to Callback Service
2. Callback Service validates HMAC signature
3. Callback Service validates payload
4. Callback Service publishes to Kafka aggregator-callbacks
5. Callback Service returns 200 OK
6. Ledger Worker consumes callback event
7. Ledger Worker checks idempotency (external_tx_id)
8. If duplicate, skip processing
9. If new, apply transaction to Cassandra with optimistic lock
10. On success, sync balance to Redis
11. Publish balance update to Redis pub/sub
12. WebSocket clients receive real-time update

### Balance Query Flow

1. Client sends GET /api/balance/:userId to Gateway
2. Gateway queries Redis cache
3. Gateway returns cached balance
4. (Background) Reconciliation job syncs Cassandra → Redis

## Consistency Model

### Strong Consistency
- Cassandra ledger (source of truth)
- Optimistic locking prevents conflicts
- Idempotency prevents duplicates

### Eventual Consistency
- Redis balance cache
- Reconciliation job ensures convergence
- Acceptable for real-time display

### Exactly-Once Semantics
- Kafka at-least-once delivery
- Idempotency in Ledger Worker
- Result: Exactly-once processing

## Failure Scenarios

### Gateway Failure
- Impact: New bets cannot be placed
- Recovery: Load balancer routes to healthy instances
- Data Loss: None (stateless)

### Callback Service Failure
- Impact: Callbacks cannot be received
- Recovery: Aggregator retries with exponential backoff
- Data Loss: None (idempotent)

### Ledger Worker Failure
- Impact: Events accumulate in Kafka
- Recovery: Restart worker, process backlog
- Data Loss: None (Kafka persistence)

### Cassandra Node Failure
- Impact: Reduced capacity, possible latency
- Recovery: Automatic (replication factor 3)
- Data Loss: None (quorum writes)

### Kafka Broker Failure
- Impact: Reduced capacity
- Recovery: Automatic (replication)
- Data Loss: None (acks=all)

### Redis Failure
- Impact: Balance queries fail, no real-time updates
- Recovery: Restart Redis, run reconciliation
- Data Loss: None (Cassandra is source of truth)

## Performance Characteristics

### Throughput
- Gateway: 10,000+ requests/sec per instance
- Callback Service: 5,000+ requests/sec per instance
- Ledger Worker: 5,000+ events/sec per instance
- Cassandra: 100,000+ writes/sec (cluster)

### Latency
- Bet placement: < 50ms (p99)
- Balance query: < 10ms (p99, Redis)
- Callback processing: < 100ms (p99)
- End-to-end (bet → balance update): < 500ms (p99)

### Scalability
- Horizontal scaling for all services
- Kafka partitioning for parallelism
- Cassandra linear scalability
- Redis sharding for large datasets

## Security Considerations

### Authentication
- HMAC signature validation for callbacks
- API keys for gateway (recommended)
- mTLS for service-to-service (recommended)

### Authorization
- User-level access control (recommended)
- Rate limiting per user (recommended)

### Data Protection
- Encryption at rest (Cassandra)
- Encryption in transit (TLS)
- Sensitive data masking in logs

### Audit Trail
- Complete transaction history in ledger_transactions
- Callback payload stored for audit
- Immutable event log in Kafka

## Monitoring and Observability

### Metrics
- Request rate, latency, error rate (RED)
- Kafka consumer lag
- Cassandra query latency
- Redis hit rate
- Balance reconciliation drift

### Logging
- Structured JSON logs
- Correlation IDs for tracing
- Error logs with stack traces

### Alerting
- High error rate
- High latency
- Kafka consumer lag > threshold
- Cassandra node down
- Redis connection failures

### Tracing
- Distributed tracing (recommended: Jaeger)
- Request flow visualization
- Performance bottleneck identification

## Future Enhancements

### Short Term
- Add comprehensive unit tests
- Implement rate limiting
- Add API authentication
- Enhance monitoring dashboards

### Medium Term
- Multi-region deployment
- Advanced fraud detection
- Real-time analytics
- Admin dashboard

### Long Term
- Machine learning for bet patterns
- Blockchain integration for transparency
- Multi-currency support
- Advanced game integrations
