#!/bin/bash

# Cleanup script - removes all containers, volumes, and networks

set -e

echo "🧹 Cleaning up Cassandra-Kafka Betting System..."
echo ""

# Stop all containers
echo "Stopping containers..."
docker-compose down

# Remove volumes
echo "Removing volumes..."
docker-compose down -v

# Remove orphaned containers
echo "Removing orphaned containers..."
docker-compose down --remove-orphans

# Prune unused networks
echo "Pruning unused networks..."
docker network prune -f

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "To start fresh, run: make up"
