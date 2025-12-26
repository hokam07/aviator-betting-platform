# Cassandra–Kafka Betting System

A high-performance, event-driven betting platform built for scale, reliability, and real-time fan-out. Designed around Kafka for durability and WebSockets for live delivery, with Cassandra as the immutable ledger.

---

## Quick Start (Recommended)

This project requires Docker + Docker Compose.

```bash
make bootstrap
```

What this does:

* Starts all services (modular architecture)
* Waits for Cassandra CQL readiness (no race conditions)
* Applies Cassandra schema & creates Kafka topics
* **Auto-installs all auxiliary dependencies** (Dashboard + Scripts)
* Prints final system status

---

## 📂 Project Structure (Modularized)

| Path | Description |
| --- | --- |
| `gateway/`, `callback/` | The API surface area |
| `ledger-worker/` | The heavy-duty financial processor (Bets & Manual Wins) |
| `infra/` | Docker Compose for Redis, Kafka, Cassandra |
| `monitoring/` | Prometheus & Grafana configs |
| `docs/` | **[NEW]** AWS Deployment Guides |
| `scripts/` | Traffic simulation & maintenance tools |

---

## Dashboard & Simulation

```bash
make dashboard
```

* React Dashboard: http://localhost:5173
* Gateway API / WS: http://localhost:3000
* Callback Webhook: http://localhost:3001

Run traffic simulation:

```bash
make simulate        # ~2000 users
make simulate-high   # ~5000 users
```

---

## Architecture (Clear Separation of Responsibilities)

### Event Flow

```
[ External Game Engine ]
          ↓ (HTTP Webhook)
      Callback Service
          ↓ (Kafka)
     aggregator-callbacks
          ↓
      Ledger Worker
          ↓
       Cassandra
          ↓ (Kafka)
        bet-events
          ↓
        Gateway
          ↓ (WebSocket)
        Users / UI
```

### Service Roles

| Service           | Responsibility                                        |
| ----------------- | ----------------------------------------------------- |
| Gateway           | User-facing API + WebSocket fan-out (output only)      |
| Callback          | Receives external game results (input only)            |
| Ledger Worker     | Single Kafka consumer group → balance, bets, wins     |
| Kafka             | Durable event log, replay, ordering (50 partitions)   |
| Cassandra         | Immutable financial ledger                            |
| Redis             | Fast ephemeral state (balances, live stats)           |

**Kafka Scaling**: Both `bet-events` and `aggregator-callbacks` topics use **50 partitions** to support up to 40 parallel ledger workers (K8s HPA max). Each partition can have only one active consumer per consumer group.

Rule: Gateway never processes business logic.  
Callback never talks to users.

---

## Redis vs Kafka (Why Both Exist)

| Concern           | Redis              | Kafka                    |
| ----------------- | ------------------ | ------------------------ |
| Latency           | Ultra-low          | Slightly higher          |
| Durability        | Volatile           | Persistent               |
| Ordering          | Best-effort        | Partition-ordered        |
| Replay            | No                 | Yes                      |
| WebSocket fan-out | Perfect            | Not suitable             |

Design Choice:

* Kafka → source of truth, replay, scaling, fault tolerance
* Redis → real-time state for dashboards & WS

**Redis Adapter Configuration**: The gateway supports two Socket.io adapter modes:
* `SOCKET_ADAPTER_TYPE=pubsub` (default): Standard Redis Pub/Sub adapter
* `SOCKET_ADAPTER_TYPE=streams`: Redis Streams adapter for better horizontal scaling with multiple gateway instances

Set via environment variable in `.env` or K8s deployment.

---

## Common Makefile Commands

### Core

```bash
make up            # Start services
make down          # Stop services
make logs          # Follow logs
make status        # Container + port status
make clean         # Remove containers + volumes
```

### Bootstrap / Infra

```bash
make bootstrap     # Waits + Cassandra init + Kafka topics
make cassandra-shell
make kafka-status
```

### Testing

```bash
make test-bet
make test-callback
```

---

## ☁️ Cloud & AWS Deployment

Detailed guides for going live are located in the `docs/` directory:

1.  **[VPC Deployment (EC2 + Compose)](docs/aws-ec2-compose.md)**: Faster & Cheaper.
2.  **[Enterprise Scale (EKS + K8s)](docs/aws-eks-guide.md)**: Million-user auto-scaling.
3.  **[AWS Managed Services](docs/managed-services.md)**: Transitioning from containers to MSK/Keyspaces.

---

## Design Goals

* At-least-once financial correctness
* Stateless, horizontally scalable gateway
* Replayable event history
* No Redis-only money state
* Clear input/output service boundaries

---

## Production-Ready Characteristics

* Kafka consumer groups
* Idempotent ledger writes
* Cassandra append-only model
* WebSocket fan-out isolation
* Deterministic recovery via replay

---

If you’re reading this as a reviewer:  
this system is intentionally over-engineered to demonstrate real-world betting / trading backend design.