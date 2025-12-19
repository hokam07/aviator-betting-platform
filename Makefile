.PHONY: help up down build logs restart clean test-bet test-callback test-all load-test-setup load-test load-test-light load-test-medium load-test-heavy health monitor init-data

help:
	@echo "Available commands:"
	@echo ""
	@echo "Service Management:"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make build           - Build all services"
	@echo "  make restart         - Restart all services"
	@echo "  make logs            - View logs from all services"
	@echo "  make clean           - Remove all containers and volumes"
	@echo ""
	@echo "Testing:"
	@echo "  make test-bet        - Test bet placement"
	@echo "  make test-callback   - Test callback processing"
	@echo "  make test-all        - Run all basic tests"
	@echo "  make load-test-setup - Install load test dependencies"
	@echo "  make load-test       - Run load test (10 users, 60s)"
	@echo "  make load-test-light - Run light load test (5 users, 30s)"
	@echo "  make load-test-medium - Run medium load test (20 users, 60s)"
	@echo "  make load-test-heavy - Run heavy load test (50 users, 120s)"
	@echo ""
	@echo "Monitoring:"
	@echo "  make health          - Check health of all services"
	@echo "  make monitor         - Real-time monitoring dashboard"
	@echo ""
	@echo "Utilities:"
	@echo "  make init-data       - Initialize test data"
	@echo ""
	@echo "Documentation: See docs/ folder or README.md"

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

test-bet:
	@echo "Testing bet placement..."
	curl -X POST http://localhost:3000/api/bet \
		-H "Content-Type: application/json" \
		-d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","amount":100,"game_data":{"game":"aviator"}}'

test-callback:
	@echo "Testing callback..."
	curl -X POST http://localhost:3001/callback \
		-H "Content-Type: application/json" \
		-H "x-signature: dummy" \
		-d '{"type":"win","external_tx_id":"win-test-$(shell date +%s)","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-test-001","amount":500}'

test-all:
	@echo "Running all tests..."
	@echo ""
	@echo "1. Testing bet placement..."
	@curl -X POST http://localhost:3000/api/bet \
		-H "Content-Type: application/json" \
		-d '{"user_id":"550e8400-e29b-41d4-a716-446655440000","amount":100,"game_data":{"game":"aviator"}}' \
		2>/dev/null && echo "✓ Bet test passed" || echo "✗ Bet test failed"
	@echo ""
	@sleep 2
	@echo "2. Testing balance query..."
	@curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000 2>/dev/null \
		&& echo "✓ Balance test passed" || echo "✗ Balance test failed"
	@echo ""
	@sleep 2
	@echo "3. Testing callback..."
	@curl -X POST http://localhost:3001/callback \
		-H "Content-Type: application/json" \
		-H "x-signature: dummy" \
		-d '{"type":"win","external_tx_id":"win-test-$(shell date +%s)","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-test-001","amount":500}' \
		2>/dev/null && echo "✓ Callback test passed" || echo "✗ Callback test failed"
	@echo ""
	@echo "All tests completed!"

load-test-setup:
	@echo "Installing load test dependencies..."
	cd load-test-client && npm install

load-test:
	@echo "Running load test..."
	cd load-test-client && npm test

load-test-light:
	@echo "Running light load test..."
	cd load-test-client && npm run test:light

load-test-medium:
	@echo "Running medium load test..."
	cd load-test-client && npm run test:medium

load-test-heavy:
	@echo "Running heavy load test..."
	cd load-test-client && npm run test:heavy

health:
	@./scripts/health-check.sh

monitor:
	@./scripts/monitor.sh

init-data:
	@./scripts/init-test-data.sh
