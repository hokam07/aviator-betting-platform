# ========================
# CONFIG
# ========================

KAFKA_BIN=/usr/bin
CASSANDRA_CONTAINER=cassandra
KAFKA_CONTAINER=kafka

# Environment (local by default)
ENV ?= local
COMPOSE_FILE = docker-compose.yml
COMPOSE_CMD = docker-compose -f $(COMPOSE_FILE)

.PHONY: \
	help up down build logs restart clean \
	local-up local-down local-logs local-clean \
	prod-up prod-down prod-logs \
	dashboard simulate simulate-high \
	test-bet test-callback \
	cassandra-init cassandra-status cassandra-shell \
	kafka-topics kafka-status kafka-consume \
	scale-gateway scale-workers \
	prometheus grafana \
	status

# ========================
# HELP
# ========================

help:
	@echo ""
	@echo "Environment:"
	@echo "  ENV=local (default) or ENV=prod"
	@echo ""
	@echo "Core Commands:"
	@echo "  make up              - Start containers (uses ENV)"
	@echo "  make down            - Stop containers"
	@echo "  make logs            - Follow logs"
	@echo "  make clean           - Remove containers + volumes"
	@echo "  make status          - Show running containers and ports"
	@echo ""
	@echo "Local Development:"
	@echo "  make local-up        - Start with development settings"
	@echo "  make local-down      - Stop local stack"
	@echo "  make local-logs      - Follow local logs"
	@echo "  make local-clean     - Full clean for local"
	@echo ""
	@echo "Production Simulation:"
	@echo "  make prod-up         - Start with production-like settings (no volume mounts, no ports conflict)"
	@echo "  make prod-down       - Stop production stack"
	@echo "  make prod-logs       - Follow production logs"
	@echo ""
	@echo "Application:"
	@echo "  make dashboard       - Start React Dashboard & Simulator"
	@echo "  make simulate        - Run moderate traffic simulation (2000 users)"
	@echo "  make simulate-high   - Run high load simulation (5000 users)"
	@echo ""
	@echo "Testing:"
	@echo "  make test-bet        - Place a manual test bet"
	@echo "  make test-callback   - Send a manual test callback"
	@echo ""
	@echo "Infra Tools:"
	@echo "  make cassandra-init     - Apply schema"
	@echo "  make cassandra-status   - Show keyspaces"
	@echo "  make cassandra-shell    - Open cqlsh"
	@echo "  make kafka-topics       - Create required topics"
	@echo "  make kafka-status       - List topics"
	@echo "  make kafka-consume      - Consume from a topic (interactive)"
	@echo ""
	@echo "Scaling:"
	@echo "  make scale-gateway N=5  - Scale gateway to N replicas"
	@echo "  make scale-workers N=6  - Scale ledger + game engine workers"
	@echo ""
	@echo "Monitoring:"
	@echo "  make prometheus      - Open Prometheus UI"
	@echo "  make grafana         - Open Grafana UI"
	@echo ""

# ========================
# CORE (ENV-AWARE)
# ========================

up: $(ENV)-up

down: $(ENV)-down

logs: $(ENV)-logs

clean: $(ENV)-clean

status:
	@$(COMPOSE_CMD) ps

# ========================
# LOCAL DEVELOPMENT
# ========================

local-up:
	$(COMPOSE_CMD) up -d

local-down:
	$(COMPOSE_CMD) down

local-logs:
	$(COMPOSE_CMD) logs -f

local-clean:
	$(COMPOSE_CMD) down -v
	docker system prune -f

# ========================
# PRODUCTION SIMULATION (No host ports on scaled services, no volume mounts)
# ========================

prod-up:
	@echo "Starting production-like stack (no host port conflicts, suitable for scaling)..."
	$(COMPOSE_CMD) up -d --scale gateway=5 --scale ledger-worker=4 --scale game-engine=6

prod-down:
	$(COMPOSE_CMD) down

prod-logs:
	$(COMPOSE_CMD) logs -f

# ========================
# APPLICATION
# ========================

dashboard:
	./start-dashboard.sh

simulate:
	cd scripts && node simulate-traffic.js --users 2000 --duration 60

simulate-high:
	cd scripts && node simulate-traffic.js --users 5000 --duration 120

# ========================
# TESTING
# ========================

test-bet:
	curl -X POST http://localhost:3000/api/bet \
		-H "Content-Type: application/json" \
		-d '{"user_id":"11111111-1111-1111-1111-111111111111","amount":10,"game_data":{"game":"aviator"}}'

test-callback:
	curl -X POST http://localhost:3001/callback \
		-H "Content-Type: application/json" \
		-H "x-signature: dummy" \
		-d '{"type":"win","external_tx_id":"test-$$(date +%s)","user_id":"11111111-1111-1111-1111-111111111111","bet_round_id":"manual-round","amount":50}'

# ========================
# INFRA
# ========================

cassandra-init:
	@docker exec -i $(CASSANDRA_CONTAINER) cqlsh < ledger-worker/db/schema.cql
	@echo "✓ Cassandra schema applied"

cassandra-status:
	@docker exec $(CASSANDRA_CONTAINER) cqlsh -e "DESCRIBE KEYSPACES"

cassandra-shell:
	@docker exec -it $(CASSANDRA_CONTAINER) cqlsh

kafka-topics:
	@echo "Creating Kafka topics..."
	@docker exec $(KAFKA_CONTAINER) kafka-topics \
		--bootstrap-server kafka:9093 \
		--create --if-not-exists \
		--topic bet-events \
		--partitions 50 \
		--replication-factor 1 \
		--config retention.ms=604800000
	@docker exec $(KAFKA_CONTAINER) kafka-topics \
		--bootstrap-server kafka:9093 \
		--create --if-not-exists \
		--topic aggregator-callbacks \
		--partitions 50 \
		--replication-factor 1 \
		--config retention.ms=604800000
	@echo "✓ Kafka topics ready"

kafka-status:
	@docker exec $(KAFKA_CONTAINER) kafka-topics \
		--bootstrap-server kafka:9093 --list

kafka-consume:
	@echo "Consuming from bet-events topic (Ctrl+C to stop)..."
	@docker exec -it $(KAFKA_CONTAINER) $(KAFKA_BIN)/kafka-console-consumer.sh \
		--bootstrap-server kafka:9093 \
		--topic bet-events \
		--from-beginning

# ========================
# SCALING
# ========================

scale-gateway:
	@echo "Scaling gateway to $(N) replicas..."
	$(COMPOSE_CMD) up -d --scale gateway=$(N) gateway

scale-workers:
	@echo "Scaling workers to $(N) replicas..."
	$(COMPOSE_CMD) up -d --scale ledger-worker=$(N) --scale game-engine=$(N)

# ========================
# MONITORING
# ========================

prometheus:
	open http://localhost:9090

grafana:
	open http://localhost:3100

# ========================
# LOCAL DEVELOPMENT (using docker-compose.dev.yml)
# ========================

dev-up:
	@echo "Starting development stack (hot-reload, exposed ports)..."
	docker-compose -f docker-compose.dev.yml up -d

dev-down:
	docker-compose -f docker-compose.dev.yml down

dev-logs:
	docker-compose -f docker-compose.dev.yml logs -f

dev-build:
	docker-compose -f docker-compose.dev.yml build

dev-restart:
	docker-compose -f docker-compose.dev.yml restart

dev-clean:
	docker-compose -f docker-compose.dev.yml down -v

dev-status:
	docker-compose -f docker-compose.dev.yml ps

dev-scale-gateway:
	@echo "Scaling gateway to $(N) replicas in dev mode..."
	docker-compose -f docker-compose.dev.yml up -d --scale gateway=$(N) gateway

dev-scale-workers:
	@echo "Scaling workers in dev mode..."
	docker-compose -f docker-compose.dev.yml up -d --scale ledger-worker=$(N) --scale game-engine=$(N)

# ========================
# QUICK ALIASES
# ========================

dev: dev-up dev-logs
	@echo "Development stack is running. Edit code — changes will reload automatically."

dev-stop: dev-down

# ========================
# INTERNAL HELPERS
# ========================

define wait_for_container
	@echo "⏳ Waiting for $(1) to be ready..."
	@until docker inspect --format='{{.State.Health.Status}}' $(1) 2>/dev/null | grep -q healthy; do \
		sleep 5; \
	done
	@echo "✅ $(1) is healthy"
endef

define check_failures
	@FAILED=$$($(COMPOSE_CMD) ps --services --filter "status=exited"); \
	if [ -n "$$FAILED" ]; then \
		echo "❌ Some services failed:"; \
		echo "$$FAILED"; \
		echo "📄 Showing last logs:"; \
		$(COMPOSE_CMD) logs --tail=50 $$FAILED; \
		exit 1; \
	else \
		echo "✅ All services running"; \
	fi
endef

define wait_for_cassandra_cql
	@echo "⏳ Waiting for Cassandra CQL (9042)..."
	@until docker exec $(CASSANDRA_CONTAINER) cqlsh -e "DESCRIBE KEYSPACES" >/dev/null 2>&1; do \
		sleep 3; \
	done
	@echo "✅ Cassandra CQL is ready"
endef


# ========================
# BOOTSTRAP (UP + INIT + VERIFY)
# ========================

bootstrap:
	@echo "🚀 Starting full system bootstrap (ENV=$(ENV))..."
	@$(MAKE) up

	$(call wait_for_container,$(CASSANDRA_CONTAINER))
	$(call wait_for_cassandra_cql)

	@echo "🧱 Initializing Cassandra schema..."
	@$(MAKE) cassandra-init

	@echo "📦 Creating Kafka topics..."
	@$(MAKE) kafka-topics

	@echo "� Installing simulation dependencies..."
	@cd scripts && npm install
	@echo "📦 Installing dashboard dependencies..."
	@cd load-test-client && npm install

	@echo "�📊 Final system status:"
	@$(MAKE) status

	$(call check_failures)

	@echo ""
	@echo "🎉 SYSTEM READY"
