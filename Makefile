# ========================
# CONFIG
# ========================

KAFKA_BIN=/usr/bin
CASSANDRA_CONTAINER=cassandra
KAFKA_CONTAINER=kafka

.PHONY: \
	help up down build logs restart clean \
	setup wait-services init-all \
	test-bet test-callback test-all \
	load-test-setup load-test load-test-light load-test-medium load-test-heavy \
	health monitor init-data \
	cassandra-init cassandra-status \
	kafka-topics kafka-status

# ========================
# HELP
# ========================

help:
	@echo ""
	@echo "Service:"
	@echo "  make up              - Start containers only"
	@echo "  make down            - Stop containers"
	@echo "  make logs            - Follow logs"
	@echo "  make clean           - Remove containers + volumes"
	@echo ""
	@echo "Setup:"
	@echo "  make setup           - FULL setup (ready to test)"
	@echo ""
	@echo "Testing:"
	@echo "  make test-all"
	@echo ""
	@echo "Infra:"
	@echo "  make cassandra-status"
	@echo "  make kafka-status"
	@echo ""

# ========================
# CORE
# ========================

up:
	docker-compose up -d

down:
	docker-compose down

build:
	docker-compose build

logs:
	docker-compose logs -f

restart:
	docker-compose restart

clean:
	docker-compose down -v

# ========================
# SETUP (READY TO TEST)
# ========================

setup:
	@echo "🚀 SETUP: starting system"
	@$(MAKE) up
	@$(MAKE) wait-services
	@$(MAKE) cassandra-init
	@$(MAKE) kafka-topics
	@$(MAKE) init-data || true
	@$(MAKE) health || true
	@echo ""
	@echo "✅ SYSTEM READY"
	@echo "➡ Run: make test-all"

wait-services:
	@echo "⏳ Waiting for Cassandra..."
	@until docker exec $(CASSANDRA_CONTAINER) cqlsh -e "DESCRIBE KEYSPACES" >/dev/null 2>&1; do \
		echo "  Cassandra not ready..."; \
		sleep 5; \
	done
	@echo "✓ Cassandra ready"

	@echo "⏳ Waiting for Kafka (max 60s)..."
	@for i in 1 2 3 4 5 6 7 8 9 10 11 12; do \
		if docker exec $(KAFKA_CONTAINER) \
			$(KAFKA_BIN)/kafka-broker-api-versions \
			--bootstrap-server kafka:9093 >/dev/null 2>&1; then \
			echo "✓ Kafka ready"; \
			exit 0; \
		fi; \
		echo "  Kafka not ready... ($$((i*5)) s)"; \
		sleep 5; \
	done; \
	echo "✗ Kafka not ready after 60s"; \
	exit 1

init-all:
	@$(MAKE) cassandra-init
	@$(MAKE) kafka-topics

# ========================
# TESTING
# ========================

test-bet:
	curl -X POST http://localhost:3000/api/bet \
		-H "Content-Type: application/json" \
		-d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","amount":100,"game_data":{"game":"aviator"}}'

test-callback:
	curl -X POST http://localhost:3001/callback \
		-H "Content-Type: application/json" \
		-H "x-signature: dummy" \
		-d '{"type":"win","external_tx_id":"test-$(shell date +%s)","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-1","amount":500}'

test-all:
	@echo "Running tests..."
	@curl -s -X POST http://localhost:3000/api/bet \
		-H "Content-Type: application/json" \
		-d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","amount":100}' \
		&& echo "✓ Bet OK" || echo "✗ Bet FAIL"
	@sleep 2
	@curl -s http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000 \
		&& echo "✓ Balance OK" || echo "✗ Balance FAIL"
	@sleep 2
	@curl -s -X POST http://localhost:3001/callback \
		-H "Content-Type: application/json" \
		-H "x-signature: dummy" \
		-d '{"type":"win","external_tx_id":"test-$(shell date +%s)","amount":500}' \
		&& echo "✓ Callback OK" || echo "✗ Callback FAIL"

# ========================
# LOAD TEST
# ========================

load-test-setup:
	cd load-test-client && npm install

load-test:
	cd load-test-client && npm test

load-test-light:
	cd load-test-client && npm run test:light

load-test-medium:
	cd load-test-client && npm run test:medium

load-test-heavy:
	cd load-test-client && npm run test:heavy

# ========================
# MONITORING
# ========================

health:
	@./scripts/health-check.sh

monitor:
	@./scripts/monitor.sh

# ========================
# DATA
# ========================

init-data:
	@./scripts/init-test-data.sh

# ========================
# CASSANDRA
# ========================

cassandra-init:
	@echo "Initializing Cassandra schema..."
	@docker exec -i $(CASSANDRA_CONTAINER) cqlsh < cassandra-init/schema.cql
	@echo "✓ Cassandra schema ready"

cassandra-status:
	@docker exec $(CASSANDRA_CONTAINER) cqlsh -e "DESCRIBE KEYSPACES"
	@docker exec $(CASSANDRA_CONTAINER) cqlsh -e "USE aviator; DESCRIBE TABLES;" || true

# ========================
# KAFKA
# ========================

kafka-topics:
	@echo "Creating Kafka topics..."
	@docker exec $(KAFKA_CONTAINER) $(KAFKA_BIN)/kafka-topics \
		--bootstrap-server kafka:9093 \
		--create --if-not-exists \
		--topic bet-events \
		--partitions 3 \
		--replication-factor 1
	@docker exec $(KAFKA_CONTAINER) $(KAFKA_BIN)/kafka-topics \
		--bootstrap-server kafka:9093 \
		--create --if-not-exists \
		--topic aggregator-callbacks \
		--partitions 3 \
		--replication-factor 1
	@echo "✓ Kafka topics ready"

kafka-status:
	@docker exec $(KAFKA_CONTAINER) $(KAFKA_BIN)/kafka-topics \
		--bootstrap-server kafka:9093 --list
