### 💸💸💸

# Payment System

Production-grade P2P payment infrastructure with distributed fraud detection and event-driven architecture

<img width="1759" height="1436" alt="image" src="https://github.com/user-attachments/assets/c6105066-b319-42fa-96bf-2f12084ad6ba" />


---

**Table of Contents**

1. [About The Project](#about-the-project)
2. [Architecture](#architecture)
3. [Services](#services)
4. [Key Design Decisions](#key-design-decisions)
5. [Microservices Patterns](#microservices-patterns)
6. [Security](#security)
7. [Testing](#testing)
8. [Built With](#built-with)
9. [Getting Started](#getting-started)
10. [API Reference](#api-reference)
11. [Roadmap](#roadmap)
12. [Contact](#contact)
13. [Acknowledgments](#acknowledgments)

---

## About The Project

A distributed payment processing system built with Spring Boot microservices — modeled after the infrastructure layer that powers platforms like Razorpay or PayPal. Handles peer-to-peer money movement with fraud detection, event-driven architecture, and production-grade reliability patterns.

Built to answer one question: *what actually happens when you tap "Pay"?*

Key capabilities:

- Never processes the same payment twice — Redis idempotency
- Prevents double spending — Pessimistic DB locking
- Zero message loss on crash — Outbox Pattern
- Automatic fraud reversal — Saga Pattern
- Real-time fraud detection — Rule-based engine with admin review queue
- Full transaction history — view payments sent and received per account

([back to top](#readme-top))

---

## Architecture

```
                      Client
                         │
                  ┌──────▼─────┐
                  │ API Gateway│  JWT Auth · Rate Limiting
                  │  Port 8080 │  Role-based Routing
                  └─────┬──────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────▼──────┐  ┌─────▼──────┐  ┌────▼───────┐
  │    Auth    │  │  Payment   │  │   Fraud    │
  │  Service   │  │  Service   │  │  Service   │
  │  Port 8081 │  │  Port 8082 │  │  Port 8083 │
  └─────┬──────┘  └─────┬──────┘  └────┬───────┘
        │               │               │
     Auth DB       Payment DB       Fraud DB
    (Postgres)     (Postgres)      (Postgres)
                        │
                   Redis Cache
                 (Idempotency +
                  Rate Limiting)

              ────── Kafka Event Bus ──────

Auth Service     → user-registered-topic   → Payment Service
Payment Service  → payment-topic           → Fraud Service
Payment Service  → payment-topic           → Notification Service
Fraud Service    → fraud-alert-topic       → Payment Service
Fraud Service    → fraud-review-topic      → Payment Service

                  ┌──────────────┐
                  │ Notification │
                  │   Service    │
                  │  Port 8084   │
                  └──────────────┘

            ┌─────────────────────────┐
            │   Grafana LGTM Stack    │
            │  Traces · Logs · Metrics│
            └─────────────────────────┘

       ╔════════════════════════════════════╗
       ║      Docker Internal Network       ║
       ║  Only port 8080 exposed externally ║
       ╚════════════════════════════════════╝
```

([back to top](#readme-top))

---

## Services

### API Gateway (8080)

- JWT validation on every request — no token, no entry
- Role-based access control — `/fraud/**` restricted to ADMIN
- Rate limiting per IP via Redis — 5 req/min on login, 3 req/min on register, 10 req/min on payments and accounts
- Strips untrusted `X-User-Id` headers — injects verified identity downstream

### Auth Service (8081)

- User registration and login
- JWT issuance with userId as subject and role as claim
- BCrypt password hashing
- Publishes `user-registered` event on registration

### Payment Service (8082)

- Ledger — every transaction is a single record referencing both sender and receiver accounts; a fraud reversal creates a separate compensating record with sender/receiver flipped, so nothing is ever deleted or mutated after the fact
- Idempotency via Redis — duplicate requests return same response without reprocessing
- Pessimistic DB locking — prevents double spending on concurrent requests
- Outbox Pattern — guaranteed Kafka delivery even on service crash
- Account ownership validation — users can only move money from their own accounts
- Account number abstraction — UUIDs stay internal, users interact via account numbers
- Transaction history — retrieve past payments sent and received per account
- Consumes `user-registered` → auto-creates account on registration
- Consumes `fraud-alert` → reverses transaction and freezes account (Saga)
- Consumes `fraud-review` → unfreezes account on admin approval

### Notification Service (8084)

- Consumes payment events from Kafka
- Async payment confirmations — never blocks payment processing
- Extensible to email/SMS providers

### Fraud Detection Service (8083)

- Rule-based fraud engine — evaluates every transaction against 5 rules, stops at the first match
- Rules: large transaction (currency-specific threshold, e.g. ≥ $10,000 USD / €9,000 EUR / ¥1,000,000 JPY), whole-number amount, self-transfer, non-positive amount, threshold gaming (amount exactly at a round-number-minus-one boundary, e.g. 9,999)
- Saves alerts to dedicated fraud DB with risk levels (LOW, MEDIUM, HIGH)
- Admin review queue — approve (unfreeze) or reject (keep frozen) via outbox pattern
- Publishes fraud alerts to trigger Saga compensation in Payment Service

([back to top](#readme-top))

---

## Key Design Decisions

**Outbox Pattern** — Direct Kafka publishing risks message loss if service crashes mid-transaction. Events are written to an outbox table in the same DB transaction. A scheduler reads and publishes. Atomicity guaranteed.

**Idempotency with Redis** — Every payment request carries a client-generated `Idempotency-Key` header. Redis stores the key with TTL. Duplicate requests return the original response without reprocessing — prevents double charges on network retries.

**Pessimistic Locking** — Concurrent payments to the same account can cause double spending. `@Lock(PESSIMISTIC_WRITE)` on account fetches ensures one transaction processes at a time per account.

**Saga Pattern** — Fraud detection is async. Payment processes first, fraud analysis follows. When fraud is confirmed, a compensation event reverses the transaction and freezes the account. No records deleted — full audit trail preserved.

**Kafka over RabbitMQ** — Multiple services consume every payment event independently. Kafka's message retention means no events are lost if a service goes down — consumer catches up on restart.

**Database per Service** — Each service owns its data. No cross-service JPA relationships. Services communicate via events. Payment DB, Fraud DB, and Auth DB are completely independent.

**Account Number Abstraction** — Users share account numbers (e.g. `ABC123DEF456`). Internal UUIDs never surface in the API. Account number to UUID resolution happens server-side.

**JWT at Gateway Only** — Auth Service issues JWT. Gateway validates it using a shared secret — no Auth Service call needed per request. Downstream services trust the `X-User-Id` header injected by Gateway.

**First-Match Fraud Rules** — The rule engine runs rules in order and stops at the first match rather than collecting every violation. Simpler to reason about, and avoids duplicate alerts for a single transaction — at the cost of only ever seeing the first reason, not every reason, a transaction was flagged.

**Currency-Aware Fraud Thresholds** — "Large transaction" is relative to the currency, not a fixed number (accounts hold USD, EUR, GBP, JPY, CAD, AUD, or CHF) — a threshold in USD would misfire on JPY-denominated accounts, so each currency has its own limit.

([back to top](#readme-top))

---

## Microservices Patterns

| Pattern                   | Implementation                            |
| ------------------------- | ----------------------------------------- |
| API Gateway               | Spring Cloud Gateway — single entry point |
| Database per Service      | Auth DB, Payment DB, Fraud DB             |
| Event-Driven Architecture | Kafka backbone across all services        |
| Outbox Pattern            | Payment Service + Fraud Service           |
| Idempotent Consumer       | Redis idempotency keys                    |
| Saga Pattern              | Fraud reversal compensation flow          |
| Pessimistic Locking       | Account fetches during payment processing |

([back to top](#readme-top))

---

## Security

- JWT validation at Gateway — no unauthenticated request reaches any service
- Header stripping — client-supplied `X-User-Id` removed, Gateway injects verified identity
- Account ownership validation — users can only deposit/transfer from their own accounts
- Role-based access — ADMIN role required for fraud endpoints
- Rate limiting per IP — brute force and spam protection on auth and payment routes
- BCrypt password hashing
- Internal network isolation — only port 8080 exposed externally via Docker
- No UUIDs in API surface — account numbers only
- IDOR prevention — account ownership checked on every write operation

([back to top](#readme-top))

---

## Testing

Unit tests cover the core reliability, security, and fraud logic across every service:

**Payment Service** — `Transactionservicetest`
- Successful payment debits sender, credits receiver, saves the transaction
- Duplicate idempotency key mid-flight is rejected; a duplicate after completion returns the cached result without reprocessing
- Self-transfer, insufficient balance, unauthorized caller, frozen sender/receiver, and currency mismatch are all rejected before any balance is touched

**Auth Service** — `AuthServiceTest`
- Registration lowercases email, defaults missing currency to USD, publishes the registration event
- Duplicate email and DB constraint violations are caught and rethrown as friendly errors
- Login validates credentials and surfaces failures from the authentication manager; token generation and validation are covered directly

**Fraud Detection Service** — `FraudRuleEngineTest`, `FraudRulesTest`, `FraudServiceTest`
- Rule engine: no match saves nothing; a match short-circuits and publishes; a later rule still fires when earlier ones don't
- Each of the 5 rules individually: currency threshold boundaries, self-transfer, whole-number amounts, the exact threshold-gaming value, zero/negative amounts
- Admin review: approve/reject set status and publish an outbox event; reviewing a missing alert throws; serialization failures are wrapped rather than silently swallowed

**API Gateway** — `JwtAuthFilterTest`
- Public auth routes bypass the filter entirely
- Missing header, missing "Bearer " prefix, and an invalid token all return 401 without reaching downstream services
- A valid token gets trusted `X-User-Id`/`X-User-Role` headers injected, with any client-supplied versions of those headers stripped first

**Notification Service** — `PaymentEventConsumerTest`
- A valid Kafka message deserializes without throwing; a malformed message is caught rather than propagating and crashing the consumer

Run tests for a service:

```
cd paymentservice && mvn test
```

Run the full suite across all services:

```
for svc in authservice paymentservice frauddetectionsystem notificationservice gateway; do
  (cd $svc && mvn test)
done
```

([back to top](#readme-top))

---

## Built With

[![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)](https://java.com) [![Spring](https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot) [![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev) [![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev) [![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apache-kafka&logoColor=white)](https://kafka.apache.org) [![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io) [![Postgres](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org) [![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com) [![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)](https://grafana.com)

Frontend is a plain React 18 + Vite SPA (no state-management or UI library) calling the Gateway directly.

([back to top](#readme-top))

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Java 21
- Maven

### Installation

1. Clone the repository

```
git clone https://github.com/mayankdevelops25/payment-system.git
cd payment-system
```

2. Start infrastructure

```
docker-compose up -d
```

Starts: PostgreSQL (x3), Redis, Kafka (KRaft), Grafana LGTM, and Adminer (DB admin UI at `localhost:8888`)

3. Build each service

```
cd paymentservice && mvn clean package && cd ..
cd authservice && mvn clean package && cd ..
cd frauddetectionsystem && mvn clean package && cd ..
cd notificationservice && mvn clean package && cd ..
cd gateway && mvn clean package && cd ..
```

4. Start services in order

```
1. Auth Service          → port 8081
2. Payment Service       → port 8082
3. Fraud Service         → port 8083
4. Notification Service  → port 8084
5. API Gateway           → port 8080
```

5. Create admin user

```
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@yourdomain.com';
```

([back to top](#readme-top))

---

## API Reference

### Auth

```
POST /api/v1/auth/register    → Register, returns JWT + userId
POST /api/v1/auth/login       → Login, returns JWT + userId
```

### Accounts

```
GET  /api/v1/accounts/me                        → My account info
GET  /api/v1/accounts/{accountNumber}/balance   → My balance
POST /api/v1/accounts/{accountNumber}/deposit   → Deposit funds
GET  /api/v1/accounts                           → List all (ADMIN only)
GET  /api/v1/accounts/{id}                      → Get any account by internal UUID (ADMIN only)
```

### Payments

```
POST /api/v1/payments            → Process payment between accounts
GET  /api/v1/payments/history    → Transaction history (sent + received) for the authenticated user's account
```

Required headers:

```
Authorization: Bearer <jwt>
Idempotency-Key: <uuid>
```

Body (for `POST /api/v1/payments`):

```
{
  "senderAccountNumber": "ABC123DEF456",
  "receiverAccountNumber": "XYZ789GHI012",
  "amount": 500.00
}
```

### Fraud (ADMIN only)

```
GET /api/v1/fraud/alerts              → List all fraud alerts
GET /api/v1/fraud/alerts/{id}         → Get specific alert
PUT /api/v1/fraud/alerts/{id}/approve → Legitimate — unfreeze account
PUT /api/v1/fraud/alerts/{id}/reject  → Confirmed fraud — keep frozen
```

### Example Flow

```
1. Register         POST /api/v1/auth/register
                    → Account auto-created via Kafka event

2. Login            POST /api/v1/auth/login
                    → Receive JWT + account number

3. Deposit          POST /api/v1/accounts/{number}/deposit
                    → Fund your account

4. Pay              POST /api/v1/payments
                    → Money moves, ledger updated, Kafka event fired

5. History          GET /api/v1/payments/history
                    → View payments sent and received

6. Notification     → Notification Service logs confirmation

7. Fraud Check      → Fraud Service analyzes transaction
                    → If HIGH risk: account frozen, payment reversed

8. Admin Review     → PUT /api/v1/fraud/alerts/{id}/approve
                    → Account unfrozen
```

([back to top](#readme-top))

---

## Roadmap

- [x] Payment Service with idempotency and pessimistic locking
- [x] Outbox Pattern for guaranteed Kafka delivery
- [x] Fraud Detection with rule-based engine
- [x] Saga Pattern for fraud reversal
- [x] API Gateway with JWT and rate limiting
- [x] Distributed tracing with Grafana LGTM
- [x] Docker network isolation
- [x] Unit test coverage across all 5 services (payment, auth, fraud, gateway, notification)
- [x] Transaction history endpoint
- [ ] Service discovery via Eureka/Consul
- [ ] ML-based fraud scoring
- [ ] Kubernetes orchestration
- [ ] CI/CD pipeline
- [ ] Load testing with k6

([back to top](#readme-top))

---

## Acknowledgments

- [Microservices.io — Pattern reference](https://microservices.io)
- [Baeldung — Spring Boot guides](https://baeldung.com)
- [Stripe Engineering Blog — Idempotency](https://stripe.com/blog/engineering)
- [ByteByteGo — Payment system design](https://bytebytego.com)
- [Confluent — Kafka fundamentals](https://confluent.io/learn/kafka)
- [Monzo Engineering Blog — Ledger design](https://monzo.com/blog/engineering)

([back to top](#readme-top))
