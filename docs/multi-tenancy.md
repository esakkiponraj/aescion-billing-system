# Multi-Tenancy & Tenant Isolation Strategy

## 1. Zero-Trust Tenant Isolation
In AESCION, tenant isolation is guaranteed at every layer of the software stack:

```
[ Incoming HTTP Request ]
          │
          ▼
[ TenantContextInterceptor / Guard ]
  - Extracts JWT & resolves userId
  - Checks X-Organization-Id and X-Outlet-Id headers
  - Queries active OrganizationMembership & OutletMembership
  - Attaches verified TenantContext to request object
          │
          ▼
[ Controllers & Services ]
  - Injects @CurrentTenant() TenantContext
  - Never uses client-provided tenant IDs without authorization
          │
          ▼
[ Database Query / Prisma ]
  - All WHERE clauses enforced with { organizationId: context.orgId }
  - Scoped queries enforced with { outletId: context.outletId }
```

## 2. Multi-Branch & Multi-Tenant Switching
* A single user account (`User`) can belong to multiple organizations (e.g. an accountant working for 3 client businesses, or an investor with multiple retail brands).
* Within an organization, a user can have different permissions per outlet (e.g. Manager in Tenkasi branch, Viewer in Chennai branch).
* Frontend maintains `activeOrganizationId` and `activeOutletId` in state, validated on every API call.
