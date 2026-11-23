# P152 — Primary emulator readiness and private latest-error diagnosis

Operator P151 reports configuration checks PASS but P141 still times out at 90 seconds. Earlier log showed IPv6 ::1 EADDRNOTAVAIL on logging port 4500; the most recent log has **not yet been classified**. P141 has been requiring all four listener ports to respond, though the user's functional goal is Auth and Firestore. P152 corrects readiness to require only 127.0.0.1:18080 (Firestore) and :19099 (Auth), retaining pre-launch port collision checks across 18080, 19099, 14400 and 4500. Hub and logging can be auxiliary components; checking primary ports only does not attest their service identity or correctness.

A new P152 local-only diagnostic categorizes the most recent private P141 log's IPv6 bind errors without echoing log lines or paths.

## Run offline log diagnostic before starting anything

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p152-primary-emulator-readiness-gate
git worktree add --detach "$HOME/packtook-p152" origin/review/p152-primary-emulator-readiness-gate
cd "$HOME/packtook-p152"
node audit/p152-primary-readiness-regression.cjs
python3 audit/p152-last-startup-status.py
```

If P152 reports IPv6 binding errors from the latest startup, do not restart and investigate the exact remaining port. If it reports no IPv6 errors, one controlled local demo-only startup can be attempted with the corrected readiness gate: `bash audit/p141-demo-emulator-start.sh`. This may contact official emulator binary download infrastructure. It does not authorize importing recovered Owner code or any Cloud deployment. NO_GO_OWNER_IMPORT and NO_GO_DEPLOY remain.
