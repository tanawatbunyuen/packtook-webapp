# P63 Staging Callable Security remediation candidate

## Observed actual Staging findings (2026-11-17)
- Full source diverged for five Cloud Functions, despite stable deployed generations.
- Selected Handler AST matched for reserveCredit, finalizeCredit and recoverStaleVideoReservation.
- recordingStatus/usageStatus callback statement tokens matched, but callable options differed.
- A prior wrapper tool reported DIRECT_ONCALL_BOTH=TRUE, while this GitHub review branch
  has guardedCall(options, ...) for both exports. This is a **critical source-integrity
  discrepancy**, not evidence of passing authorization.
- Backend App Check enforcement and functional equivalence remain NOT_PROVEN.

## New P63 security controls
- Reject a locally modified index.js or wrong review branch before reading Staging.
- Parse the immutable Staging source archive for recordingStatus and usageStatus;
  ensure exact scoped guardedCall and pilot/Auth helper tokens, not just callback bodies.
- Check function source generations and updateTime again after inspection.
- Always return NO_GO_RELEASE; no results here can prove backend enforcement.

## Operator commands (Cloud Shell, read only)
```bash
cd ~/packtook-webapp
git fetch origin
git checkout review/p63-security-source-integrity-and-wrapper-guard
npm ci --prefix production/ast-review --ignore-scripts --no-audit --no-fund
gcloud config get-value project
export RR_STAGING_PROJECT_ID=packtook-staging
export P63_ALLOW_STAGING_READ=YES
python3 production/scripts/p63-staging-security-readonly.py --inspect-source
```

Do not use Staging raw source or secrets in chat or logs. Only share the
fixed enums printed by the operator script. If P63_STATIC_SECURITY is
REVIEW_REQUIRED, deployed guard identity is not established. Do not deploy
a candidate until explicitly reviewed and authorized; do not alter Production.
