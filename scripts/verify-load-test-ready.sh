#!/bin/bash

echo "=== Verifying System Ready for Load Testing ==="
echo ""

# Check if services are running
echo "1. Checking Docker services..."
SERVICES=("redis" "kafka" "cassandra" "gateway" "ledger-worker" "callback")
ALL_RUNNING=true

for service in "${SERVICES[@]}"; do
    if docker ps | grep -q "$service"; then
        echo "  ✓ $service is running"
    else
        echo "  ✗ $service is NOT running"
        ALL_RUNNING=false
    fi
done
echo ""

if [ "$ALL_RUNNING" = false ]; then
    echo "❌ Not all services are running. Start them with: make dev"
    exit 1
fi

# Check Kafka topics
echo "2. Checking Kafka topics..."
TOPICS=$(docker exec kafka kafka-topics.sh --bootstrap-server localhost:9093 --list 2>/dev/null)
if echo "$TOPICS" | grep -q "bet-events" && echo "$TOPICS" | grep -q "aggregator-callbacks"; then
    echo "  ✓ Required Kafka topics exist"
else
    echo "  ✗ Missing Kafka topics"
    echo "  Run: make kafka-topics"
fi
echo ""

# Check Cassandra schema
echo "3. Checking Cassandra schema..."
KEYSPACE=$(docker exec cassandra cqlsh -e "DESCRIBE KEYSPACES;" 2>/dev/null | grep betting_ledger)
if [ -n "$KEYSPACE" ]; then
    echo "  ✓ Cassandra schema exists"
else
    echo "  ✗ Cassandra schema not found"
    echo "  Wait for cassandra-init to complete or run schema manually"
fi
echo ""

# Check Redis connectivity
echo "4. Checking Redis..."
if docker exec redis redis-cli PING 2>/dev/null | grep -q "PONG"; then
    echo "  ✓ Redis is responding"
else
    echo "  ✗ Redis is not responding"
fi
echo ""

# Check Gateway API
echo "5. Checking Gateway API..."
if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✓ Gateway API is accessible"
else
    echo "  ⚠ Gateway health check failed (may not have /health endpoint)"
    # Try balance endpoint as fallback
    if curl -s -f http://localhost:3000/api/balance/test-user > /dev/null 2>&1; then
        echo "  ✓ Gateway API is accessible (via balance endpoint)"
    else
        echo "  ✗ Gateway API is not accessible"
    fi
fi
echo ""

# Check Callback service
echo "6. Checking Callback service..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "  ✓ Callback service is accessible"
else
    echo "  ⚠ Callback health check failed (may not have /health endpoint)"
fi
echo ""

# Check Kafka consumer groups
echo "7. Checking Kafka consumers..."
CONSUMER_GROUPS=$(docker exec kafka kafka-consumer-groups.sh --bootstrap-server localhost:9093 --list 2>/dev/null)
if echo "$CONSUMER_GROUPS" | grep -q "ledger-group"; then
    echo "  ✓ ledger-group consumer is registered"
    
    # Check lag
    LAG=$(docker exec kafka kafka-consumer-groups.sh --bootstrap-server localhost:9093 --group ledger-group --describe 2>/dev/null | grep -v "TOPIC" | awk '{sum+=$5} END {print sum}')
    if [ -n "$LAG" ] && [ "$LAG" -eq 0 ]; then
        echo "  ✓ No consumer lag"
    elif [ -n "$LAG" ]; then
        echo "  ⚠ Consumer lag: $LAG messages"
    fi
else
    echo "  ⚠ ledger-group consumer not yet registered (will register on first message)"
fi
echo ""

echo "=== System Status ==="
if [ "$ALL_RUNNING" = true ]; then
    echo "✅ System is ready for load testing!"
    echo ""
    echo "Run load test with:"
    echo "  cd load-test-client && node index.js --users 10 --duration 60"
else
    echo "❌ System is NOT ready. Fix the issues above first."
fi
