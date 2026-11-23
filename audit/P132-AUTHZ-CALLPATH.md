# P132 — Owner Authorization Call-path Candidate Audit

P131 operator scan found four exact Owner exports, but did not find local Admin/App Check indicators within its limited export windows. This does **not** show the functions lack protection: helpers or shared wrappers may enforce it.

P132 checks the verified local recovery manifest and, without printing source, identifies direct auth/deny signals and locally called named helper candidates with auth/deny text in a bounded region. **Not an AST, control-flow or taint analysis.** Helper candidate count is not proof that the helper is invoked correctly, fails closed or checks the authenticated owner.

## Cloud Shell operator instructions

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p132-owner-authorization-callpath
git worktree add --detach "$HOME/packtook-p132" origin/review/p132-owner-authorization-callpath
cd "$HOME/packtook-p132"
python3 audit/p132-owner-authorization-callpath.py
```

No source is uploaded to GitHub, no recovered source is executed, and no Cloud calls are made. Console reports counts/flags only; please share only `P132_` lines. Manual audit of authenticated admin identity, tenant boundaries, input validation, credit/expiry mutation invariants, audit logs, App Check, and pre-deploy migration design remains required.

Decision always NO_GO_DEPLOY; retain P121 safeguard for four Owner Functions missing from current reviewed source.
