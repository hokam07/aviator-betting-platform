# Cassandra-Kafka Betting System

A high-performance, event-driven betting system with real-time dashboard visualization.

## 🚀 Quick Start

1.  **Start the Services**:
    ```bash
    docker-compose up -d
    ```

2.  **Launch the Dashboard & Traffic Simulator**:
    ```bash
    ./start-dashboard.sh
    ```
    This script starts the React dashboard (Port 5173) and the background traffic simulation.

## 🏗️ Architecture

- **Gateway** (Port 3000): API & WebSocket server.
- **Callback Service** (Port 3001): Webhook receiver for game results.
- **Ledger Worker**: Unified Kafka consumer processing bets and wins.
- **Bet Resolver**: Automated win/loss generator for simulation.

## 🛠️ Key Technical Features

- **Unified Consumer**: Single-group consumption for high-reliability event processing.
- **Redis Sync**: Shared connection pooling for fast real-time balance updates.
- **Live Dashboard**: React-based monitoring of total bets, wins, and chat.
- **Traffic Simulator**: Automated user behavior with random bets and chat messages.

## 🛠️ Common Commands (Makefile)

- `make dashboard` - Start everything.
- `make simulate` - Run the CLI traffic simulator.
- `make test-bet` - Manual test bet.
- `make logs` - View system logs.
- `make clean` - Reset system and database.

## 🧪 Testing

Open the dashboard in your browser to watch real-time metrics, or run the CLI simulator:
```bash
node scripts/simulate-traffic.js --users 50 --duration 60
```

