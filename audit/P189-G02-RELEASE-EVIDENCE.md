# P189 — G02 Release Evidence Integrity and Security Review Package

**Decision: G02 NO_GO; Production NO_GO_RELEASE / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.**

## Deliverables
- Deterministic `audit/p189/verify.js` checks the **entire** original pinned functions backend and the isolated P188 full-backend candidate SHA256, reconstructs the complete candidate from **exactly six source edits**, checks that callable exports are identical, and rejects six synthetic negative mutations of the owner guards, owner bootstrap, new account creation, FieldValue import and recovered Owner import. It is not a substitute for a human code audit.
- Machine-readable `audit/p189/evidence.json` separates 4 already passing local/offline review tracks from 4 actual live/security tracks that remain NOT_VERIFIED.
- No production file edits; no production reads or writes, deployment, Owner import, migrations, or public signup change.

## Six candidate-only edits reviewed by the verifier
1. `assertAdmin` persisted account ownerUid check
2. `authorizeDuplicate` use existing account doc instead of ensureAccount
3. `authorizeDuplicate` ownerUid equality check in transaction and remove legacy auto-owner bootstrap
4. `accountRole` persisted ownerUid check
5. `FieldValue` import from `firebase-admin/firestore` to fix observed HTTP 500
6. `ensureAccount` **new document creation only** includes `ownerUid:id`

## Exact blockers not achievable by local CI
- Independently authorized, read-only real legacy account inspection under P186 (staging and production), with no unapproved ownership data writes. The operator must separately confirm and protect any evidence.
- Real valid staging App Check positive path under P187 and no-token negative path, using approved actual app tokens, correct revision and exact host.
- Verified owner provenance for every ambiguous legacy account, with independently reviewed remediation and rollback plan.
- Human Security reviewer signs off the exact release diff / SDK pins and staging handler/credit regression tests, without bypassing other production release gates.

## Version integrity
Release candidate is generated, **not** written into live `functions/index.js`. The source pinned SHA and candidate SHA are mechanical identity checks; the G02 status remains NO_GO until real evidence and code review are complete.

The G03 strict malformed-token callable protocol, G04 production signature validation, G01 rules review, G05 provenance and G06–G08 remain their own NO_GO gates.

**CI success is NOT Production approval.**
