# ========================
# CONFIG
# ========================

KAFKA_BIN=/usr/bin
CASSANDRA_CONTAINER=cassandra
KAFKA_CONTAINER=kafka

.PHONY: \
	help up down build logs restart clean \
	dashboard simulate \
	test-bet test-callback \
	cassandra-init cassandra-status \
	kafka-topics kafka-status

# ========================
# HELP
# ========================

help:
	@echo ""
	@echo "Service:"
	@echo "  make up              - Start containers"
	@echo "  make down            - Stop containers"
	@echo "  make logs            - Follow logs"
	@echo "  make clean           - Remove containers + volumes"
	@echo ""
	@echo "Application:"
	@echo "  make dashboard       - Start React Dashboard & Simulator"
	@echo "  make simulate        - Run traffic simulation (CLI)"
	@echo ""
	@echo "Testing:"
	@echo "  make test-bet        - Place a manual test bet"
	@echo "  make test-callback   - Send a manual test callback"
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
# APPLICATION
# ========================

dashboard:
	./start-dashboard.sh

simulate:
	node scripts/simulate-traffic.js --users 20 --duration 60

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
		-d '{"type":"win","external_tx_id":"test-$(shell date +%s)","user_id":"11111111-1111-1111-1111-111111111111","bet_round_id":"manual-round","amount":50}'

# ========================
# INFRA
# ========================

cassandra-init:
	@docker exec -i $(CASSANDRA_CONTAINER) cqlsh < ledger-worker/db/schema.cql
	@echo "✓ Cassandra schema ready"

cassandra-status:
	@docker exec $(CASSANDRA_CONTAINER) cqlsh -e "DESCRIBE KEYSPACES"

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
