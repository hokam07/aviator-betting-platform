#!/bin/bash

# Health check script for all services

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
CALLBACK_URL="${CALLBACK_URL:-http://localhost:3001}"

echo "🏥 Running health checks..."
echo ""

# Check Gateway
echo -n "Gateway (port 3000): "
if curl -s -f "$GATEWAY_URL/health" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# Check Callback Service
echo -n "Callback Service (port 3001): "
if curl -s -f "$CALLBACK_URL/health" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# Check Kafka
echo -n "Kafka (port 9092): "
if docker exec -it $(docker ps -qf "name=kafka") kafka-topics.sh --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# Check Cassandra
echo -n "Cassandra (port 9042): "
if docker exec -it $(docker ps -qf "name=cassandra") cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

# Check Redis
echo -n "Redis (port 6379): "
if docker exec -it $(docker ps -qf "name=redis") redis-cli ping > /dev/null 2>&1; then
  echo "✅ OK"
else
  echo "❌ FAILED"
fi

echo ""
echo "Health check complete!"
