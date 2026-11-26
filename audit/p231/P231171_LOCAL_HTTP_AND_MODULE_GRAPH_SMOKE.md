# P231.171 — Local HTTP delivery and module graph smoke (no browser execution)

## User-confirmed P231.170
Two independent transient builds of a 12-file candidate had identical inventories and byte contents, all six JavaScript syntax checks passed; local guarded Bridge and hosted Index script version references were preserved, and no deploys or cloud writes occurred. `P231170_BUILD_EXIT_CODE=0`, `P231_CANDIDATE_BUILD_REGRESSION=PASS_TRANSIENT_ONLY`. The candidates were discarded.

## P231.171 difference from earlier static gates
Added `audit/p231/isolated-test/p231171-candidate-local-http-module-smoke.py`.
- Rebuilds a disposable Hosting candidate using the validated checked-in directory plus hosted Index script versions and the **public** staging Enterprise site key injected into the *temporary* config only.
- Creates a local HTTP server bound exclusively to `127.0.0.1` on a transient OS-assigned port.
- Makes local HTTP GETs of **every** non-ignored Hosting candidate file and compares returned bytes exactly against the temporary disk file, establishing that the candidate can be served as static assets over HTTP.
- Parses the Bridge's static ES-module import URLs and requires a strict list: the 4 Firebase SDK modules at gstatic Firebase JS 11.10.0 and `./firebase-v4-config.js`. The test never downloads or executes external modules.
- Requires the status fail-closed source guard; never invokes Firebase Auth, App Check, Functions, credit, billing, recordings or signup.
- Stops local server, discards temporary candidate, prints counts and flags only. No keys, source content, tokens, personal data, external calls beyond GET of three publicly served staging assets or writes to the cloud.

## Evidence interpretation
An exit 0 + `LOCAL_HTTP_MODULE_GRAPH_GATE=PASS_NO_BROWSER_EXECUTION` establishes local file delivery and allowed static import paths, **not browser runtime compatibility**. The local origin cannot validly reproduce reCAPTCHA Enterprise staging domain registration or Firebase SDK-issued tokens. Do not use this test to claim genuine App Check token acceptance, SDK runtime success, or permission to deploy.

Next step after local HTTP smoke is an expressly scoped browser runtime test on a registered staging domain or approved test site, with a persisted and independently reviewed full Hosting artifact, rollback readiness and release gates. The existing public Hosted normal client already showed App Check/Auth headers and HTTP 200 on `usageStatus`; that proves its own version only, not candidate runtime.

No IAM, Firestore, Hosting deploy, cleanup, credit, billing, production or public signup writes. Production NO_GO; staging Hosting BLOCKED.

P231171_LOCAL_HTTP_MODULE_GRAPH=PREPARED_AWAITING_OPERATOR_RESULT
P231171_BROWSER_RUNTIME=NOT_VERIFIED
P231171_RELEASE=NO_GO
