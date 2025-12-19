# Contributing Guide

Thank you for considering contributing to the Cassandra-Kafka Betting System!

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
```bash
git clone https://github.com/your-username/cassandra-kafka-betting.git
cd cassandra-kafka-betting
```

3. Start services:
```bash
make up
```

4. Wait for services to initialize (30-60 seconds)

5. Verify everything works:
```bash
make health
make test-bet
```

## Development Workflow

### Running in Development Mode

Use the development docker-compose override for hot-reloading:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Making Changes

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes

3. Test your changes:
```bash
make test-bet
make test-callback
make load-test-light
```

4. Check logs for errors:
```bash
make logs
```

5. Commit your changes:
```bash
git add .
git commit -m "feat: add your feature description"
```

6. Push to your fork:
```bash
git push origin feature/your-feature-name
```

7. Create a Pull Request

## Code Style

### JavaScript

- Use 2 spaces for indentation
- Use single quotes for strings
- Use semicolons
- Follow ESLint rules (see `.eslintrc.json`)
- Format with Prettier (see `.prettierrc`)

### Commit Messages

Follow conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add balance reconciliation service
fix: handle race condition in bet placement
docs: update API documentation
refactor: simplify ledger repository
test: add integration tests for callbacks
chore: update dependencies
```

## Project Structure

```
.
├── gateway/              # User-facing API
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── services/    # Business logic
│   │   └── ws/          # WebSocket handlers
│   └── Dockerfile
├── callback/            # Callback receiver
│   ├── src/
│   │   ├── routes/      # Callback routes
│   │   └── services/    # HMAC validation, event publishing
│   └── Dockerfile
├── ledger-worker/       # Kafka consumer
│   ├── src/
│   │   ├── cassandra/   # Database client
│   │   ├── consumer/    # Kafka consumers
│   │   ├── repo/        # Data access layer
│   │   └── services/    # Business logic
│   └── Dockerfile
├── load-test-client/    # Load testing tool
├── scripts/             # Utility scripts
└── cassandra-init/      # Database schema
```

## Adding New Features

### Adding a New API Endpoint

1. Add route in `gateway/src/routes/` or `callback/src/routes/`
2. Add business logic in `services/`
3. Update API documentation in `API.md`
4. Add tests

Example:
```javascript
// gateway/src/routes/transaction.route.js
const express = require('express');
const router = express.Router();

router.get('/transactions/:userId', async (req, res) => {
  try {
    const transactions = await getTransactions(req.params.userId);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

### Adding a New Kafka Consumer

1. Create consumer in `ledger-worker/src/consumer/`
2. Add consumer to `worker.js`
3. Handle events in appropriate service

Example:
```javascript
// ledger-worker/src/consumer/new.events.consumer.js
const { Kafka } = require('kafkajs');

async function startNewEventsConsumer() {
  const kafka = new Kafka({
    clientId: 'ledger-worker',
    brokers: [process.env.KAFKA_BROKER]
  });

  const consumer = kafka.consumer({ groupId: 'new-events-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'new-events', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      await handleNewEvent(event);
    }
  });
}

module.exports = { startNewEventsConsumer };
```

### Adding a New Database Table

1. Update schema in `cassandra-init/schema.cql`
2. Add queries in appropriate repository
3. Update data model documentation

Example:
```sql
-- cassandra-init/schema.cql
CREATE TABLE IF NOT EXISTS user_sessions (
    user_id UUID,
    session_id UUID,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    PRIMARY KEY (user_id, session_id)
);
```

## Testing

### Manual Testing

```bash
# Test bet placement
make test-bet

# Test callback
make test-callback

# Run load test
make load-test-light
```

### Integration Testing

See `TESTING.md` for comprehensive testing guide.

### Load Testing

```bash
# Light load
make load-test-light

# Medium load
make load-test-medium

# Heavy load
make load-test-heavy
```

## Debugging

### View Logs

```bash
# All services
make logs

# Specific service
docker-compose logs -f gateway
docker-compose logs -f callback
docker-compose logs -f ledger-worker
```

### Monitor System

```bash
make monitor
```

### Check Database

```bash
# Cassandra
docker exec -it $(docker ps -qf "name=cassandra") cqlsh
cqlsh> USE betting_ledger;
cqlsh:betting_ledger> SELECT * FROM users;

# Redis
docker exec -it $(docker ps -qf "name=redis") redis-cli
> KEYS *
> GET balance:550e8400-e29b-41d4-a716-446655440000

# Kafka
docker exec $(docker ps -qf "name=kafka") kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic bet-events \
  --from-beginning
```

## Common Issues

### Services not starting

- Wait 30-60 seconds for Kafka and Cassandra to initialize
- Check logs: `make logs`
- Restart: `make restart`

### Port conflicts

- Check if ports 3000, 3001, 9042, 9092, 6379 are available
- Stop conflicting services or change ports in `docker-compose.yml`

### Database connection errors

- Ensure Cassandra is fully initialized
- Check schema: `docker exec -it $(docker ps -qf "name=cassandra") cqlsh -e "DESCRIBE KEYSPACE betting_ledger"`

## Documentation

When adding features, update:

- `README.md` - Overview and quick start
- `API.md` - API endpoints
- `TESTING.md` - Testing procedures
- `SYSTEM_OVERVIEW.md` - Architecture details
- Code comments

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add description of changes
4. Reference any related issues
5. Request review from maintainers

## Code Review Guidelines

Reviewers should check:

- Code follows style guidelines
- Tests are included
- Documentation is updated
- No security vulnerabilities
- Performance considerations
- Error handling is appropriate

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues and documentation first

Thank you for contributing! 🎉
