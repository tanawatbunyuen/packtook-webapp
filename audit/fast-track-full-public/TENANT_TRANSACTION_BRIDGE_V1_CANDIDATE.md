# PACKTOOK Fast Track — Tenant Credit Transaction Bridge V1

Date: 2026-11-28. **Source-only, not wired or deployed.**

Created `functions/tenant-credit-transaction-bridge-v1.cjs` implementing the *actual transaction adapter interface* for the existing pure policy. It calls `tx.get()` on the owner account, reservation, operator membership and when supplied the approval/request references **inside the same Firestore transaction**. It then validates owner-tenant identity, verified-email membership (active/role/account), recorder identity for finalization, and full approval/request/barcode/expiry linkage before the calling transaction would make any writes.

Test: `audit/fast-track-full-public/tenant-credit-transaction-bridge-v1-unit.cjs` covers 13 mock transaction scenarios: allowed/denied reserve, revoked membership, other recorder, old/consumed/expired/mismatched approval, missing request, zero mutation. No Firebase SDK and no Cloud IO. Mock-level assertions are **not Firestore Emulator validation** or actual concurrent transaction tests.

Critical limitations:
- Adapter currently performs **reads and validates** only. It does NOT apply account-credit increments/decrements, create recordings, or consume approvals. The old `functions/index.js` still has original per-UID operations and is **NOT wired** to the adapter.
- A true complete reserve transaction additionally requires reading the barcode lock and full credit wallet state, preserving idempotency, checking available quota and plan, and applying recording/account/lock/approval/request/audit updates atomically in the same transaction. Finalization needs lock state and credit refund semantics.
- Must ensure **all tx.get calls complete before any tx.create/update/set/delete** in each function. Membership revocation must contend on the same membership document in the transaction. The mock demonstrates intended call ordering but cannot prove Firestore conflict behavior.
- Operators must not be able to finalize owner/other-operator records; legacy owner recordings need explicit compatibility behavior. Invited-operator onboarding must not provision a separate account before accepting an invitation.
- The eight proposed operator callables remain isolated. Full integration requires coherent routing of auth, status, device, accountRole, reserve, finalize and billing permissions plus Playwright/Firestore emulator E2E. Existing 22/22 App Check policy remains a source-only check for original handlers.
- **No deployment, no staging writes, no IAM/secret/payment/public-signup changes. FULL_PUBLIC=NO_GO.**

Operator verification (detached worktree):
```bash
node --check functions/tenant-credit-transaction-bridge-v1.cjs
node --check audit/fast-track-full-public/tenant-credit-transaction-bridge-v1-unit.cjs
node audit/fast-track-full-public/tenant-credit-transaction-bridge-v1-unit.cjs
```
Expected: `PACKTOOK_TRANSACTION_BRIDGE_MOCK_CASES=13/13_PASS`, exit zero. This is not already user-verified.
