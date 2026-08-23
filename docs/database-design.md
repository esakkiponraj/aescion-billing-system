# Relational Database Architecture & ER Design

## 1. Design Guidelines & Schema Standards
1. **Identifier Strategy**: `UUIDv4` or CUID for all primary keys to guarantee distributed uniqueness and offline sync resilience.
2. **Tenant Isolation**: Every tenant-owned table contains `organizationId` and where applicable `outletId`.
3. **Composite Indexing**: Standard indexes on `(organizationId, createdAt)`, `(organizationId, outletId)`, and foreign key pairs for tenant-scoped query performance.
4. **Immutability of Financials**: Invoices, payments, and stock ledger entries are never hard-deleted. Corrections occur via credit notes, refunds, or reversing stock movements.
5. **Auditing**: Sensitive models maintain `createdAt`, `updatedAt`, `createdBy`, and write into `audit_logs`.

---

## 2. Core Relational Models (Phase 1 Foundation)

### Identity & Tenancy
* **`User`**: `(id, email, passwordHash, firstName, lastName, phone, isSuperAdmin, isActive, avatarUrl, createdAt, updatedAt)`
* **`UserSession`**: `(id, userId, refreshTokenHash, deviceInfo, ipAddress, userAgent, expiresAt, revokedAt, createdAt)`
* **`Organization`**: `(id, name, slug, businessType, country, currency, timezone, logoUrl, status, createdAt, updatedAt)`
* **`LegalEntity`**: `(id, organizationId, name, taxNumber, registeredAddress, phone, email, createdAt, updatedAt)`
* **`Outlet`**: `(id, organizationId, legalEntityId, name, code, address, phone, isActive, createdAt, updatedAt)`
* **`Register`**: `(id, outletId, name, code, isActive, createdAt, updatedAt)`
* **`OrganizationMembership`**: `(id, userId, organizationId, status, joinedAt, createdAt, updatedAt)`
* **`OutletMembership`**: `(id, orgMembershipId, outletId, createdAt)`

### Access Control (RBAC + Scope + Limits)
* **`Role`**: `(id, organizationId, name, code, description, isSystemDefault, maxDiscountPercent, priceOverrideAllowed, approvalLimit, createdAt, updatedAt)`
* **`Permission`**: `(id, code, module, description, createdAt)`
* **`RolePermission`**: `(id, roleId, permissionId, scope [OWN | OUTLET | MULTI_OUTLET | ORGANIZATION])`
* **`MembershipRole`**: `(id, orgMembershipId, outletMembershipId, roleId, createdAt)`

### Operational Support & Governance
* **`ApprovalRequest`**: `(id, organizationId, outletId, requestedByUserId, approvalType, resourceType, resourceId, requestedValue, reason, status [PENDING | APPROVED | REJECTED | CANCELLED], approvedByUserId, approvedAt, rejectedByUserId, rejectedAt, comments, createdAt, updatedAt)`
* **`AuditLog`**: `(id, organizationId, outletId, userId, action, resource, resourceId, beforeState, afterState, ipAddress, userAgent, createdAt)`

### Subscription & Feature Management
* **`Plan`**: `(id, name, code, description, maxOutlets, maxUsers, maxRegisters, isCustom, createdAt, updatedAt)`
* **`Feature`**: `(id, code, name, description, module)`
* **`PlanFeature`**: `(id, planId, featureId, isEnabled, limitValue)`
* **`Subscription`**: `(id, organizationId, planId, status [TRIALING | ACTIVE | PAST_DUE | CANCELLED], trialEndsAt, startsAt, endsAt, autoRenew, createdAt, updatedAt)`
* **`FeatureOverride`**: `(id, organizationId, featureId, isEnabled, limitValue, reason, expiresAt)`
