# P231.164 — Staging live Hosting release pin and recovery plan (read-only)

## Confirmed evidence
The owner supplied P231.163 output showing three key facts:
- `P231_API_RESULT=HTTP_200_BOTH` for Live Channel and its Version resource.
- `P231_P231162_PIN_EQUALS_CURRENT_LIVE_RELEASE=YES`, `P231_P231162_PIN_EQUALS_CURRENT_LIVE_VERSION=YES`.
- `P231_CURRENT_LIVE_VERSION_STATUS=FINALIZED`, `P231_RELEASE_CURRENT_VERIFICATION=PASS`.

The reference observed on 2026-11-26 in P231.162 is:
- Release: `sites/packtook-staging/channels/live/releases/1794125129869000`
- Version: `sites/packtook-staging/versions/840e12c0c88d8c1c`
- Release timestamp: `2026-11-08T08:05:29.869Z`.

P231.164 records these **non-secret resource references** in a checked-in, reviewable JSON evidence pin at `audit/p231/isolated-test/p231164-staging-live-release-pin.json`. It explicitly records that rollback execution, full backup, and deployment permissions are absent; it must not serve as an approval token.

## Read-only revalidation
`audit/p231/isolated-test/p231164-verify-pinned-release-readonly.py` validates the pinned schema and then makes exactly three Firebase Hosting GET requests using the existing gcloud login:
1. GET the current staging live Channel
2. GET the specific pinned Release
3. GET the specific pinned Version

The code checks cross-resource Release→Version matching, whether the pin is **still current** on live, `FINALIZED` Version status, and release timestamp matching. It prints only expected non-secret flags and enum, never bearer credentials, raw JSON, or source contents.

**If another deployment happens**, `PIN_EQUALS_CURRENT_LIVE=NO` is expected; it is not evidence that the pinned old version was deleted or cannot be restored. The old version's metadata is inspected separately. Exit 3 means metadata changed or further review is needed. Exit 2 means query/validation failure. Exit 0 means metadata checks passed, not rollback was tested.

## Recovery runbook — planning, not execution
- Before a proposed staging deploy, independently verify current live Hosting Channel release matches intended rollback baseline and pin its immutable version; a changed live release requires a new reviewed baseline.
- Verify the version's availability and obtain an owner-reviewed staging rollback procedure based on Firebase Hosting's supported release/rollback mechanisms; do not improvise REST write calls.
- Preserve a verifiable **complete** candidate Hosting artifact and externally review the complete asset manifest and source drift; a seven-file audit is not a complete Hosting backup.
- Define objective rollback triggers (loss of App Check header, HTTP error in protected status read, unexpected public-signup opening, key/config mismatch, missing app resources).
- If a later authorized staging Hosting deployment fails, stop tests and follow the separately approved rollback operator procedure; do **not** execute cleanup, Firebase Admin writes, IAM edits or production operations.
- Production, billing, monitoring and PDPA release gates remain separate.

This phase performs no deployment, rollback, IAM changes, Cloud Function invocations, user data access, or credit/billing changes. Public signup remains closed and production release **NO_GO**.

P231164_PIN_DOCUMENTED=YES
P231164_PIN_REVALIDATION=AWAITING_OPERATOR_RESULT
P231164_ROLLBACK_PROVEN=NO
P231164_HOSTING_DEPLOY=BLOCKED
P231164_RELEASE=NO_GO
