# Granular Permission & RBAC Architecture

## 1. Permission Matrix Format: `domain.action`

| Module | Permission Code | Description | Default Role Grants |
| :--- | :--- | :--- | :--- |
| **Organization & IAM** | `org.read` | View organization profile & settings | Owner, Manager, Accountant |
| | `org.update` | Update company profile & configuration | Owner |
| | `outlet.manage` | Create, update, or deactivate branches | Owner |
| | `register.manage` | Configure billing registers/terminals | Owner, Manager |
| | `employees.manage` | Invite, edit, or terminate staff | Owner, Manager |
| | `roles.manage` | Create & assign custom roles & perms | Owner |
| **Sales & POS** | `sales.create` | Generate sales, scan items & issue bills | Owner, Manager, Cashier |
| | `sales.read` | View sales history and invoice details | Owner, Manager, Cashier (Own), Accountant |
| | `sales.discount` | Apply manual or line-item discounts | Owner, Manager, Cashier (Subject to limit) |
| | `sales.price_override`| Manually edit selling price | Owner, Manager |
| | `sales.refund` | Process item returns and refunds | Owner, Manager |
| | `sales.cancel` | Void/cancel an existing bill | Owner, Manager |
| **Inventory** | `inventory.read` | View stock balances and movements | Owner, Manager, Accountant |
| | `inventory.adjust` | Perform manual stock adjustments | Owner, Manager |
| | `inventory.transfer`| Initiate & receive inter-branch transfers| Owner, Manager |
| **Purchasing** | `purchase.read` | View purchase orders & supplier bills | Owner, Manager, Accountant |
| | `purchase.create` | Create purchase orders & receive goods | Owner, Manager |
| | `purchase.approve`| Authorize POs above threshold | Owner |
| **Finance & Reports** | `expenses.manage` | Record and classify operational expenses| Owner, Manager, Accountant |
| | `reports.sales.read`| View sales analytics & metrics | Owner, Manager, Accountant |
| | `reports.profit.read`| View gross/net margins & profit reports | Owner |
| | `audit.read` | Inspect system compliance audit trails | Owner |
| **Approvals** | `approvals.read` | View pending approval queue | Owner, Manager |
| | `approvals.decide` | Approve or reject exception requests | Owner, Manager |

---

## 2. Permission Scopes
* `OWN`: Restricted strictly to records created by the authenticated user.
* `OUTLET`: Enforces isolation to the user's active/assigned outlet.
* `MULTI_OUTLET`: Grants visibility across explicit assigned outlets.
* `ORGANIZATION`: Enterprise-wide visibility across all branches.

---

## 3. Authority Limits Engine
Roles store specific numerical limits:
```json
{
  "maxDiscountPercent": 5.0,
  "canOverridePrice": false,
  "maxCreditLimit": 5000.0,
  "maxRefundAmount": 1000.0
}
```
When a user attempts an action exceeding their limit (e.g. Cashier attempts a 15% discount), the backend intercepts the request and creates an `ApprovalRequest` with status `PENDING`.
