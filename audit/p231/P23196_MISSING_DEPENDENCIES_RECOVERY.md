# P231.96 — Isolated deploy source analysis failure and local dependency recovery

2026-11-26. Operator's read-only recovery audit:
- P231_FUNCTION_INVENTORY=PASS; P231_FUNCTION_INVENTORY_MATCH=NOT_FOUND
- P231_FUNCTION_DESCRIBE=NOT_FOUND_OR_NOT_READABLE
- P231_CLOUD_RUN_SERVICE=NOT_FOUND_OR_NOT_READABLE
- P231_PREVIEW_DIRECTORY=FOUND
- P231_PREVIEW_FUNCTIONS_MODULE=MISSING
- P231_PREVIEW_LOCKFILE=FOUND
- P231_RECOVERY_EXIT_CODE=0

Likely missing `firebase-functions` in the temporary deploy working directory; package.json explicitly declares it, but the preview builder previously copied only three source files. This is not a definitive Firebase CLI root-cause proof. A Cloud Run `NOT_FOUND_OR_NOT_READABLE` result cannot conclusively prove resource absence.

Fix committed to P231.94 guarded deploy script: requires exactly the same three source files **plus** local `node_modules`, validates `firebase-functions/v2/https` resolves within that directory, and requires a readable Cloud Run service inventory that does not contain the target. The script continues to block bulk deploys, production changes and unexpected function collisions.

New `p23196-install-preview-deps-local.sh` validates source/lock and runs `npm ci --engine-strict --ignore-scripts --no-audit --no-fund` **only** inside the temp preview directory. It checks `onCall` import and Node syntax. It does not run `firebase deploy`, modify project IAM, or invoke a cloud service. `npm ci` may access npm registry to fetch dependencies.

**Next operator action:** run the local dependency recovery script and report exit/status. No re-deployment at this step. After local PASS, rerun P231.94 guarded script in `inspect` mode and stop for review before `deploy`. Date lock 2026-11-26 and all staged-only restrictions remain.

P231_STAGING_DEPLOY=FAILED_NO_RETRY_YET
P231_CLOUD_RESOURCE_ABSENCE=NOT_FULLY_CONFIRMED
P231_SOURCE_DEPENDENCIES=AWAITING_LOCAL_TEST
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
