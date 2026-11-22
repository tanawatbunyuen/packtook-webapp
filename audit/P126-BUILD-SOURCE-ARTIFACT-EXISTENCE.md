# P126 — Does the deployed Staging build source artifact still exist?

P125 found no matches for the four Owner Function symbols in the scanned Git repository history (147 remote branch refs and the scanned functions-JS history). P122 establishes all four Owner Functions are ACTIVE, but their source remains missing from reviewed Git.

This Python operator script uses `gcloud functions describe` on exactly six known `packtook-staging` functions, then `gcloud storage objects describe` **only** on the build `storageSource` object referenced by each function. The script prints no bucket names, object paths, source file contents or sensitive metadata, and never downloads archives. It may require read access to Google Cloud Storage metadata. Permission denial is recorded as `NOT_ACCESSIBLE_OR_NOT_FOUND` rather than incorrectly claiming object deletion.

## Run in authorized Cloud Shell

```bash
cd /tmp/packtook-p124
git fetch origin review/p126-staging-build-source-artifact-existence
git worktree add --detach /tmp/packtook-p126 origin/review/p126-staging-build-source-artifact-existence
cd /tmp/packtook-p126
python3 audit/p126-build-source-artifact-existence.py
```

If build source archives are still accessible, they **may** provide a recoverable original codebase but are not to be treated as reviewed Git source or automatically merged. A separate secure recovery and source/code review plan is needed before any download. If an artifact is inaccessible, distinguish IAM denial from object deletion via authorized access audit.

**NO_GO_DEPLOY remains.** Four deployed Owner Functions missing from current repository are a critical blocker. App Check staging Site Key and real E2E also remain unverified.
