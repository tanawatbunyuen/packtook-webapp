# P206 — G02 Authorized Security Review Execution Preparation

**Status: OFFLINE PREPARATION ONLY. G02 NO_GO, RELEASE NO_GO, DEPLOY NO_GO, PUBLIC SIGNUP CLOSED.**

The P205 dashboard enumerates five outstanding P190 independent-verification requirements. P206 turns these into nine separate, pinned review preflight tracks. **No live Staging App Check test or source archive retrieval has occurred.** These are operator/reviewer runbooks, not authorization to execute them.

## Phase A — Staging checks, gated by independent operator authorization
1. **STAGING_APPCHECK_NEGATIVE:** Authorized staging operator confirms exact function `usageStatus`, project `packtook-staging`, region `asia-southeast1`, revision `usagestatus-00021-nob`. Use an approved test identity/workload; capture only redacted status, timing, provenance of no-token request. A 401/403 is evidence of denied request, not sufficient alone for enforcement verification.
2. **STAGING_APPCHECK_POSITIVE:** Use a legitimate, valid App Check token **without storing or pasting it into logs/CI/chat**; compare positive acceptance and negative denial on same pinned deployment. Confirm Auth context and expected callable semantics separately. An HTTP status alone cannot prove whether authorization was correct. No payment or user record changes.
3. **SOURCE_ARCHIVE_PROVENANCE:** Reviewer traces Cloud Build `8dc6958c-b6dc-4188-a675-2740b18f7098`, GCS `usageStatus/function-source.zip` generation `1794070024475037`, and original source archive bytes. Do not assume archive contents from the storage label; if source unavailable, mark gap unresolved.
4. **BUILD_OUTPUT_DIGEST + REVISION_IMAGE_DIGEST:** Reviewer independently retrieves actual build output digest (not present in previous supplied output), compares to exact Cloud Run revision image digest, and notes Artifact Registry seven-day cleanup gap. An unavailable artifact is NOT grounds to invent digest equality.
5. **INDEPENDENT_DIFF_REVIEW:** Independent reviewer compares pinned candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` with deployed source. The Nov 7 revision predates P188; do not claim P188 shipped or App Check is secure without source/runtime verification.

## Phase B — Account/Owner evidence (never automatically execute)
- **STAGING_AUTH_FIRESTORE_INVENTORY:** authorized bounded READ-ONLY aggregate Auth/Firestore review, privately retaining any sensitive original records.
- **PROD_AUTH_FIRESTORE_INVENTORY:** requires **separate explicit Production READ authorization**, not granted by this development request.
- **OWNER_PROVENANCE_REVIEW:** independent reviewer resolves identity provenance and owner-conflict questions without writing or backfilling accounts.

## Safe run protocol
- Protected original evidence and attestation stay in independently controlled security records. Do not send raw Auth/App Check tokens, customer identifiers, secrets, IAM keys, source archive or account lists to GitHub/CI/chat.
- P206 `preflight.js` checks only sanitized synthetic/offline *claims* for scope, explicit project, pinned Build/Revision/P188 candidate, read-only flag and metadata shape; no impersonated approval or locally valid JSON can unlock GO.
- If an authorized future operator obtains evidence, review it independently. The current code does **not** authenticate who ran a command, or authorize any command to execute.
- Do not modify Cloud resources, policies, IAM, Functions, App Check, Omise or public signup as part of this PR.

## Outcomes
P206 review readiness: preflight fixtures, strict denial for production/staging scope drift, and preserve P172 8/8 NO_GO gates. Independent verified evidence still 0/5. No deployment or merge.
