# Gate A — One-pass persistent staging review candidate builder

## Intent and authorization
The owner approved the Fast Track **plan and offline gates only**. This builder creates a persistent **review-only** candidate ZIP and complete 12-file manifest under `/tmp` on the operator's Cloud Shell. It makes three **public static GET** requests to existing staging Hosting and does not call Firebase Auth, App Check, Cloud Functions, Firestore, IAM, payment, or deploy. **A locally built ZIP is never permission to deploy.** The public Enterprise site key is not printed or committed.

## Why this is different from P231.174
P231.174 persisted a non-deployable baseline with a blank site key and unreconciled index. This Gate A candidate is a mechanically reconciled staging-specific version:
- Pin the exact local source Git commit and entire 12-file directory; require P231.167 full-source nonconfig fingerprint.
- Revalidate that hosted and repo Index differ only in normalized JS script `?v=` strings before adopting hosted Index.
- Keep the protected local Bridge, including `usageStatus` and `recordingStatus` fail-closed wrappers; never silently copy hosted Bridge.
- Extract the already public site key from the currently served staging Bridge and inject it only in the **local candidate artifact**, not Git.
- Build two byte-identical deterministic ZIP copies in memory, ZIP roundtrip-validate, write one ZIP and complete per-file digest manifest with permissions 0600.

The output ZIP is classified `REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY`. It may contain public Firebase client configuration including public site keys, **not** admin or service-account secrets. Keep it within the controlled Cloud Shell /tmp review workspace; don't share it through public URLs.

## Run after Git pull
```bash
cd ~/packtook-p23173 || exit 1
git pull --ff-only origin review/p231-appcheck-runtime-readiness
python3 -m py_compile audit/fast-track-full-public/gate-a-build-review-candidate.py || exit 1
python3 -B audit/fast-track-full-public/gate-a-build-review-candidate.py
echo "PACKTOOK_GATE_A_BUILD_EXIT=$?"
```

## Interpretation
An exit 0 validates **candidate build and integrity** only, A2 still requires reviewer sign-off, official CLI packaging parity and appropriate browser smoke. A1 still requires code review of the semantic change between hosted and local Bridge and Config. A3 needs a browser runner, currently unavailable in Cloud Shell. A4 requires tested rollback readiness.

The previously verified live Version pin `sites/packtook-staging/versions/840e12c0c88d8c1c` is an evidence reference only; a finalized version is not proof of rollback capability.

**Status:** Gate A BLOCKED pending checks A1–A4. Gate B/C NOT EXECUTED. No staging or production deploy, no signup changes.
