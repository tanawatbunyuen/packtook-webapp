# P140 — Start only local Firestore and Auth emulators

The operator's P138 output showed `CONNECTION_FAILED` at ports 18080 and 19099. This is expected when no emulator service is running. It is **not** an Owner authorization or Security failure.

P140 supplies a separate firebase config containing only Firestore and Authentication emulators, both strictly bound to `127.0.0.1`, plus deny-all Firestore Security Rules. The launcher checks for preexisting listeners, Firebase CLI, Node and Java. It launches **only** Auth and Firestore, never the Functions emulator and never recovered Owner source.

## Run in Cloud Shell — in its own foreground tab

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p140-demo-emulators-startup
git worktree add --detach "$HOME/packtook-p140" origin/review/p140-demo-emulators-startup
cd "$HOME/packtook-p140"
bash audit/p140-start-demo-emulators.sh
```

CLI must be present beforehand. If missing, `P140_BLOCK=FIREBASE_CLI_MISSING` is intentional (no automatic installation). Firestore emulator Java runtime must be present. Firebase CLI can require fetching official emulator binaries; this contacts Firebase tooling infrastructure, not the production Firestore database. If network or downloads are not permitted, stop rather than changing project or credentials. Don't paste logs containing tokens, filesystem paths, or account details.

Keep the process in foreground. Open a **second Cloud Shell tab/session**, then run:

```bash
cd "$HOME/packtook-p139"
bash audit/p138-local-listener-preflight.sh
```

The P138 HTTP response only establishes local listeners, not that the services are genuine Firebase emulators, and doesn't permit recovered source import or any real handlers. The next gate must verify emulator identity and enforce module initialization review. Production and Staging must remain unchanged.

**P140 is a local test-service launcher, not a deployment. NO_GO_DEPLOY and NO_GO_OWNER_IMPORT stay in force.**
