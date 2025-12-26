-- Optimized Cassandra Schema for High-Scale Betting Platform
-- This schema adds time-bucketed tables for bets and wins to prevent partition hotspots

USE aviator;

-- Bets table with day-level time bucketing for even write distribution
-- Partition key: day_bucket ensures writes are distributed across dates
-- Clustering: created_at DESC for time-series queries
CREATE TABLE IF NOT EXISTS bets_by_day (
    day_bucket text,                      -- Format: YYYY-MM-DD
    bet_id uuid,
    user_id uuid,
    amount decimal,
    game_data text,
    bet_round_id uuid,
    external_tx_id text,
    status text,                          -- 'PENDING', 'CONFIRMED', 'SETTLED'
    created_at timestamp,
    settled_at timestamp,
    PRIMARY KEY ((day_bucket), created_at, bet_id)
) WITH CLUSTERING ORDER BY (created_at DESC, bet_id ASC)
AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}
AND default_time_to_live = 2592000;      -- 30 days TTL

-- Wins table with day-level time bucketing
-- Optimized for high-volume win event writes
CREATE TABLE IF NOT EXISTS wins_by_day (
    day_bucket text,                      -- Format: YYYY-MM-DD
    win_id uuid,
    user_id uuid,
    bet_round_id uuid,
    amount decimal,
    multiplier decimal,
    external_tx_id text,
    created_at timestamp,
    PRIMARY KEY ((day_bucket), created_at, win_id)
) WITH CLUSTERING ORDER BY (created_at DESC, win_id ASC)
AND compaction = {'class': 'TimeWindowCompactionStrategy', 'compaction_window_size': '1', 'compaction_window_unit': 'DAYS'}
AND default_time_to_live = 2592000;      -- 30 days TTL

-- User bets index for quick user-specific queries
-- Secondary index on user_id for bets_by_day
CREATE MATERIALIZED VIEW IF NOT EXISTS bets_by_user AS
    SELECT day_bucket, bet_id, user_id, amount, bet_round_id, created_at, status
    FROM bets_by_day
    WHERE user_id IS NOT NULL AND day_bucket IS NOT NULL AND created_at IS NOT NULL AND bet_id IS NOT NULL
    PRIMARY KEY ((user_id, day_bucket), created_at, bet_id)
    WITH CLUSTERING ORDER BY (created_at DESC, bet_id ASC);

-- User wins index for quick user-specific queries
CREATE MATERIALIZED VIEW IF NOT EXISTS wins_by_user AS
    SELECT day_bucket, win_id, user_id, amount, bet_round_id, created_at
    FROM wins_by_day
    WHERE user_id IS NOT NULL AND day_bucket IS NOT NULL AND created_at IS NOT NULL AND win_id IS NOT NULL
    PRIMARY KEY ((user_id, day_bucket), created_at, win_id)
    WITH CLUSTERING ORDER BY (created_at DESC, win_id ASC);

-- Notes:
-- 1. Time-bucketing by day prevents large partitions (max ~864M bets/day distributed across all days)
-- 2. TimeWindowCompactionStrategy optimizes for time-series data
-- 3. 30-day TTL keeps hot data in Cassandra, older data can be archived to S3
-- 4. Materialized views provide user-specific query performance without duplicating writes
