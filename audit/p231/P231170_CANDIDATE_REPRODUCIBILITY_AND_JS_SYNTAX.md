# P231.170 — Deterministic transient build + JS syntax gate

## Verified P231.169 user output
- Temporary reconciliation candidate: **10/10 PASS**, exit 0.
- Hosted Index adopted only after version-query-only parity check.
- Local repository Bridge and its status-call fail-closed guard preserved.
- Public staging Enterprise site key injected into temporary candidate Config only.
- Candidate discarded. No persistent build, Firebase CLI packaging comparison, runtime smoke or deployment.
- Hosting and production remain NO_GO.

## New reproducibility gate
`audit/p231/isolated-test/p231170-candidate-reproducibility-js-syntax.py` uses a single public-asset read to access hosted Index, Bridge and Config, validates known staging project and public key placement without printing keys or source, then creates **two separate temporary full Hosting-directory candidate copies**. Each copy gets the same hosted Index version references and staging-only public site key in a temporary Config. It compares complete local asset inventories and every candidate file's SHA-256 digest between the two builds, and verifies all unrelated assets still match the repository bytes. Using Node.js installed on Cloud Shell, it runs `node --check` on the candidate's six JavaScript modules/files (including config and Bridge), without executing them.

All candidate files exist only under `TemporaryDirectory`; they are deleted when the process exits. No artifacts are persisted, and no byte hashes derived from the public key or source contents are printed. The manifest comparison is entirely in process memory.

## Meaning and boundaries
If `P231_CANDIDATE_BUILD_REGRESSION=PASS_TRANSIENT_ONLY` and exit 0, the two generated local candidate trees were byte-equivalent and the JavaScript syntax checks passed. This is **stronger than static string checks**, but it is not a browser runtime or Firebase Hosting deployment rehearsal. It cannot prove reCAPTCHA domain registration, SDK token attachment, callable response behavior, official Firebase CLI packaging, or rollback availability.

Release blockers remain: source/hosted Bridge+Config differences by design, an independently reviewed complete persistent candidate artifact, candidate browser runtime verification in an authorized staging environment, rollback exercise/procedure and explicitly scoped deployment authorization. P231.164 current live release pin remains metadata-verified, not rollback-proven.

No Cloud Functions, IAM, database writes, credit, billing, deployments or public signup activation. Production NO_GO.

P231170_CANDIDATE_REPRODUCIBILITY=PREPARED_AWAITING_OPERATOR_RESULT
P231170_HOSTING_DEPLOY=BLOCKED
P231170_RELEASE=NO_GO
