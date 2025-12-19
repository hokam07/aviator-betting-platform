# API Documentation

Complete API reference for the Cassandra-Kafka Betting System.

## Base URLs

- **Gateway**: `http://localhost:3000`
- **Callback Service**: `http://localhost:3001`

## Gateway API

### Place Bet

Place a bet for a user.

**Endpoint**: `POST /api/bet`

**Request Body**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 100,
  "game_data": {
    "game": "aviator",
    "multiplier": 2.5
  }
}
```

**Response** (200 OK):
```json
{
  "bet_round_id": "123e4567-e89b-12d3-a456-426614174000",
  "balance": 900,
  "status": "pending"
}
```

**Error Responses**:

- **400 Bad Request**: Invalid request body
```json
{
  "error": "Invalid request"
}
```

- **400 Bad Request**: Insufficient balance
```json
{
  "error": "Insufficient balance"
}
```

- **500 Internal Server Error**: Server error
```json
{
  "error": "Internal server error"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/bet \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100,
    "game_data": {"game": "aviator"}
  }'
```

---

### Get Balance

Get current balance for a user.

**Endpoint**: `GET /api/balance/:userId`

**Path Parameters**:
- `userId` (string, required): User UUID

**Response** (200 OK):
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "balance": 1000
}
```

**Example**:
```bash
curl http://localhost:3000/api/balance/550e8400-e29b-41d4-a716-446655440000
```

---

### Health Check

Check service health.

**Endpoint**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "ok"
}
```

**Example**:
```bash
curl http://localhost:3000/health
```

---

## Callback API

### Process Callback

Receive and process callbacks from game aggregator.

**Endpoint**: `POST /callback`

**Headers**:
- `Content-Type`: `application/json`
- `x-signature` or `x-hmac`: HMAC signature for validation

**Request Body**:
```json
{
  "type": "win",
  "external_tx_id": "ext-tx-12345",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "bet_round_id": "round-12345",
  "amount": 250
}
```

**Event Types**:
- `bet`: Bet confirmation from aggregator
- `win`: User won the bet
- `loss`: User lost the bet
- `rollback-bet`: Rollback a bet (refund)
- `rollback-win`: Rollback a win (deduct)

**Response** (200 OK):
```json
{
  "status": "accepted"
}
```

**Error Responses**:

- **400 Bad Request**: Invalid payload
```json
{
  "error": "Invalid payload"
}
```

- **400 Bad Request**: Invalid event type
```json
{
  "error": "Invalid event type"
}
```

- **401 Unauthorized**: Invalid HMAC signature
```json
{
  "error": "Invalid signature"
}
```

**Examples**:

#### Win Callback
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "win",
    "external_tx_id": "win-12345",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-12345",
    "amount": 250
  }'
```

#### Loss Callback
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "loss",
    "external_tx_id": "loss-12345",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-12345",
    "amount": 100
  }'
```

#### Rollback Bet
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "rollback-bet",
    "external_tx_id": "rollback-bet-12345",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-12345",
    "amount": 100
  }'
```

#### Rollback Win
```bash
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "type": "rollback-win",
    "external_tx_id": "rollback-win-12345",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "bet_round_id": "round-12345",
    "amount": 250
  }'
```

---

### Health Check

Check service health.

**Endpoint**: `GET /health`

**Response** (200 OK):
```json
{
  "status": "ok"
}
```

**Example**:
```bash
curl http://localhost:3001/health
```

---

## WebSocket API

### Connection

Connect to WebSocket server for real-time balance updates.

**URL**: `ws://localhost:3000`

**Client Libraries**:
- JavaScript: `socket.io-client`
- Python: `python-socketio`
- Java: `socket.io-client-java`

### Events

#### Subscribe to User Updates

Subscribe to balance updates for a specific user.

**Event**: `subscribe`

**Payload**: User ID (string)

**Example** (JavaScript):
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  socket.emit('subscribe', '550e8400-e29b-41d4-a716-446655440000');
});
```

#### Balance Update

Receive real-time balance updates.

**Event**: `balance_update`

**Payload**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "balance": 1150,
  "timestamp": "2024-12-20T10:30:00.000Z"
}
```

**Example** (JavaScript):
```javascript
socket.on('balance_update', (data) => {
  console.log('New balance:', data.balance);
});
```

### Complete Example

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  socket.emit('subscribe', '550e8400-e29b-41d4-a716-446655440000');
});

socket.on('balance_update', (data) => {
  console.log('Balance update received:', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected from WebSocket');
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error);
});
```

---

## Error Handling

All API endpoints follow consistent error response format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters or insufficient balance
- `401 Unauthorized`: Invalid authentication (HMAC signature)
- `500 Internal Server Error`: Server-side error

### Retry Logic

For callback endpoints, implement exponential backoff retry logic:

```javascript
async function sendCallbackWithRetry(payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.post('http://localhost:3001/callback', payload);
      return response.data;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production use, consider:

- Rate limiting per user (e.g., 100 requests/minute)
- Rate limiting per IP (e.g., 1000 requests/minute)
- Implement using Redis or API gateway

---

## Authentication

### HMAC Signature

Callback endpoints require HMAC signature validation.

**Algorithm**: HMAC-SHA256

**Header**: `x-signature` or `x-hmac`

**Example** (Node.js):
```javascript
const crypto = require('crypto');

function generateHmac(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

const payload = {
  type: 'win',
  external_tx_id: 'win-12345',
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  bet_round_id: 'round-12345',
  amount: 250
};

const signature = generateHmac(payload, process.env.HMAC_SECRET);

// Send with request
axios.post('http://localhost:3001/callback', payload, {
  headers: { 'x-signature': signature }
});
```

---

## Idempotency

All callback events are idempotent based on `external_tx_id`.

- Duplicate callbacks with same `external_tx_id` are ignored
- Idempotency is tracked in Cassandra `callback_idempotency` table
- Safe to retry failed callbacks without double-processing

**Example**:
```bash
# First call - processed
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{"type":"win","external_tx_id":"unique-123","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-001","amount":100}'

# Second call - ignored (same external_tx_id)
curl -X POST http://localhost:3001/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{"type":"win","external_tx_id":"unique-123","user_id":"550e8400-e29b-41d4-a716-446655440000","bet_round_id":"round-001","amount":100}'
```
