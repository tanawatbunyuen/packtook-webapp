# P125 — Owner Functions Git history / branch archaeology

Cloud Staging P120/P122 confirms 4 Owner Functions deployed as ACTIVE yet absent from the 23 exports in the reviewed branch. P123/P124 confirm revision and metadata stability but do not prove Git parity.

This audit scans **remote branches and Git history** for the exact 4 Owner Function identifiers. Only reports symbol names, ref identifiers, and abbreviated historical commit IDs, **never file contents**, and makes **no Cloud calls or deployments**.

GitHub Actions fetches all Git history and remote branches (read-only) before running. `P125_REF_HIT` or `P125_HISTORY_COMMIT` indicates candidate source to review; absence does *not* prove the function source never existed (it may have been in an untracked build, a deleted ref, a different repository, or an artifact).

The P121 Owner-functions deployment block must remain enforced regardless of scan result; do not blindly reconstruct missing backend functions from behavior guesses. Source reconciliation and ownership are still required before any deployment.

To run locally in your isolated Cloud Shell worktree, after fetching P125 branch and all remote refs:

```bash
git fetch origin '+refs/heads/*:refs/remotes/origin/*'
bash audit/p125-owner-source-archaeology.sh
```

Read-only Git history retrieval; no Firebase APIs or secret reads.
