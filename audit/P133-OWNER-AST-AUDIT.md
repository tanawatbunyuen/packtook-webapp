# P133 — Local JavaScript AST owner auth evidence

P132 (real Cloud Shell, operator-supplied) found **0** auth helper candidates using bounded lexical matching in 4 Owner functions. This does not establish missing authorization. P133 is a better structural triage using an actual JavaScript parser (Acorn) to enumerate the explicit exports and locally called helper names, then report aggregate AST indicators. It does not execute recovered JS or print it.

**What P133 does not prove:** the owner truly owns a target customer, a deny guard dominates writes, authenticated identity cannot be forged, idempotency exists, credit accounting is safe, or App Check is enforced by deployed runtime. Even a positive indicator requires manual review.

## Cloud Shell (separate HOME worktree, no source upload)

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p133-owner-authz-ast-evidence
git worktree add --detach "$HOME/packtook-p133" origin/review/p133-owner-authz-ast-evidence
cd "$HOME/packtook-p133"
mkdir -p "$HOME/.packtook-audit-tools"
npm install --prefix "$HOME/.packtook-audit-tools" --ignore-scripts --no-audit --no-fund --save=false acorn@8.15.0
NODE_PATH="$HOME/.packtook-audit-tools/node_modules" node audit/p133-owner-authz-ast.cjs
```

Acorn is a parser library installed into a private, untracked audit tooling location. No recovered source is submitted to npm or GitHub. CI uses synthetic fixtures and reports no source.

All deployment remains **NO_GO_DEPLOY**, and four Owner Functions present in Staging but absent from review source remain protected.
