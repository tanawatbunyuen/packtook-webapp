# PACKTOOK P214 — G02 Security Coverage Consolidation & Reviewer Evidence Package

**G02_BACKEND_AUTH NO_GO / NO_GO_RELEASE / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.**

P214 converts the P211, P212, P213 security test code and GitHub workflow definitions into a deterministic, strictly pinned source-integrity packet. The P188 isolated candidate SHA256 must equal `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b`. This code does NOT re-interpret historical CI logs as independently verified provider evidence; GitHub Actions in this PR executes P211/P212/P213 anew, and those live CI results are separate from the source packet's static checks.

| Phase | Test coverage | Isolation | Interpretation |
| --- | --- | --- | --- |
| P211 | 23 cases | local Firebase Auth+Firestore Emulator, actual handler directly | No Cloud Functions HTTP/App Check |
| P212 | 23 cases | real SDK v2 `onCall` wrapper, local Express HTTP + Auth/Firestore Emulator | Not actual Cloud Functions Emulator or Staging, missing App Check blocks `usageStatus` |
| P213 | 20 checks including 8 weakened source mutations | local Firebase Auth+Firestore Emulator | Mutations occur only in ephemeral test process; no release candidate mutation |

## G02 checklist for an independent security reviewer
1. Verify exact six-edit P188 source, P189 provenance and handler export parity with the intended deploy artifact — independently establish deployed source, **not** merely a commit/revision label.
2. Review P211–P213 GitHub Actions raw logs, SHA pins and negative tests; local Emulator test success is *not* deployed Staging runtime attestation.
3. Independently obtain separately authorized Staging Auth/Firestore legacy account inventory; verify ownership, revoked/missing ownerUid, cross-tenant cases, and absence of unintended auto-backfill.
4. Independently execute positive and negative G02 backend auth behavior against the authorized exact Staging revision; keep token/UID/raw customer data in secured audit channels, not CI/chat/PR.
5. Have the independently authenticated reviewer sign off in the security audit system. Do not accept an Operator's own approval or a sanitized metadata-only packet as proof.

G02 is **one of eight** immutable P172 release gates. The five P190 external evidence tracks are a separate matrix; neither is automatically completed by this report. G03's historical 403-vs-401 discrepancy, G04 signed production token, G05 recovered Owner provenance, G06 real App Check/IAM/Secrets, G07 billing/monitoring/PDPA and G08 Owner release approval remain blocked.

## Safety and no-go limits
No production/staging reads or writes, Cloud API calls, deploy/merge, migration, recovered Owner import, IAM changes, Omise operations, billing mutations, or public signup. The packet neither authenticates the independent reviewer nor issues security release approval.
