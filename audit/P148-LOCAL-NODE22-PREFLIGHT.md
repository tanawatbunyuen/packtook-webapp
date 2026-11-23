# P148 — Check installed Node 22, without running Firebase

P147 actual Cloud Shell: Node.js major 26; the private startup log has CHECK/AVAILABLE error tags. This does NOT prove Node26 caused timeout. Official Firebase Functions docs support Node 20 and 22; Firebase CLI's own documentation permits Node 18+ with feature-specific requirements.

P148 only checks already-installed ~/.nvm/versions/node candidates and outputs counts. No installation, Firebase CLI execution, emulator launch, source import, cloud writes, or deployment.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p148-local-node22-preflight
git worktree add --detach "$HOME/packtook-p148" origin/review/p148-local-node22-preflight
cd "$HOME/packtook-p148"
bash audit/p148-node22-preflight.sh
```

If Node22 is available, a future guarded demo-only launcher can explicitly use it, without changing the default shell Node. If unavailable, avoid another blind Firebase restart. NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
