# P217 — G02 Owner / Tenant Adversarial Execution

This is an **executed demo-only Firebase Auth/Firestore Emulator integration test** for the exact P188 Candidate, not a production or Staging cloud runtime probe.

Real Firebase Auth Emulator tokens are verified with Firebase Admin SDK. The exact P188 handler code is run against real Firestore Emulator (SDK) transactions with deliberately forged client `accountId`, `ownerUid`, `uid`, `role`, and `approvedBy` fields and cross-tenant barcode attempts.

P217 detects whether an attacker can make another account receive a duplicate approval, impersonate Admin, silently backfill a legacy Owner, bypass unverified user checks, or change tenant account ownership. P212 repeats local Firebase v2 SDK onCall HTTP protocol tests; P213 repeats negative mutation sensitivity tests. No App Check positive-token probe is performed.

**Trust boundary:** The tested candidate SHA256 is `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b`. Auth Emulator tokens do **not** prove real Google-signed production tokens; no CI run proves this candidate is deployed to Staging. The Cloud Functions runtime source ZIP, real Staging App Check, external owner inventory and independent security signoff remain unverified. G02 is NO_GO; all eight release gates remain NO_GO.

No merge, deploy, IAM changes, production/staging data read or write, payment actions, user migration or public signup changes.
