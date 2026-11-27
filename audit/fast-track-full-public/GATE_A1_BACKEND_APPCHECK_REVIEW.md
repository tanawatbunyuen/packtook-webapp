# Gate A1 — Delta classification and backend policy risk

Review date: 2026-11-27. No deploy, signup change, cloud mutation, or access to user accounts.

## GitHub source review (directly inspected)
`firebase-staging/firebase-packing-bridge.js`: 28 named frontend callable wrappers, two explicit `protectedApi` calls (`usageStatus`, `recordingStatus`). Rest use `api`. This frontend choice is not direct proof of backend App Check enforcement.

`functions/index.js` inspected (source excerpt near beginning):
- `const options={region,maxInstances:20,timeoutSeconds:30};` — no explicit `enforceAppCheck`.
- `const statusOptions={...options,enforceAppCheck:true};`.
- `exports.usageStatus=onCall(statusOptions,...)`.
- `exports.reserveCredit=onCall(options,...)`.

**Risk for Full Public:** App Check backend enforcement is visibly different across at least these two Callables. For public-release threat modeling, verify the intended policy per sensitive endpoint (credit write, device, account, payment, admin/operator). Do not claim application-wide App Check. At minimum, review authorization and anti-abuse of any endpoint deliberately left without App Check enforcement, with explicit security owner acceptance if this is intended. This is a **confirmed source configuration difference**, not evidence that the current deployed Functions have this exact configuration.

## Exact hosted Bridge diff — further verification required
Owner-operated static comparison found four Bridge difference blocks, but the actual block semantics remain unknown. The public hosted source could not be fetched from this runtime, so do not invent what the blocks contain.

`gate-a1-redacted-hosted-bridge-diff.py` reads the exact pinned review ZIP and performs three **public static GETs only** (Bridge/Config/Index). It prints each changed block's candidate/hosted line numbers and coarse semantic markers, with no raw snippets, public site keys, tokens, secrets, URLs or source text. Exit 0 means four observed blocks and equal callable wrappers; it **does not** approve A1. If source drift or unexpected number of blocks => exit 3 and review. It needs the already prepared /tmp Candidate; no rebuild unless missing.

## Decision
- A1 remains OPEN pending examination of the four actual code differences, targeted Auth/App Check behavior changes, and owner/reviewer security acceptance.
- A2 local artifact integrity and packaging PASS, official Firebase CLI packaging equivalence NOT PROVEN.
- A3 Playwright/Chromium mock smoke PASS_OFFLINE_ONLY, real browser App Check remains Gate B.
- A4 rollback runbook prepared; exercise not authorized.
- Gate B C remain blocked, Full Public NO_GO.
