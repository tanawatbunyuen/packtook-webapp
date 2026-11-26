# P231.95 — Failed isolated staging deploy: stop/recover

Operator-reported P231.94 Firebase CLI output: codebase p231-isolated, package-warning "Couldn't find firebase-functions package in your source code. Have you run 'npm install'?", source analysis then "An unexpected error has occurred", P231_DEPLOY_EXIT_CODE=2. No successful deployment receipt.

Likely root cause: the preview artifact directory only contains index.js, package.json and package-lock.json, and does **not** contain node_modules. Firebase CLI source analysis may need the runtime firebase-functions package installed in that preview directory. This is a diagnosis, not a verified root cause; other source-analysis errors may exist.

Do NOT retry any deployment yet. First run read-only inventories (new function list+describe, new Cloud Run service describe) to detect partial creation. Do not touch existing staging services, project IAM, production, Hosting or signup. If resources are found, inspect their status, runtime identity and private IAM before making any recovery decision. Do not delete resources without separate cleanup approval.

Next local-only remedial test *after* inventory: run npm ci --engine-strict --ignore-scripts --no-audit --no-fund in the isolated preview source directory under Node 22. This creates node_modules only in the preview directory and performs no Firebase deployment. Update guarded deploy script's exact root-file whitelist to allow only the named node_modules directory as an optional install artifact, while continuing to block unknown files. Do not assume this single fix guarantees deployment.

P231_DEPLOY_COMMAND=FAILED_OR_PARTIAL
P231_ROOT_CAUSE=PROBABLE_MISSING_PREVIEW_NODE_MODULES_NOT_PROVEN
P231_RECOVERY_GATE=READ_ONLY_INVENTORY_FIRST
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
