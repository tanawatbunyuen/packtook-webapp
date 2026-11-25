# P231 — Staging App Check and Backend Provenance Gate
Date: 2026-11-25
Status: REVIEW_ONLY / NO_GO. No deploy, IAM edits, token collection, production access, source replacement, or signup changes.

## Findings
1. Operator-attested P227/P228/P229 G02 read-only synthetic Firestore diagnostic passed under dedicated staging runtime identity, revision g02requestshapeprobe-00002-wap. The diagnostic does **not** use a Firebase App Check-protected callable and cannot close the valid-client App Check gate.
2. P208 evidence validator requires three actual staging cases: MISSING_TOKEN (denied), VALID_TOKEN (accepted), INVALID_TOKEN (denied), with *trusted verifier*, authenticated caller and externally pinned revision. An HTTP 200/403 pair by itself is not enough.
3. GitHub P70 workflow reported failures on PR/push history even though its trigger configuration targets only historical branches. Run 45649494246 reports zero jobs via GitHub jobs API; failure origin not independently established. Do not edit or disable it as a workaround.
4. GitHub main is V3.4 static demo, not proof of Firebase SaaS release artifact.

## Safe operator action
From authenticated Cloud Shell with gcloud project selected as packtook-staging:
```bash
bash audit/p231/inspect-staging.sh
```
This reads metadata and IAM policies only, checks pinned G02 probe revision and runtime identity, and intentionally DOES NOT perform App Check E2E, call a customer API, or collect tokens.

## Required new evidence
- Exact staging *protected callable* function resource + URL, pinned deployed revision, source ZIP digest and dedicated service identity attested separately from GitHub candidate.
- Trusted, authorized staging test account; legitimate App Check browser token is verified only in the live request, never copied to terminal, logs, repo or chat.
- Same callable/request/auth context: missing token denial, genuine valid client success, malformed token denial. Compare sanitized status/classification only, no raw token and no customer data.
- Confirm App Check enforcement occurs before handler side effects. No writable operations on real customer accounts; use staging fixture with explicit safe behavior.
- Evidence collection must be performed by authenticated operator; independent security reviewer must sign off and may require additional controls.

## Exit criteria
A PASS of inspect-staging.sh proves isolated probe metadata only, not P231 App Check PASS.
STAGING_VALID_APPCHECK remains NOT_VERIFIED until real three-way positive/negative testing on a protected staged callable.
PROD_LEGACY_INVENTORY, OWNER_PROVENANCE_REMEDIATION and EXACT_RELEASE_DIFF_SECURITY_SIGNOFF remain NOT_VERIFIED.
G02 RELEASE=NO_GO; PUBLIC SIGNUP=KEEP_CLOSED.
