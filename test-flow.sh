#!/bin/bash

USER_ID="550e8400-e29b-41d4-a716-446655440000"

echo "=== Testing Betting System Flow ==="
echo ""

echo "1. Setting initial balance to 1000..."
docker exec redis redis-cli SET "balance:${USER_ID}" 1000
echo ""

echo "2. Checking initial balance..."
curl -s http://localhost:3000/api/balance/${USER_ID} | jq
echo ""

echo "3. Placing bet of 100..."
BET_RESPONSE=$(curl -s -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"${USER_ID}\",\"amount\":100,\"game_data\":{\"game\":\"aviator\"}}")
echo $BET_RESPONSE | jq
BET_ROUND_ID=$(echo $BET_RESPONSE | jq -r '.bet_round_id')
echo ""

echo "4. Checking balance after bet (should be 900)..."
curl -s http://localhost:3000/api/balance/${USER_ID} | jq
echo ""

echo "5. Simulating win callback (amount: 500)..."
curl -s -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d "{\"type\":\"win\",\"external_tx_id\":\"win-$(date +%s)\",\"user_id\":\"${USER_ID}\",\"bet_round_id\":\"${BET_ROUND_ID}\",\"amount\":500}" | jq
echo ""

echo "6. Waiting for ledger processing..."
sleep 3
echo ""

echo "7. Final balance check..."
curl -s http://localhost:3000/api/balance/${USER_ID} | jq
echo ""

echo "=== Test Complete ==="
