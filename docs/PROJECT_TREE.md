# Project Structure

Complete file tree for the Cassandra-Kafka Betting System.

```
cassandra-kafka-betting-system/
│
├── 📁 callback/                          # Callback Service
│   ├── 📁 src/
│   │   ├── 📁 routes/
│   │   │   └── callback.route.js         # Callback endpoint
│   │   ├── 📁 services/
│   │   │   ├── event.publisher.js        # Kafka publisher
│   │   │   └── hmac.validator.js         # HMAC validation
│   │   ├── app.js                        # Express app
│   │   └── server.js                     # Server entry point
│   ├── Dockerfile                        # Container image
│   ├── package.json                      # Dependencies
│   └── package-lock.json
│
├── 📁 gateway/                           # Gateway Service
│   ├── 📁 src/
│   │   ├── 📁 routes/
│   │   │   └── bet.route.js              # Bet & balance endpoints
│   │   ├── 📁 services/
│   │   │   ├── aggregator.client.js      # Aggregator integration
│   │   │   ├── bet.service.js            # Bet logic
│   │   │   └── event.publisher.js        # Kafka publisher
│   │   ├── 📁 ws/
│   │   │   └── socket.handler.js         # WebSocket handler
│   │   ├── app.js                        # Express app
│   │   └── server.js                     # Server entry point
│   ├── Dockerfile                        # Container image
│   ├── package.json                      # Dependencies
│   └── package-lock.json
│
├── 📁 ledger-worker/                     # Ledger Worker Service
│   ├── 📁 src/
│   │   ├── 📁 cassandra/
│   │   │   ├── client.js                 # Cassandra client
│   │   │   └── schema.cql                # Schema backup
│   │   ├── 📁 consumer/
│   │   │   ├── aggregator.events.consumer.js  # Callback consumer
│   │   │   └── bet.events.consumer.js    # Bet consumer
│   │   ├── 📁 repo/
│   │   │   └── ledger.repo.js            # Data access layer
│   │   ├── 📁 services/
│   │   │   ├── balance.sync.js           # Redis sync
│   │   │   ├── reconciliation.service.js # Balance reconciliation
│   │   │   └── wallet.service.js         # Wallet management
│   │   └── worker.js                     # Worker entry point
│   ├── Dockerfile                        # Container image
│   ├── package.json                      # Dependencies
│   └── package-lock.json
│
├── 📁 load-test-client/                  # Load Testing Tool
│   ├── index.js                          # Main test runner
│   ├── init-users.js                     # User initialization
│   ├── package.json                      # Dependencies
│   └── README.md                         # Load test docs
│
├── 📁 cassandra-init/                    # Database Schema
│   └── schema.cql                        # Cassandra schema
│
├── 📁 scripts/                           # Utility Scripts
│   ├── backup-cassandra.sh               # Backup database
│   ├── cleanup.sh                        # Clean up system
│   ├── health-check.sh                   # Health monitoring
│   ├── init-test-data.sh                 # Initialize test data
│   ├── monitor.sh                        # Real-time monitoring
│   └── quick-start.sh                    # Automated setup
│
├── 📄 .dockerignore                      # Docker exclusions
├── 📄 .editorconfig                      # Editor configuration
├── 📄 .env                               # Environment variables
├── 📄 .eslintrc.json                     # Linting rules
├── 📄 .gitignore                         # Git exclusions
├── 📄 .nvmrc                             # Node version
├── 📄 .prettierignore                    # Prettier exclusions
├── 📄 .prettierrc                        # Code formatting
│
├── 📄 docker-compose.yml                 # Production orchestration
├── 📄 docker-compose.dev.yml             # Development overrides
│
├── 📄 Makefile                           # Build automation (15+ commands)
├── 📄 LICENSE                            # MIT License
├── 📄 test-flow.sh                       # Flow testing script
│
├── 📚 README.md                          # Project overview & quick start
├── 📚 API.md                             # Complete API reference
├── 📚 TESTING.md                         # Testing guide
├── 📚 ARCHITECTURE.md                    # Architecture documentation
├── 📚 CONTRIBUTING.md                    # Contributing guidelines
├── 📚 SYSTEM_OVERVIEW.md                 # System design overview
├── 📚 PROJECT_SUMMARY.md                 # Project summary
├── 📚 QUICK_REFERENCE.md                 # Quick reference card
├── 📚 CHANGELOG.md                       # Version history
├── 📚 COMPLETION_SUMMARY.md              # Completion status
└── 📚 PROJECT_TREE.md                    # This file
```

## File Count Summary

### Source Code
- **JavaScript Files**: 22 files
  - Gateway: 7 files
  - Callback: 5 files
  - Ledger Worker: 10 files

### Documentation
- **Markdown Files**: 11 files
  - User docs: 5 files
  - Developer docs: 3 files
  - Reference docs: 3 files

### Configuration
- **Config Files**: 10 files
  - Docker: 5 files
  - Code quality: 3 files
  - Environment: 2 files

### Scripts
- **Shell Scripts**: 7 files
  - Setup: 2 files
  - Monitoring: 2 files
  - Utilities: 3 files

### Build & Deployment
- **Build Files**: 5 files
  - Dockerfiles: 3 files
  - Docker Compose: 2 files
  - Makefile: 1 file

## Total Files: ~55 files

## Key Directories

### `/callback`
Receives and validates callbacks from game aggregator. Publishes validated events to Kafka.

### `/gateway`
User-facing API for bet placement and balance queries. WebSocket server for real-time updates.

### `/ledger-worker`
Kafka consumer that processes events and maintains ledger in Cassandra. Syncs balances to Redis.

### `/load-test-client`
Load testing tool that simulates concurrent users placing bets and receiving balance updates.

### `/scripts`
Utility scripts for setup, monitoring, testing, and maintenance.

### `/cassandra-init`
Database schema initialization for Cassandra.

## Documentation Structure

### Getting Started
- README.md - Start here
- QUICK_REFERENCE.md - Quick commands
- test-flow.sh - Test the system

### API & Testing
- API.md - API reference
- TESTING.md - Testing procedures

### Architecture & Design
- ARCHITECTURE.md - Detailed architecture
- SYSTEM_OVERVIEW.md - System design

### Development
- CONTRIBUTING.md - Development guide
- CHANGELOG.md - Version history

### Project Info
- PROJECT_SUMMARY.md - Project overview
- COMPLETION_SUMMARY.md - Completion status
- PROJECT_TREE.md - This file

## Service Dependencies

```
Gateway
├── Express.js
├── Socket.io
├── ioredis
├── kafkajs
└── axios

Callback
├── Express.js
├── crypto (HMAC)
└── kafkajs

Ledger Worker
├── cassandra-driver
├── kafkajs
├── ioredis
└── decimal.js

Load Test Client
├── axios
├── socket.io-client
├── yargs
└── chalk
```

## Infrastructure Stack

```
Application Layer
├── Gateway (Node.js)
├── Callback (Node.js)
└── Ledger Worker (Node.js)

Data Layer
├── Cassandra (Persistent storage)
├── Redis (Cache & pub/sub)
└── Kafka (Event streaming)

Support
└── Zookeeper (Kafka coordination)
```

## Port Mapping

| Service | Port | Purpose |
|---------|------|---------|
| Gateway | 3000 | REST API & WebSocket |
| Callback | 3001 | Callback receiver |
| Cassandra | 9042 | Database |
| Kafka | 9092 | Event streaming |
| Redis | 6379 | Cache & pub/sub |
| Zookeeper | 2181 | Coordination |

## Environment Files

- `.env` - Environment variables
- `docker-compose.yml` - Production config
- `docker-compose.dev.yml` - Development config

## Build Files

- `Makefile` - Build automation
- `Dockerfile` (x3) - Container images
- `package.json` (x4) - Node dependencies

## Quality Files

- `.eslintrc.json` - Linting
- `.prettierrc` - Formatting
- `.editorconfig` - Editor settings

## Ignore Files

- `.gitignore` - Git exclusions
- `.dockerignore` - Docker exclusions
- `.prettierignore` - Prettier exclusions

## Navigation Tips

### For Users
1. Start with README.md
2. Use QUICK_REFERENCE.md for commands
3. Check API.md for endpoints
4. See TESTING.md for testing

### For Developers
1. Read CONTRIBUTING.md
2. Review ARCHITECTURE.md
3. Check source code in `/src` folders
4. Use docker-compose.dev.yml for development

### For Operations
1. Use scripts/ for utilities
2. Check docker-compose.yml for config
3. Review ARCHITECTURE.md for scaling
4. Use Makefile for common tasks

---

**Navigate the project with confidence!** 🗺️
