# ADR-001: Atomic Studio Class Capacity Lock, Idempotent Booking & Automatic FIFO Waitlist Promotion

- **Status:** Accepted
- **Date:** 2026-11-28
- **Authors:** TVT Studio — Principal Solution Architecture
- **Applies To:** `Vanguard.Domain.Services.AtomicClassBookingService`, `POST /api/v1/classes/{classId}/book`, `DELETE /api/v1/classes/{classId}/bookings/{bookingId}`

---

## 1. Context & Failure Mode Analysis

Boutique athletic clubs such as Vanguard operate with **hard physical apparatus caps** (10 Walnut Reformer carriages, 8 Basalt cold plunge basins, 12 Eleiko lifting platforms). During peak booking windows (e.g., Monday 06:30 VO2 Max or 18:30 Barbell Force opening at midnight), dozens of members attempt to reserve the **final remaining mat simultaneously**.

A naive read-then-write implementation (`SELECT enrolled_count` -> check `< capacity` -> `INSERT booking`) suffers from three severe production defects:

1. **TOCTOU Overbooking (Lost Update):** Two or more concurrent requests observe `11/12` spots filled and both insert confirmed bookings, breaching physical Reformer/rack capacity (`13/12`).
2. **Duplicate Retries on Mobile Networks:** Flaky gym Wi-Fi or cellular retries resend `POST /book`, double-booking the same member or consuming multiple waitlist slots.
3. **Orphaned Capacity on Late Cancellation:** When a confirmed member cancels 2 hours before class, leaving the spot open for general polling causes an unfair "refresh race" instead of honoring First-In, First-Out (FIFO) waitlist fairness.

---

## 2. Architectural Decision

We implement a **per-class fine-grained atomic critical section** paired with **SHA-256 Idempotency Fingerprinting** and **in-transaction FIFO Waitlist Promotion**:

### 2.1 Fine-Grained Per-Class Locking (`ConcurrentDictionary<string, ClassBucket>` + `SemaphoreSlim(1, 1)`)

- Rather than a global `lock` (which would bottleneck unrelated classes across floors), every `classId` owns an isolated `ClassBucket` protected by an asynchronous `SemaphoreSlim(1, 1)`.
- Operations on `mon-1830-strength` never block operations on `tue-0700-cryo` (verified by `CrossClassIsolation_BookingClassADoesNotMutateClassB`).
- Because `SemaphoreSlim.WaitAsync(ct)` is fully async-aware, Kestrel thread-pool threads are never starved under contention.

### 2.2 Mandatory `Idempotency-Key` with SHA-256 Payload Fingerprinting

- Every `POST /api/v1/classes/{classId}/book` request MUST provide a non-empty `Idempotency-Key` header (`400 Bad Request` otherwise).
- A canonical SHA-256 fingerprint is computed over `(classId, memberId, memberName, allowWaitlist)`.
- Lookup and insertion occur **inside** the per-class semaphore so even 5 concurrent identical retries (`Task.WhenAll`) yield strictly `1 × 201 Created` and `4 × 200 OK (Idempotency-Replayed: true)`.
- Reusing a previously committed key with a **different payload** is rejected with `409 Conflict (IDEMPOTENCY_PAYLOAD_MISMATCH)`, preventing silent semantic corruption.

### 2.3 Deterministic Capacity Lock vs FIFO Queue Semantics

Inside the acquired per-class gate:
- If `ConfirmedBookings.Count < Capacity`: allocate spot -> `201 Created` (`CONFIRMED`, `waitlistPosition: null`).
- Else if `allowWaitlist == false`: reject -> `409 Conflict` (`CLASS_AT_CAPACITY`) with live `classSnapshot`.
- Else (`allowWaitlist == true`): append to ordered `WaitlistQueue` -> assign sequential `position = WaitlistQueue.Count` (`#1..#N`) -> `202 Accepted` (`WAITLISTED`).

### 2.4 Atomic Cancellation & FIFO `#1` Auto-Promotion

On `DELETE /api/v1/classes/{classId}/bookings/{bookingId}`:
- If the cancelled booking held a `CONFIRMED` mat and `WaitlistQueue.Count > 0`:
  1. Dequeue `WaitlistQueue[0]` (strict FIFO Position `#1`).
  2. Mutate status to `CONFIRMED`, clear `waitlistPosition`, stamp `promotedAtUtc`.
  3. Re-index all remaining waitlisted athletes (`#2 -> #1`, `#3 -> #2`, ...) atomically before releasing the gate.
  4. Return `200 OK` containing `promotedBooking`, `updatedWaitlist`, and `classSnapshot` so notification workers (push/SMS/email) can trigger immediately without polling.

---

## 3. Horizontal Multi-Node Scale-Out Path (PostgreSQL + Redis)

The `IClassBookingEngine` interface isolates locking mechanics from Minimal API routes. In a multi-replica Kubernetes cluster backed by `docker-compose.yml` (`postgres:16-alpine` + `redis:7-alpine`):

| Concern | Single-Node / Integration Runtime | Multi-Replica Production Cluster |
| --- | --- | --- |
| Mutual Exclusion | Per-class `SemaphoreSlim(1, 1)` | PostgreSQL `SELECT ... FROM studio_classes WHERE id = $1 FOR UPDATE` inside `SERIALIZABLE`/`READ COMMITTED` TX, or Redis `SETNX`/Lua fenced lock |
| Idempotency Ledger | Per-class `Dictionary<string, IdempotencyEntry>` | Unique index `UNIQUE (class_id, idempotency_key)` in `booking_idempotency` table + 24h Redis cache |
| FIFO Queue Order | Ordered `List<BookingRecord>` inside gate | `waitlist_seq BIGSERIAL` with `ORDER BY waitlist_seq ASC LIMIT 1 FOR UPDATE SKIP LOCKED` |
| Notification Dispatch | Synchronous response payload | Transactional Outbox table -> background worker -> WebPush / Zalo OA |

---

## 4. Verification & Concurrency Invariants Proven Locally

All invariants are enforced in CI via xUnit + `WebApplicationFactory<Program>` (`Vanguard.Api.Tests`):

- **10-Way Last-Spot Race (`allowWaitlist=false`):** Strictly `1 × 201 Created` + `9 × 409 Conflict`, final occupancy `12/12`, `0` overbooks.
- **10-Way Last-Spot Race (`allowWaitlist=true`):** Strictly `1 × 201 Created` + `9 × 202 Accepted` with exact unique sequential FIFO positions `#1..#9`.
- **20-Member Full-Class Burst:** Exact monotonic positions `#1..#20` with zero gaps or collisions.
- **Cancellation Auto-Promotion:** Cancelling confirmed booking promotes strictly `#1` to `CONFIRMED`, shifts `#2 -> #1` and `#3 -> #2`, and subsequent cancellation promotes `#2`.
- **Concurrent Duplicate Idempotency Race:** 5 simultaneous requests with identical key consume strictly `1` seat (`1 × 201 Created` + `4 × 200 OK` replay).
