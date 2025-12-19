#!/bin/bash

# Real-time monitoring script for the betting system

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
INTERVAL="${INTERVAL:-5}"

echo "📊 Monitoring Betting System"
echo "Gateway: $GATEWAY_URL"
echo "Refresh interval: ${INTERVAL}s"
echo ""
echo "Press Ctrl+C to stop"
echo ""

while true; do
  clear
  echo "═══════════════════════════════════════════════════════════"
  echo "  Betting System Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  
  # Docker stats
  echo "📦 Container Status:"
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "gateway|callback|ledger|kafka|cassandra|redis" || echo "No containers running"
  echo ""
  
  # Kafka topics
  echo "📨 Kafka Topics:"
  docker exec $(docker ps -qf "name=kafka") kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null | grep -E "bet-events|aggregator-callbacks" || echo "Topics not found"
  echo ""
  
  # Redis keys count
  echo "💾 Redis Keys:"
  BALANCE_KEYS=$(docker exec $(docker ps -qf "name=redis") redis-cli --scan --pattern "balance:*" 2>/dev/null | wc -l)
  echo "Balance keys: $BALANCE_KEYS"
  echo ""
  
  # Sample user balance
  echo "👤 Sample User Balance:"
  USER_ID="550e8400-e29b-41d4-a716-446655440000"
  BALANCE=$(curl -s "$GATEWAY_URL/api/balance/$USER_ID" 2>/dev/null | grep -o '"balance":[0-9.]*' | cut -d: -f2)
  if [ -n "$BALANCE" ]; then
    echo "User $USER_ID: $BALANCE"
  else
    echo "Unable to fetch balance"
  fi
  echo ""
  
  echo "═══════════════════════════════════════════════════════════"
  echo "Next update in ${INTERVAL}s..."
  
  sleep $INTERVAL
done
