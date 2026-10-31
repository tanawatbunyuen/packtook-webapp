# PACKTOOK V5.7 — Local Performance Monitor & Diagnostics

**Status:** committed to `feature/firebase-auth-credits-v4` only, not deployed or browser-tested. **V5.6 Reliability Test remains deferred by the user**; source checks are not proof that long recordings are stable.

## Objective
Measure exactly where time is spent from barcode scan to REC, through STOP, local disk flush, video verification and Firebase credit finalization. Monitor should *not* add a network service or block a scanning workflow.

## New functionality
- New module `firebase-staging/performance-monitor.js`, loaded before `app.js`.
- Dashboard Performance Monitor shows 4 KPI tiles (P95 scan->REC, P95 scan->Stop, P95 Stop->Save/Confirm, completed samples), detailed per-phase P50/P95/max/count, categorized failure counts, latest 8 anonymized samples.
- Range selector: last 1/7/30 days.
- Local storage: `packtook-v5.7-local-perf-v1`; maximum **2,500** samples and **30 days**. Async, best-effort writes; no effect on credit or video state.
- One-click **CSV download** and **clear local diagnostics**; clearing diagnostics does not delete any packing videos, history, account or payment data.
- Phases: `start`, `stop`, `disk`, `verify`, `credit`, `completion`, and `failure`.
- Allowed event fields only: `t` (timestamp), `k` (phase), `ms` (duration), for completion: `mib`, `seconds`; for failure: `stage`, `category`. No Barcode, worker names, filenames, invoice/payment info or customer IDs are recorded.
- Existing console timing remains available.

## No product-owner analytics in this version
V5.7 performance metrics are **per local browser**, not SaaS customer counts or PACKTOOK company sales. The existing backend stores users and payment history but does not yet provide any protected **platform-owner analytics dashboard**. A future release should use **server-side aggregated Firestore payments** and a **separate platform-owner claim** (not the customer `admin` account role), and must distinguish Omise Test Mode transactions from live revenue.

## Deploy: Hosting only
```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only hosting --project packtook-staging
```
Hard refresh Chrome/Edge. No Functions or Firestore changes are required.

## Suggested validation
1. Dashboard loads with “—” for percentile metrics before observations (never invented data).
2. Save 5 short test videos; 4 phase metrics and completion samples populate.
3. p50/p95/max sort correctly from same machine's samples; range selector changes visible rows.
4. Repeat 1 failed reservation (e.g., quota exhausted on a **test account**): failure counter increments by a category, with no user or Barcode in CSV.
5. CSV contains only approved fields, nothing from private orders.
6. Force browser storage unavailable: monitor alerts gracefully; Recording still works.
7. Clear diagnostics: only local performance history resets, credits and videos unaffected.
8. On mobile/narrow desktop, tiles and table remain readable.
9. Verify V5.6 REC/SAVING, local video file, IndexedDB history and credit are still correct after several captures.
10. Revisit V5.6 deferred long-form RAM/network recovery tests before production use.

**Source validation:** 17/17 static integration checks passed. No real-webcam/browser acceptance yet.
