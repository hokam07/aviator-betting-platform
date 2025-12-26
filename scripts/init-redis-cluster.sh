#!/bin/bash
# Redis Cluster initialization script
# This creates a 6-node cluster with 3 masters and 3 replicas

echo "Waiting for Redis nodes to be ready..."
sleep 5

echo "Creating Redis Cluster..."
docker exec -it redis-1 redis-cli --cluster create \
  redis-1:6379 \
  redis-2:6379 \
  redis-3:6379 \
  redis-4:6379 \
  redis-5:6379 \
  redis-6:6379 \
  --cluster-replicas 1 \
  --cluster-yes

echo "✓ Redis Cluster created successfully!"
echo ""
echo "Cluster Info:"
docker exec -it redis-1 redis-cli cluster info
echo ""
echo "Cluster Nodes:"
docker exec -it redis-1 redis-cli cluster nodes
