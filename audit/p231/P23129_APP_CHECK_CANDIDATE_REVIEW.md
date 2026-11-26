# P231.29 — Staging App Check candidate evidence (operator-reported)

Date: 2026-11-26
Scope: `packtook-staging` only. Security review evidence, **NOT** deployment authorization.

## Baseline observations
- Browser's genuine `usageStatus` call returned HTTP 200 with Firebase Auth and App Check headers (header presence confirmed by operator; token validity not independently verified).
- Browser interception tests reported `VALID=200`, `MISSING=200`, and `INVALID=200`, with intercepted requests 1/1 and modifications 1/1 on negative cases. **These results indicate a likely enforcement gap;** full wire-level evidence and independently confirmed revision routing remain outstanding.
- Staging source ZIPs were downloaded at pinned storage generations, operator-reported; different function source snapshots must not be conflated with the GitHub repository source.

## Local patch candidates (not deployed)

| Function | Staging index.js SHA256 | Candidate index.js SHA256 | Operator AST |
|---|---|---|---|
| usageStatus | 25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3 | 4c855895c57f1c1983a8292b751ae38b0462fc9cbc3844da9bc698d600ad56f0 | Original FALSE, candidate TRUE |
| recordingStatus | 9505852f7dda3c3d4060abad4b514f2cd744d5edd98c8e610a9386caf4c46d20 | f85443b068207dc99f1bc8be8acb049344506bbf621e4edbeb4e836f21cac34a | Original FALSE, candidate TRUE |
| accountRole | 9a7b82c11272685e77be529d74c453016a74e8f7368335840e58812cf2e14b20 | 5a517cda66df2b0d7d0b39beb293ca9c6b912ea5ac1856b761d06d8f55e99219 | Original FALSE, candidate TRUE |

Operator reports: exact one-change patch validation 3/3 PASS; Node syntax 3/3 PASS; package manifest 3/3 FOUND; ephemeral npm SDK dependency resolution 3/3 PASS; AST options inspection 3/3 PASS. Source packages contain `index.js` and `package.json` but no package-lock; npm install used `--package-lock=false` so dependency reproducibility and actual deployed dependency provenance are **not verified**.

## Required next gates
1. **Source provenance:** pin deployment Build, Cloud Run revision, function source generation/digest, Node runtime, and compare all package dependencies with the versions actually deployed. Never deploy a whole restored function snapshot to replace a different live revision without a full diff and impact review.
2. **Static behavior:** inspect exported `onCall` options, auth enforcement, permission checks, and side effects with full-source analysis; AST confirmation alone does not verify security.
3. **Isolated staging runtime:** use a dedicated non-public test function and synthetic/demo project data; verify authentic valid App Check token + authenticated test user success, missing/invalid App Check denied **for App Check reasons**, same request/auth context, pinned serving revision, no Firestore writes or credit mutations. Do not expose tokens in browser console/repo/logs.
4. **Client compatibility:** legitimate PACKTOOK staging browser must send valid App Check token on each affected function; check authenticated and account-role paths before rollout.
5. **Review:** security signoff and operator approval before any staging or production deployment. Retest exact target revision after any staging deployment.

## Decisions
- `P231_STATIC_CANDIDATE=3/3_PASS_OPERATOR_REPORTED`
- `P231_RUNTIME_APPCHECK=NOT_VERIFIED`
- `P231_STAGING_DEPLOY=NOT_PERFORMED`
- `P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
- `PUBLIC_SIGNUP=KEEP_CLOSED`
- `P231_RELEASE=NO_GO`
