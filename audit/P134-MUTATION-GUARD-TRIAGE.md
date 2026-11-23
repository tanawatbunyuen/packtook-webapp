# P134 — Owner mutation / guard AST triage

P133 Cloud Shell real source audit: 3/3 JavaScript files parsed, four Owner exports, indirect deny indicators 1 per export, zero indirect auth indicators detected. **No Owner authorization proven**.

P134 uses Acorn to detect direct and reachable local-helper mutation calls and generic auth, deny, owner-role and App Check AST indicators. It validates manifest and local file hashes before parsing, reports only counts (not source contents), and never executes recovered code. It **cannot establish guard-before-write dominance or safety**. Helper linkage is name-based and may be ambiguous across lexical scopes/files, and paths involving dynamic calls, wrapper closures, aliases and Firestore semantics are not fully modeled. A nonzero auth count is not proof of correct roles or tenant isolation.

## Run in Cloud Shell (already recovered source local)

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p134-owner-mutation-guard-audit
git worktree add --detach "$HOME/packtook-p134" origin/review/p134-owner-mutation-guard-audit
cd "$HOME/packtook-p134"
NODE_PATH="$HOME/.packtook-audit-tools/node_modules" node audit/p134-owner-mutation-guard.cjs
```

This reuses the existing Acorn parser from P133. Only share `P134_` lines. No source, object URLs, credentials, or customer data should be pasted into chat or GitHub. The next *substantive* gate must be a manual offline security review of the four Owner handlers and their validation/authorization helpers, followed by isolated emulator-based tests before any code merge or deploy.

**NO_GO_DEPLOY** remains, and existing Owner Functions must not be overwritten.
