# P135 — Owner write-security gate and emulator test contract

## Grounded evidence
P128 source recovered to a private Cloud Shell quarantine with SHA-256 and four Owner symbols matching the deployed staging archives. P134 actual local AST analysis found Auth/Deny indicators but no proven guard-before-mutation and no detected Owner Role or App Check indicators. Two Owner callables contain direct and helper mutation candidates. This evidence is saved in `audit/p135-operator-p134-evidence.json`.

**Important:** a green offline CI run means the blocking gate is correctly triggered, not that any authorization or customer credit mutation is secure.

## Required manual tests in isolated emulators (no production/staging writes)
| Function | Auth/role cases | Tenant isolation | State / concurrency cases |
|---|---|---|---|
| ownerGetCustomerAdjustmentHistory | anonymous, customer, non-owner, verified owner | customer A must not access B | audit records match permitted account |
| ownerGetCustomerManageState | anonymous, customer, non-owner, verified owner | customer A must not access B | never disclose sensitive account/payment details |
| ownerGrantVideoCredits | anonymous, customer, non-owner, verified owner | cannot grant to unrelated tenant | duplicate op ID, invalid signed amount, parallel grants, ledger total |
| ownerUpdateCustomerExpiry | anonymous, customer, non-owner, verified owner | cannot edit unrelated tenant | invalid date, expiry rollback rules, parallel updates, idempotency and ledger |

Required for *every* callable: proof that the correct Owner/Admin role is derived from trusted server-side identity; verified email policy; App Check strategy; input schema validation; consistent permission denied on failure; authorization before reads and writes; isolation across accounts; privacy-safe audit event; rate limits and abuse handling. All mutating tests must run against isolated **emulator/demo** data, never real production or staging tenants.

## Next substantive implementation
Review the private recovered source locally (do not paste into a chat or push archive to GitHub). Build a **separate emulator-only** harness with test fixtures and an explicit environment guard (`FIRESTORE_EMULATOR_HOST` / demo project); do not import or run recovered Owner handlers until their module initialization side effects and secret dependencies have been reviewed. Add tests confirming errors and no database changes for unauthorized callers; credit/expiry invariants under duplicate and concurrent operations.

Until review and independently attested source provenance are complete, keep P121 owner-source drift gate and **NO_GO_DEPLOY**. App Check staging E2E, existing P117 readiness and production release gates remain pending.
