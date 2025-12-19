# Makefile for cassandra-sqs-scale project

# Variables
DC=docker-compose
SERVICE_API=api
SERVICE_WORKER=worker
SERVICE_CASSANDRA=cassandra

.PHONY: help build up down logs restart clean init-cassandra

# Default help
help:
	@echo "Makefile commands:"
	@echo "  make build           Build all Docker images"
	@echo "  make up              Start all services in detached mode"
	@echo "  make down            Stop all services"
	@echo "  make logs            Show logs of all services"
	@echo "  make restart         Rebuild and restart all services"
	@echo "  make clean           Remove all containers and volumes"
	@echo "  make init-cassandra  Initialize Cassandra schema"

# Build Docker images
build:
	@echo "🔨 Building Docker images..."
	$(DC) build

# Start all services
up:
	@echo "🚀 Starting all services..."
	$(DC) up -d
	@echo "⏳ Waiting for Cassandra to be ready..."
	@sleep 15
	@make init-cassandra

# Stop all services
down:
	@echo "🛑 Stopping all services..."
	$(DC) down

# Show logs
logs:
	@echo "📜 Showing logs..."
	$(DC) logs -f

# Rebuild and restart
restart:
	@echo "♻️ Restarting all services..."
	$(DC) down
	$(DC) build
	$(DC) up -d
	@echo "⏳ Waiting for Cassandra to be ready..."
	@sleep 15
	@make init-cassandra

# Clean all containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	$(DC) down -v --remove-orphans

# Initialize Cassandra schema
init-cassandra:
	@echo "🔧 Initializing Cassandra schema..."
	@docker exec $(SERVICE_CASSANDRA) cqlsh -e "\
		CREATE KEYSPACE IF NOT EXISTS app_db \
		WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}; \
		USE app_db; \
		CREATE TABLE IF NOT EXISTS events_by_user ( \
			user_id UUID, \
			event_time TIMESTAMP, \
			event_id UUID, \
			event_type TEXT, \
			payload TEXT, \
			PRIMARY KEY (user_id, event_time, event_id) \
		) WITH CLUSTERING ORDER BY (event_time DESC);" \
		&& echo "✅ Cassandra schema initialized!" \
		|| echo "⚠️  Schema initialization failed (may already exist)"