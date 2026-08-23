# Offline-First Point-of-Sale Architecture

## 1. The Offline Billing Imperative
Retail and restaurant checkout counters must never stall due to network interruptions, DNS failures, or internet instability.

## 2. Sync Engine Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                      Client POS Screen                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │ Network Availability Check  │
                └──────────────┬──────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │ ONLINE                                      │ OFFLINE
        ▼                                             ▼
┌──────────────────┐                         ┌──────────────────┐
│ Direct Cloud API │                         │ Local IndexedDB  │
│ (Fast commit)    │                         │ Offline Queue    │
└──────────────────┘                         └────────┬─────────┘
                                                      │ (Background Sync)
                                                      ▼
                                             ┌──────────────────┐
                                             │ Replay Engine    │
                                             │ (Idempotent API) │
                                             └──────────────────┘
```

## 3. Conflict Resolution & Idempotency
* **UUID Primary Keys**: Generated locally on the client terminal to prevent ID collisions.
* **Offline Sequential Invoice Numbers**: Prefixed by register code (e.g. `OFF-TNK1-00042`) so printed receipts remain sequentially valid during network outages. Upon synchronization, cloud maps permanent fiscal numbers while preserving the offline audit reference.
* **Stock Movement Reconciliation**: Cloud orders inventory ledger events by client timestamp, flagging any negative stock conditions for manager review.
