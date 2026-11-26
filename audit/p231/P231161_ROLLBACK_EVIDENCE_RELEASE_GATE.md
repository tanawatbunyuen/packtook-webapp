# P231.161 — Rollback evidence and release gate

## Operator-confirmed P231.160 manifest
- `P231160_MANIFEST_EXIT_CODE=0` means the inventory completed, not release approval.
- Seven public Hosting assets inspected: four byte-equal; three drift (`index.html`, `firebase-v4-config.js`, `firebase-packing-bridge.js`).
- The repo Config still exports an empty staging public Enterprise site key.
- `P231_ROLLBACK_SNAPSHOT_PERSISTED=NO`
- `P231_ROLLBACK_FIREBASE_HOSTING_VERSION_PIN=NOT_CAPTURED`
- `P231_CANDIDATE_BUILD_PERSISTED=NO`
- `P231_CANDIDATE_RUNTIME_SMOKE=NOT_PERFORMED`
- `P231_RELEASE=NO_GO`

## Offline rollback-readiness gate
`audit/p231/isolated-test/p231161-rollback-evidence-gate-offline.py` validates the expected Hosting public directory, reads the **template** and optionally examines a local, owner-created evidence file at `audit/p231/isolated-test/p231161-rollback-evidence.json`. It **never creates or modifies** this file and **never** prints values from it. An absent evidence file is the correct current state.

Template: `audit/p231/isolated-test/p231161-rollback-evidence.template.json`.

Evidence fields intentionally separate: previous pinned Hosting release/version, immutable candidate manifest digest, operator-reviewed rollback procedure, candidate runtime smoke, specific staging Hosting deployment authorization and target scope. Merely populating fields does not validate them or grant deploy authorization; the gate **always returns exit 3** and `RELEASE=NO_GO` until a separate independent review flow exists. Its purpose is to prevent accidental elevation of offline test results into deploy permission.

### Material blockers and next decisions
1. Capture the current Firebase Hosting release/version using an authorized **read-only** Hosting administrative query; independently verify release belongs to the intended **staging** site. Do not infer version IDs from static HTML or invent a release pin.
2. Preserve or document an official Firebase Hosting rollback route using the pinned release. A public static GET of seven assets is **not** a full rollback snapshot.
3. Prepare and independently review a reproducible complete Hosting candidate, with staging-only public site-key provisioned in a controlled build and fail-closed behavior preserved. The P231.159 candidate was intentionally discarded and cannot be used as a rollback/deploy artifact.
4. Validate candidate runtime in an authorized staging test, including protected status callable and public signup remaining closed.
5. Explicit owner authorization for a **Hosting-only** staging deploy is required independently of this audit; never run an unscoped Firebase deploy. Production remains NO_GO.

## Scope
No cloud calls, browser tokens, credential acquisition, business API calls, IAM changes, artifacts written, deploys or cleanups.

P231161_ROLLBACK_EVIDENCE_GATE=PREPARED_AWAITING_OPERATOR_RESULT
P231161_RELEASE=NO_GO
