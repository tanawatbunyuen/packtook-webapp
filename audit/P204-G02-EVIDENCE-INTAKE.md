# P204 — Independent Security Evidence Intake Controls

**Mode:** REVIEW_ONLY / OFFLINE. **NO_GO_G02, NO_GO_RELEASE, NO_GO_DEPLOY, KEEP_PUBLIC_SIGNUP_CLOSED.** No independent reviewer, real operator, Cloud SDK, or cryptographic trust anchor is authenticated by this code.

## What changed
- A strict sanitized metadata intake in `audit/p204/intake.js`, linked to P190's five pinned requirements and P203 handoff.
- Each record may be **SUBMITTED** (metadata valid) or **REJECTED** (unsafe or inconsistent). **INDEPENDENTLY_VERIFIED is intentionally unavailable in this offline implementation**, and no input boolean or signed-off text can promote it.
- Validates exact staging / production project, evidence kind, P188 candidate SHA, P198 Build ID, P200 revision, time order, record SHA syntax, operator role *claim*, and ticket/reference format.
- Rejects raw fields such as emails, IDs, access tokens, unknown types, stale timestamps, wrong project, and duplicate/replay references.
- SHA-256 receipt fingerprint is derived only from sanitized metadata. It is **not proof** that the source document, operator identity, or reviewer is authentic. Never use as evidence signature.

## Trust requirements outside this workflow
A genuine Independent Security Reviewer must examine the protected original provider evidence under an independently authorized role and record the results in an authenticated external audit system. The reviewer must separately verify complete staging and production legacy inventory (production requires explicit authorization), real staging App Check token provenance and positive/negative requests, Owner provenance conflicts, exact P188 source/build/revision lineage and release diff. The source archive and Build-output image digest remain unverified.

The Cloud Build SUCCESS, Cloud Run revision-ready image, missing Artifact Registry versions and seven-day Cleanup Policy are operator-supplied metadata. Absence of a deletion audit log does not prove that an image wasn't deleted.

## Verification limits
Tests under GitHub Actions use synthetic offline fixtures only. No network, user accounts, Auth/App Check token use, deployment, migration, billing, IAM mutation, cleanup-policy edit, merge or public signup.

**Review decision: HOLD.** External independently verified P190 tracks: **0/5**. Production release gates **0/8**.
