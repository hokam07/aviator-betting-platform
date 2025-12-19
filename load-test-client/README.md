# Load Test Client

Simulates multiple concurrent users placing bets on the betting system.

## Installation

```bash
cd load-test-client
npm install
```

## Usage

### Basic test (10 users, 60 seconds)
```bash
npm test
```

### Light load (5 users, 30 seconds)
```bash
npm run test:light
```

### Medium load (20 users, 60 seconds)
```bash
npm run test:medium
```

### Heavy load (50 users, 120 seconds)
```bash
npm run test:heavy
```

### Custom parameters
```bash
node index.js --users 30 --duration 90 --bet-interval 500 --bet-interval-max 3000
```

## Options

- `--users, -u`: Number of concurrent users (default: 10)
- `--duration, -d`: Test duration in seconds (default: 60)
- `--gateway, -g`: Gateway URL (default: http://localhost:3000)
- `--bet-interval, -i`: Minimum bet interval in ms (default: 1000)
- `--bet-interval-max`: Maximum bet interval in ms (default: 5000)

## What it tests

- Concurrent bet placement from multiple users
- Balance updates via WebSocket
- System throughput and latency
- Error handling and insufficient balance scenarios
- Real-time balance synchronization

## Metrics

The test reports:
- Total bets placed
- Successful vs failed bets
- Insufficient balance errors
- Balance updates received via WebSocket
- Throughput (bets/second)
- Success rate
- Error breakdown
