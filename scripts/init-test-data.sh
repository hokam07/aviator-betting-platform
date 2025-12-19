#!/bin/bash

# Initialize test data for the betting system
# This script creates test users with initial balances

set -e

GATEWAY_URL="${GATEWAY_URL:-http://localhost:3000}"
NUM_USERS="${NUM_USERS:-10}"

echo "🔧 Initializing test data..."
echo "Gateway: $GATEWAY_URL"
echo "Number of users: $NUM_USERS"
echo ""

# Function to generate user ID
generate_user_id() {
  local index=$1
  printf "550e8400-e29b-41d4-a716-4466554400%02d" "$index"
}

# Initialize users by placing a small bet (triggers user creation)
for i in $(seq 0 $((NUM_USERS - 1))); do
  USER_ID=$(generate_user_id $i)
  
  echo "Initializing user $USER_ID..."
  
  curl -s -X POST "$GATEWAY_URL/api/bet" \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"$USER_ID\",\"amount\":1,\"game_data\":{\"game\":\"init\"}}" \
    > /dev/null 2>&1 || true
  
  sleep 0.1
done

echo ""
echo "✅ Test data initialization complete!"
echo ""
echo "You can now run load tests with:"
echo "  make load-test"
