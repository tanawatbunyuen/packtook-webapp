# P131 — Static Owner Function authorization triage

P130 live Cloud Shell audit verified six recovered files, three JS/TS files, zero SHA manifest mismatches, and four Owner symbol names present. Its heuristics found zero matches for five high-level classes; no manual security review has been performed.

P131 scans the **recovered source locally** for explicit `exports.ownerFunctionName =` definitions and reports only boolean indicators (not code or secret values) within a bounded text window. Scope: four Owner callables that manage customer information, video credits and subscription expiry.

**Important limits:** keyword presence never proves correct authorization; absence may mean helper checks outside the selected window, different export syntax or indirection. This is not AST or dataflow analysis and must never be used to approve deployment. Owner/Admin authorization, tenant isolation, idempotency, concurrency, validation, payment/credit invariants, App Check, audit trail and dependency review remain mandatory.

## Operator commands (Cloud Shell HOME)

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p131-owner-authz-static-triage
git worktree add --detach "$HOME/packtook-p131" origin/review/p131-owner-authz-static-triage
cd "$HOME/packtook-p131"
python3 audit/p131-owner-authz-static-triage.py
```

No source upload to GitHub or chat, no Cloud API calls, no deployment. Output consists solely of `P131_` labels. If no explicit export definitions are found, stop: a different source structure may require an offline manual reviewer, rather than guessing.

**Release status remains NO_GO_DEPLOY.**
