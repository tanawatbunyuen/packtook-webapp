# P231.61 — Dedicated test identity decision

Recorded 2026-11-26; operator-supplied read-only Cloud Shell evidence.

Subject: `g02-probe-runtime@packtook-staging.iam.gserviceaccount.com`.

- Direct project binding count: 1.
- Role: `roles/datastore.viewer` with IAM condition. The G02 diagnostic had a named database-only viewer condition; this P231 observation does not itself revalidate the exact condition.
- Direct `roles/firebaseappcheck.tokenVerifier` binding: NOT FOUND.
- Predefined role `roles/firebaseappcheck.tokenVerifier` includes `firebaseappcheck.appCheckTokens.verify`: YES.
- Effective verifier permission for identity: NOT VERIFIED. Absence of a direct binding does not rule out inherited grants, group/custom roles and similar routes.

**Decision:** do not reuse the G02 database-viewing service account for the no-database P231 isolated App Check probe. Prefer a dedicated least-privileged identity with only required verifier permissions and Firebase runtime necessities, after an IAM and invocation architecture review. This report is *not approval* to create identities or modify IAM. A callable exposed directly to browsers and a Cloud Run IAM-protected callable have distinct invocation requirements: Firebase Auth bearer is not interchangeable with Cloud Run IAM identity token.

Next safe step: list only the **names** of existing staging service accounts and whether a named P231 test identity is present (read-only); don't print SA keys or grant any roles. Resolve network ingress, invoker policy, billing impact and cleanup before any deployment. Keep production untouched.

`P231_SERVICE_ACCOUNT_REUSE_G02=NOT_RECOMMENDED`
`P231_DEDICATED_SERVICE_IDENTITY=NOT_VERIFIED`
`P231_EFFECTIVE_TOKEN_VERIFIER=NOT_VERIFIED`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
