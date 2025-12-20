#!/bin/bash

# Start the Load Test Dashboard and Traffic Simulator

echo "🚀 Starting Aviator Load Test Dashboard"
echo "========================================"
echo ""

# Check if services are running
echo "📋 Checking Docker services..."
docker-compose ps | grep -E "(gateway|ledger-worker|bet-resolver|callback)" | grep "Up" > /dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Some services are not running. Starting them..."
    docker-compose up -d
    echo "⏳ Waiting 10 seconds for services to initialize..."
    sleep 10
fi

echo "✅ Backend services are running"
echo ""

# Start the React dashboard in background
echo "🎨 Starting React Dashboard (http://localhost:5173)..."
cd load-test-client
npm run dev &
DASHBOARD_PID=$!
cd ..

echo "⏳ Waiting 5 seconds for dashboard to start..."
sleep 5

echo ""
echo "✅ Dashboard is running at: http://localhost:5173"
echo ""

# Ask user if they want to run traffic simulator
echo "🤖 Do you want to start the traffic simulator?"
echo "   This will create 50 virtual users betting aggressively"
read -p "   Start simulator? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🎲 Starting Traffic Simulator (50 users, aggressive mode)..."
    cd scripts
    node simulate-traffic.js --users 50 --duration 300 &
    SIMULATOR_PID=$!
    cd ..
    
    echo ""
    echo "✅ Traffic simulator is running!"
    echo ""
fi

echo "========================================"
echo "🎯 System is ready!"
echo ""
echo "📊 Dashboard:  http://localhost:5173"
echo "🔧 Gateway:    http://localhost:3000"
echo "📞 Callback:   http://localhost:3001"
echo ""
echo "💡 Tips:"
echo "   - Click 'START AUTO BET' on the dashboard"
echo "   - Watch live bets and chat in real-time"
echo "   - Monitor logs: docker-compose logs -f bet-resolver"
echo ""
echo "Press Ctrl+C to stop all services"
echo "========================================"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping services...'; kill $DASHBOARD_PID 2>/dev/null; kill $SIMULATOR_PID 2>/dev/null; exit 0" INT
wait
