# P130 — Recovered Owner Source static security triage

The operator successfully recovered the P127-attested ZIP under a private HOME quarantine with archive SHA-256 matching `e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456`. Four Owner function symbols were confirmed, archive extracted six files.

P130 scans **only local recovered files** against local SHA-256 manifest and compares symbol presence with reviewed `functions/index.js`. It reports counts of generic static risk indicators. It never prints secrets, matched lines, source contents or filenames, never executes recovered code and never modifies Cloud or GitHub. The report is **triage**, not a secure-code certificate.

### Operator command (in isolated worktree)

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p130-recovered-owner-source-security-audit
git worktree add --detach "$HOME/packtook-p130" origin/review/p130-recovered-owner-source-security-audit
cd "$HOME/packtook-p130"
python3 audit/p130-owner-source-static-audit.py --review-repo "$PWD"
```

Default recovery folder: `~/.packtook-recovery/p128-owner-e82154a69b8d`.

Interpretation: credential-related patterns can be false positives, and absence of indicators does **not** prove safety. Security review must assess authorization for all four Owner callables, tenant isolation, verified email, idempotency and credit accounting, logging, secrets, dependencies, dangerous data writes, cross-account management privileges and possible payment interactions. Do not paste recovered source or secrets into chat or commit to GitHub.

**NO_GO_DEPLOY** remains, including Firebase source provenance, four missing Owner exports in reviewed source, and the App Check staging runtime gates.
