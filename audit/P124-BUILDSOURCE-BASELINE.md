# P124 — Staging build source descriptor baseline

Read-only metadata test for `recordingStatus` and `usageStatus`. The descriptor hashes are grounded in the P120 authenticated Cloud Shell output; the revisions were reconfirmed by P123.

A digest of the JSON `buildConfig.source` descriptor is **not** a hash of deployed code, not a Git commit, and not proof of source parity. A match establishes only that these metadata fields have not drifted relative to the operator-provided P120/P123 baseline.

Run in authorized staging Cloud Shell from an isolated worktree:

```bash
cd /tmp/packtook-p123
git fetch origin review/p124-staging-build-provenance-lock
git worktree add --detach /tmp/packtook-p124 origin/review/p124-staging-build-provenance-lock
cd /tmp/packtook-p124
bash audit/p124-buildsource-readonly.sh
```

The script issues only two `gcloud functions describe --v2` calls; no deployment, code download, customer data, secret values or production API calls. It fails closed if descriptor metadata changed or is unavailable.

**Still blocked:** the reviewed backend has four missing Owner Functions; codebase labels remain UNSET; source Git parity and real Staging App Check E2E not attested. Do not deploy or merge as a bypass.
