# P150 — Explicit IPv4 Emulator Hub binding for Cloud Shell

## Real operator evidence

P149 actual private log: two PORT_CHECK_AVAILABLE indicators, two EADDRNOTAVAIL indicators, four IPv6 ::1 loopback indicators, two IPv4 loopback indicators, four Hub indicators, no EADDRINUSE, no READY. The most strongly supported diagnosis is a failure when Firebase CLI probes the IPv6 loopback for its **Hub**, not a missing JAR or Node22.

Firebase CLI reports frequently show Hub defaulting to both 127.0.0.1 and ::1 when the Hub host isn't explicit. Set the Hub host to 127.0.0.1 explicitly and bind a dedicated 14400 port. Auth and Firestore retain 127.0.0.1:19099 and 127.0.0.1:18080; UI disabled. Keep Firestore deny-all rules and no Functions Emulator or recovered code import.

This is a testable proposed fix, **not yet demonstrated** as a real Cloud Shell startup success. Offline CI with fake Firebase CLI cannot prove runtime success.

## Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p150-emulator-hub-ipv4-binding
git worktree add --detach "$HOME/packtook-p150" origin/review/p150-emulator-hub-ipv4-binding
cd "$HOME/packtook-p150"
node audit/p150-hub-ipv4-regression.cjs
bash audit/p141-demo-emulator-start.sh
```

The bounded launcher checks ports 18080,19099,14400. It uses a private persistent emulator cache and demo project, and will stop if not ready within 90 seconds. Keep it running on success. A successful local listener probe is not proof of Firebase emulator identity or authorization checks. If startup fails, inspect the private log only with redacted P149/P146 scripts; do not paste raw logs.

NO_GO_OWNER_IMPORT / NO_GO_DEPLOY remains.
