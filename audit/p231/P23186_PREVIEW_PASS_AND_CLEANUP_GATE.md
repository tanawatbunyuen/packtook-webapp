# P231.86 — Isolated artifact preview PASS and cleanup gate

Recorded 2026-11-26. **Operator-reported** Cloud Shell output:
- Node22 PASS
- Source lockfile SHA256 PASS
- Source precheck PASS
- Single isolated codebase PASS
- Deploy file whitelist PASS
- Private options PASS
- Preview exit code 0
- Temporary preview directory reported: `/tmp/tmp.AAD1igssJ4` (ephemeral; don't rely on persistence)
- IAM writes 0, Firebase writes 0, function deployment NOT_PERFORMED, App Check runtime NOT_VERIFIED.

## Pre-deployment risk decisions

1. **Deploy scope:** create only the new `p231AppCheckIsolatedProbe` Function in staging. Never call root repo deploy scripts, bulk functions deployment or `--force`. Use a separately constructed and reviewed Firebase codebase and CLI syntax verified against installed version; before running, print local deployment source list and exact target.
2. **Private invocation:** `invoker:'private'` is pinned in candidate source, but deployment has not validated actual Cloud Run service IAM. `roles/run.invoker` should be limited to authorized test operator principal on **new service only**, granted only after verifying deployed service identity, never project-wide or allUsers. Cloud Run IAM ID token and Firebase Auth ID token remain separate credentials.
3. **Cleanup:** before deployment, identify exact region/name, budget/log limitations, expiry and ownership of test service. After testing, remove only the isolated function and its service-level invoker binding; never delete existing `usageStatus`, `recordingStatus` or `accountRole`. A CLI `functions:delete` command is inherently destructive and not authorized by this review; exact deletion target needs separate confirmation. Dedicated P231 runtime SA/role are also retained until separately reviewed and approved for removal.
4. **No secrets:** do not print/store Firebase Auth ID tokens, Firebase App Check tokens, or Google ID tokens in the repo, Cloud Shell transcript or logs.
5. **Additional checks:** assess deployment operator's serviceAccountUser permission and API/billing prerequisites without granting broad privileges. Check effective IAM and Org policies where permitted. No assumptions of role sufficiency from direct policy alone.
6. **Test evidence:** pinned revision, same endpoint and method (callable POST), synthetic verified test user, VALID App Check should return fixed response, MISSING and INVALID should fail specifically in App Check verification path. A handler context-check alone is insufficient evidence. Stop on unexpected results.

## Gates
`P231_DEPLOY_ARTIFACT_PREVIEW=PASS_OPERATOR_REPORTED`
`P231_DEPLOY_SCOPE=DOCUMENTED_ONLY`
`P231_INVOKER_PRINCIPAL=NOT_SELECTED`
`P231_CLEANUP_PLAN=DOCUMENTED_NOT_APPROVED`
`P231_DEPLOY_APPROVAL=NOT_GIVEN`
`P231_FIREBASE_WRITES=0`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
