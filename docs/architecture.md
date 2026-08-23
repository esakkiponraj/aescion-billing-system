# AESCION SaaS Architecture & System Design

## 1. System Philosophy
The AESCION platform is engineered as a modern, high-velocity, role-aware operating system for commerce, retail, wholesale, and hospitality. 
Core Principle: **"Billing should be the fastest workflow, while the platform acts as the operating system for the business."**

---

## 2. Core Architecture: Modular Monolith

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             API Gateway / NestJS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  Middlewares / Global Interceptors / Filters:                               │
│  - Correlation ID & Structured Logger                                       │
│  - JWT Authentication & Session Resolver                                    │
│  - Tenant Context Interceptor (Org & Outlet validation)                     │
│  - Role-Based Access Control (RBAC) & Scope Guard                           │
│  - Audit Log Interceptor                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Domain Modules:                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Auth & IAM   │  │ Tenancy & Org│  │ Approvals    │  │ Audit & Sec     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Masters      │  │ Sales / POS  │  │ Inventory    │  │ Financials      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Analytics    │  │ Restaurant   │  │ Hardware/Dev │  │ Super Admin     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│  Data Layer: Prisma ORM -> PostgreSQL (Read/Write with Tenant Isolation)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Modular Monolith?
1. **Maintainability for Lean Teams**: Microservices impose distributed tracing, complex deployments, and distributed transaction management overhead.
2. **Strict Module Boundaries**: Each domain module owns its controllers, services, DTOs, and event listeners. No circular imports.
3. **Future Extraction Ready**: Clean domain service interfaces allow any module (such as Analytics or Restaurant KOT) to be extracted into a standalone microservice or serverless worker when scaling demands it.

---

## 3. High-Level Tenant Hierarchy
The platform strictly maintains the multi-tier hierarchy:
```
Platform
  └── Organization (Tenant)
        ├── Legal Entity (Fiscal / Tax details)
        └── Outlet / Branch (Physical store / warehouse)
              ├── Terminal / Register (Point of Sale counter)
              └── User Memberships & Role Assignments
```

---

## 4. Security & Compliance
* **Tenant Isolation**: Every database query is tenant-scoped. Headers `X-Organization-Id` and `X-Outlet-Id` are checked against the authenticated user's active memberships.
* **Authentication**: JWT access tokens (15 minutes) + rotating refresh tokens tracked in `UserSession` with user-agent and IP hashing.
* **Audit Trail**: Every critical action (price changes, discounts, refunds, voided invoices, role changes) records an immutable `AuditLog`.
* **Super Admin Support Mode**: SaaS support agents can only view a tenant account with time-boxed authorization, logged reason, and explicit impersonation UI banners.
