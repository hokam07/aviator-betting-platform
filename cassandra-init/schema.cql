CREATE KEYSPACE IF NOT EXISTS aviator
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
AND durable_writes = true;

USE aviator;

// Users table: Core user data, balances (no STATIC since no clustering)
CREATE TABLE users (
    user_id uuid PRIMARY KEY,
    balance decimal,
    pending_debits decimal,
    version int,
    max_bet_amount decimal,
    daily_bet_limit decimal,
    fraud_risk_level text,
    last_activity timestamp,
    created_at timestamp
);

// Ledger transactions: Immutable append-only audit trail
CREATE TABLE ledger_transactions (
    user_id uuid,
    date_bucket text,                     // e.g., '2025-12'
    tx_id timeuuid,
    amount decimal,
    direction text,                       // 'DEBIT', 'CREDIT'
    status text,                          // 'PENDING', 'CONFIRMED', 'FAILED'
    bet_round_id uuid,
    external_tx_id text,
    event_type text,                      // 'bet', 'win', 'loss', 'rollback'
    provider text,
    ip_address text,
    device_id text,
    notes text,
    created_at timestamp,
    PRIMARY KEY ((user_id, date_bucket), tx_id)
) WITH CLUSTERING ORDER BY (tx_id DESC)
AND compaction = {'class': 'TimeWindowCompactionStrategy'};

// Idempotency guard
CREATE TABLE callback_idempotency (
    provider text,
    external_tx_id text,
    processed_at timestamp,
    payload_hash text,
    user_id uuid,
    bet_round_id uuid,
    PRIMARY KEY (provider, external_tx_id)
);

CREATE INDEX idx_idempotency_user ON callback_idempotency (user_id);

// Pending bets
CREATE TABLE pending_bets (
    user_id uuid,
    bet_round_id uuid,
    amount decimal,
    placed_at timestamp,
    external_tx_id text,
    status text,
    aggregator_response text,
    PRIMARY KEY (user_id, bet_round_id)
) WITH default_time_to_live = 3600;

// Game rounds (optional)
CREATE TABLE game_rounds (
    round_id uuid PRIMARY KEY,
    start_time timestamp,
    end_time timestamp,
    crash_point decimal,
    multiplier decimal,
    status text
);

// Fraud logs
CREATE TABLE fraud_logs (
    user_id uuid,
    event_time timeuuid,
    event_type text,
    details text,
    severity text,
    PRIMARY KEY (user_id, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);

// Analytics counters
CREATE TABLE analytics_counters (
    metric_date text,
    metric_type text,
    counter counter,
    PRIMARY KEY (metric_date, metric_type)
);

// Chat keyspace (decoupled)
CREATE KEYSPACE IF NOT EXISTS chat
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE chat;

CREATE TABLE messages (
    room_id uuid,
    msg_id timeuuid,
    user_id uuid,
    content text,
    sent_at timestamp,
    PRIMARY KEY (room_id, msg_id)
) WITH CLUSTERING ORDER BY (msg_id DESC)
AND default_time_to_live = 86400;