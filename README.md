# AESCION — Modern Commerce Operations Operating System

> **"Billing should be the fastest workflow, while the platform acts as the operating system for the business."**

AESCION is a high-velocity, role-aware, multi-tenant SaaS platform built for modern commerce. It unifies high-speed point-of-sale billing, inventory event ledgers, customer credit management, approval governance, progressive onboarding, and real-time **Business Pulse** exception intelligence.

---

## 1. Core Architectural Pillars

1. **Modular Monolith**: Strict domain boundaries (`auth`, `tenancy`, `iam`, `approvals`, `audit`, `super-admin`) built on **NestJS** and **TypeScript**.
2. **Zero-Trust Multi-Tenancy**: Hierarchy strictly maintained:
   $$\text{Platform} \longrightarrow \text{Organization (Tenant)} \longrightarrow \text{Legal Entity} \longrightarrow \text{Outlet (Branch)} \longrightarrow \text{Register (Terminal)} \longrightarrow \text{Memberships}$$
   Every API query verifies tenant context against authenticated memberships.
3. **RBAC + Granular Scope + Authority Limits**: Fine-grained permissions (`domain.action`) evaluated against scopes (`OWN`, `OUTLET`, `MULTI_OUTLET`, `ORGANIZATION`). Exceeding cashier authority thresholds (e.g. discount &gt; 5%) automatically routes to a generic **Approval Request Engine**.
4. **Progressive Complexity**: 1-click zero-config auto-provisioning for single-owner shops, scaling up to multi-outlet supermarket chains with distinct registers and custom permission matrices.
5. **Modern Obsidian / Slate Design Language**: Fast keyboard-first navigation (`Ctrl+K` Command Bar), role-tailored workspaces (Owner Pulse, Manager Hub, Cashier Billing, Accountant Ledger), and Support Mode time-limited impersonation with compliance banners.

---

## 2. Monorepo Structure

```text
AESCION_Billing_System/
├── apps/
│   ├── api/                 # NestJS Modular Monolith API + Prisma ORM
│   │   ├── prisma/          # Multi-tenant schema and realistic seed data
│   │   ├── src/             # Domain modules, guards, decorators, interceptors
│   │   └── test/            # Tenant isolation & RBAC unit/integration tests
│   │
│   └── web/                 # React 18 + Vite + Tailwind CSS + Zustand + TanStack Query
│       ├── src/components/  # Obsidian/Slate custom design system (Button, Table, Modal...)
│       ├── src/layouts/     # AppShell with Org/Outlet Switchers & Support Mode Banner
│       ├── src/modules/     # Auth, Onboarding Wizard, Dashboards, IAM, POS, Settings, Admin
│       └── src/stores/      # Zustand authStore and tenantStore
│
├── packages/
│   └── types/               # Shared TypeScript DTOs, Enums, and Permission contracts
│
└── docs/                    # Architecture, Database, Permissions, Roadmap specs
```

---

## 3. Quick Start & Setup

### Prerequisites
* **Node.js**: v18+ (tested on v24)
* **npm**: v9+

### Installation & Database Setup
```bash
# 1. Install all monorepo dependencies
npm install

# 2. Build shared types package
npm run build --workspace=@aescion/types

# 3. Synchronize database schema and seed realistic fixtures
npx prisma db push --schema=apps/api/prisma/schema.prisma
npx ts-node apps/api/prisma/seed.ts
```

### Launch Development Servers
```bash
# Terminal 1: Launch NestJS API (runs on http://localhost:3000)
npm run dev:api

# Terminal 2: Launch Vite React Client (runs on http://localhost:5173)
npm run dev:web
```

* **Frontend Web App**: [http://localhost:5173](http://localhost:5173)
* **API Documentation (Swagger UI)**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## 4. Demo Seed Personas

Use the **1-Click Demo Switcher** on the login page or sign in with:

| Persona | Email | Password | Role & Scope | Context |
| :--- | :--- | :--- | :--- | :--- |
| **SaaS Super Admin** | `admin@aescion.com` | `Admin@12345` | Platform Administrator | Super Admin Portal & Support Mode |
| **Multi-Outlet Owner** | `priya@novamart.com` | `Password@123` | Business Owner (`ORGANIZATION`) | Nova Supermarket (Tenkasi & Chennai) |
| **Store Manager** | `karthik@novamart.com` | `Password@123` | Store Manager (`OUTLET`) | Tenkasi Branch (Approvals & Shifts) |
| **Counter Cashier** | `anand@novamart.com` | `Password@123` | Counter Cashier (`OUTLET`) | Fast Billing Terminal (5% disc limit) |
| **Accountant** | `suresh@novamart.com` | `Password@123` | Accountant (`ORGANIZATION`) | Tax ledgers, invoices & reports |
| **Single-Shop Owner** | `ramesh@apexquick.com` | `Password@123` | Business Owner (`ORGANIZATION`) | Apex QuickStore (Single-counter MVP) |

---

## 5. Automated Tests

Run the full automated test suite verifying **Tenant Isolation** and **RBAC / Authority Limits**:
```bash
npx jest --config apps/api/jest.config.js
```
* **Test 1**: Tenant Isolation — Verifies that users from Organization A are strictly forbidden (403) from accessing Organization B.
* **Test 2**: RBAC & Permissions — Verifies that Cashiers are blocked from administrative role management endpoints.
* **Test 3**: Authority Limits — Verifies discount authority limit checks and Owner bypass resolution.
