# Cassandra–Kafka Betting System

A **high‑performance, event‑driven betting platform** built for scale, reliability, and real‑time fan‑out. Designed around **Kafka for durability** and **WebSockets for live delivery**, with Cassandra as the immutable ledger.

---

## 🚀 Quick Start (Recommended)

> This project requires **Docker + Docker Compose**.

```bash
make up
make bootstrap
```

What this does:

* Starts all services (env‑aware)
* Waits for Cassandra **CQL readiness** (no race conditions)
* Applies Cassandra schema
* Creates required Kafka topics
* Prints final system status

---

## 🖥️ Dashboard & Simulation

```bash
make dashboard
```

* **React Dashboard**: [http://localhost:5173](http://localhost:5173)
* **Gateway API / WS**: [http://localhost:3000](http://localhost:3000)
* **Callback Webhook**: [http://localhost:3001](http://localhost:3001)

Run traffic simulation:

```bash
make simulate        # ~2000 users
make simulate-high   # ~5000 users
```

---

## 🏗️ Architecture (Clear Separation of Responsibilities)

### 🔁 Event Flow

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

### 🧠 Service Roles

| Service           | Responsibility                                        |
| ----------------- | ----------------------------------------------------- |
| **Gateway**       | User‑facing API + WebSocket fan‑out (**output only**) |
| **Callback**      | Receives external game results (**input only**)       |
| **Ledger Worker** | Single Kafka consumer group → balance, bets, wins     |
| **Bet Resolver**  | Simulation‑only win/loss generator                    |
| **Kafka**         | Durable event log, replay, ordering                   |
| **Cassandra**     | Immutable financial ledger                            |
| **Redis**         | Fast ephemeral state (balances, live stats)           |

> **Rule:** Gateway never processes business logic.
> Callback never talks to users.

---

## ⚙️ Redis vs Kafka (Why Both Exist)

| Concern           | Redis         | Kafka               |
| ----------------- | ------------- | ------------------- |
| Latency           | ⚡ Ultra‑low   | 🚚 Slightly higher  |
| Durability        | ❌ Volatile    | ✅ Persistent        |
| Ordering          | ❌ Best‑effort | ✅ Partition‑ordered |
| Replay            | ❌ No          | ✅ Yes               |
| WebSocket fan‑out | ✅ Perfect     | ❌ Not suitable      |

**Design Choice**:

* **Kafka** → source of truth, replay, scaling, fault tolerance
* **Redis** → real‑time state for dashboards & WS

---

## 🛠️ Common Makefile Commands

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

## 🧪 Manual Testing

Place a bet:

```bash
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{"user_id":"11111111-1111-1111-1111-111111111111","amount":10,"game_data":{"game":"aviator"}}'
```

Send a callback:

```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{"type":"win","external_tx_id":"manual","user_id":"11111111-1111-1111-1111-111111111111","bet_round_id":"r1","amount":50}'
```

---

## 📊 Monitoring

```bash
make prometheus   # http://localhost:9090
make grafana      # http://localhost:3100
```

---

## 🧠 Design Goals

* **At‑least‑once financial correctness**
* **Stateless, horizontally scalable gateway**
* **Replayable event history**
* **No Redis‑only money state**
* **Clear input/output service boundaries**

---

## ✅ Production‑Ready Characteristics

* Kafka consumer groups
* Idempotent ledger writes
* Cassandra append‑only model
* WebSocket fan‑out isolation
* Deterministic recovery via replay

---

If you’re reading this as a reviewer:
this system is intentionally **over‑engineered** to demonstrate **real‑world betting / trading backend design**.
