#!/bin/bash

# Quick start script for the betting system

set -e

echo "🚀 Cassandra-Kafka Betting System - Quick Start"
echo "================================================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

echo "✅ Docker is running"
echo ""

# Start services
echo "📦 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to initialize (this may take 30-60 seconds)..."
echo ""

# Wait for services
sleep 10

# Check Cassandra
echo -n "Checking Cassandra... "
for i in {1..30}; do
  if docker exec $(docker ps -qf "name=cassandra") cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; then
    echo "✅"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "❌ Timeout"
    exit 1
  fi
done

# Check Kafka
echo -n "Checking Kafka... "
for i in {1..30}; do
  if docker exec $(docker ps -qf "name=kafka") kafka-topics.sh --bootstrap-server localhost:9093 --list > /dev/null 2>&1; then
    echo "✅"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "❌ Timeout"
    exit 1
  fi
done

# Check Redis
echo -n "Checking Redis... "
if docker exec $(docker ps -qf "name=redis") redis-cli ping > /dev/null 2>&1; then
  echo "✅"
else
  echo "❌"
  exit 1
fi

# Check Gateway
echo -n "Checking Gateway... "
for i in {1..30}; do
  if curl -s -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "❌ Timeout"
    exit 1
  fi
done

# Check Callback Service
echo -n "Checking Callback Service... "
for i in {1..30}; do
  if curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅"
    break
  fi
  sleep 2
  if [ $i -eq 30 ]; then
    echo "❌ Timeout"
    exit 1
  fi
done

echo ""
echo "================================================"
echo "✅ All services are running!"
echo "================================================"
echo ""
echo "📍 Service URLs:"
echo "   Gateway:          http://localhost:3000"
echo "   Callback Service: http://localhost:3001"
echo ""
echo "🧪 Try these commands:"
echo "   make test-bet       - Place a test bet"
echo "   make test-callback  - Send a test callback"
echo "   make monitor        - Monitor system in real-time"
echo "   make logs           - View service logs"
echo ""
echo "📚 Documentation:"
echo "   README.md     - Overview and quick start"
echo "   API.md        - API documentation"
echo "   TESTING.md    - Testing guide"
echo ""
echo "Happy betting! 🎰"
