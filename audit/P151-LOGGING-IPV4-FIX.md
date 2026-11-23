# P151 — Fix remaining Firebase Logging Emulator IPv6 bind failure

The operator's private P150 Cloud Shell log shows **line 3: logging service, port 4500, IPv6 ::1**, and EADDRNOTAVAIL. The P149 checker also reported one remaining port-check failure after P150 pinned the Hub to IPv4. This is stronger direct evidence than the earlier Node26/cache hypotheses.

P151 explicitly configures Firebase Logging Emulator `127.0.0.1:4500`, alongside Hub `127.0.0.1:14400`, Firestore `127.0.0.1:18080` and Auth `127.0.0.1:19099`. It extends the bounded P141 launcher to precheck and watch all four listeners. It retains the `demo-packtook-owner-security` project, deny-all Firestore rules, disabled UI and no Functions Emulator.

## Cloud Shell operator commands

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p151-emulator-logging-ipv4-binding
git worktree add --detach "$HOME/packtook-p151" origin/review/p151-emulator-logging-ipv4-binding
cd "$HOME/packtook-p151"
node audit/p151-logging-ipv4-regression.cjs
bash audit/p141-demo-emulator-start.sh
```

This is a limited, local demo-only emulator startup; it may use the official Firebase tooling network to check binaries. No recovered Owner source is imported or executed, and no staging or production deploy is authorized. If it does not start within 90 seconds the launcher reports a block and keeps diagnostics private. If listeners respond, that is **not** proof of emulator identity or authorization correctness. Keep NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
