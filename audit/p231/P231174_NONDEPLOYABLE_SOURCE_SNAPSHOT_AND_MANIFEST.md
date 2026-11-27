# P231.174 — Persistent NON-DEPLOYABLE offline source snapshot + full asset manifest

## Observed P231.173 result
Operator returned `P231173_BROWSER_GATE_EXIT_CODE=0`. Local source preflight succeeded. Node and npm available. Chromium executable **NO**, Playwright Node package **NO**; no browser was launched. Candidate registered test origin not available. Decision `BLOCKED_BROWSER_RUNNER_ORIGIN_AND_ARTIFACT`. An exit 0 is **inspection-only**, not browser readiness or runtime verification.

## Phase purpose and hard boundary
Avoid fabricating a real-browser test or installing browser dependencies into Cloud Shell. P231.174 instead makes an actual persistent **offline source review snapshot** so reviewers can inspect all 12 local Hosting assets as a single deterministic package. **It is deliberately NOT DEPLOYABLE.**

`audit/p231/isolated-test/p231174-nondeployable-source-snapshot.py`:
- Verifies `firebase.json` Hosting directory and ignore rules.
- Requires **exactly 12** local included source files, the seven core files and the **P231.167 non-config full-directory SHA-256** `1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098`.
- Requires the repository staging Enterprise public-site-key export remains **empty**. It NEVER injects or copies a key and makes **no public Hosting GET requests**.
- Refuses symlinks and certain risky extensions. Preserves exact contents as a deterministic ZIP (constant timestamps, fixed file mode and ordering).
- Builds two ZIPs in memory and asserts byte parity; extracts every entry in memory and verifies byte parity with source.
- Writes exactly two local `/tmp/packtook-p231174-review-only` output files: `p231174-NONDEPLOYABLE-source-snapshot.zip` and `p231174-source-manifest.json`, with permissions 0600. The manifest includes all 12 filenames, lengths and per-file SHA-256 values, archive SHA-256 and explicit false release-authority flags.
- Prints only aggregate hashes/counts and fixed local output path; does not print site key, tokens, source contents or per-file manifest.

Because local `index.html` is **not reconciled** to Hosted script versions and the public site key is **blank**, this snapshot cannot reproduce the previously tested P231.169/170 temporary reconciled candidate. It must not be uploaded to a Hosting channel as a candidate or considered a proper rollback backup.

## Post-P231.174 gates
1. Review and reconcile Bridge/Config/Index, then construct a separate **reviewed staging-only candidate** with an approved public-key provisioning process, a complete immutable asset manifest and versioned source commit.
2. Enable a supported local browser runner for isolated, fully mocked browser smoke, then a separate approved **registered-origin** real App Check test. Do not claim Node VM fixtures equal browser runtime.
3. Verify official Firebase CLI packaging, deterministic build inputs, and supported rollback procedure; seek explicit approval for **staging Hosting-only** deployment.
4. Keep public signup closed, no credit/billing business writes and production NO_GO.

P231174_OFFLINE_SNAPSHOT=PREPARED_AWAITING_OPERATOR_RESULT
P231174_DEPLOYABLE_ARTIFACT=NO
P231174_RUNTIME=NOT_VERIFIED
P231174_RELEASE=NO_GO
