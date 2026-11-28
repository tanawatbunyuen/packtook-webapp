# PACKTOOK — Approved read-only Staging Functions inventory (eight missing local source exports)

Approval received 2026-11-28: inspect **Firebase Functions Metadata only**, project `packtook-staging`. No deploy, IAM, Secret, Auth, Firestore, account, credit or public signup change.

Why: 28 Bridge call sites / 27 distinct callable names; 8 browser-invoked functions absent from `functions/index.js` checked-in export declarations. They may be independently deployed: live absence is **not yet proven**.

Script `gate-b-eight-functions-staging-metadata-readonly.py` runs:
- `gcloud functions list --project=packtook-staging --format=json --quiet` (metadata GET)
- For an allowlisted function present in `asia-southeast1` only: `gcloud functions describe FUNCTION --region=asia-southeast1 --project=packtook-staging --format=json --quiet` (metadata GET)

Names: `acceptOperatorInvite`, `approveDuplicateRequest`, `inviteOperator`, `listDuplicateRequests`, `listOperators`, `myDuplicateRequests`, `operatorApprovalStatus`, `requestDuplicate`.

Only name/presence, region, state, environment, trigger category and entrypoint are printed. The script does **not** reveal complete metadata, URLs, identities or environment variables. It does not modify gcloud's active project. It makes no Functions invocation or account access. Exit 0 means metadata inventory was retrieved, not that callables are correctly functioning. Exit 2 means metadata evidence could not be established.

This script deliberately refuses to infer an HTTPS Callable protocol, App Check policy, exact runtime revision or source provenance from Functions metadata. Those require independent source/revision and real protected staging tests under **separate scoped authorization**.

Operator command:
```bash
cd ~/packtook-p23173 || exit 1
git pull --ff-only origin review/p231-appcheck-runtime-readiness || exit 1
python3 -B -m py_compile audit/fast-track-full-public/gate-b-eight-functions-staging-metadata-readonly.py || exit 1
python3 -B audit/fast-track-full-public/gate-b-eight-functions-staging-metadata-readonly.py
RESULT=$?
echo "PACKTOOK_STAGING_METADATA_EXIT=$RESULT"
echo "PACKTOOK_FULL_PUBLIC=NO_GO"
```

No production queries. No real runtime testing or deploy. Gate B remains OPEN.
