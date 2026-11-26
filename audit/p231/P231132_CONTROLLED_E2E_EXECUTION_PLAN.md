# P231.132 — Controlled staging-only E2E runner, awaiting operator execution

P231.130 infrastructure gate passed; P231.127 browser received a real App Check token; P231.129 email-verified auth user was confirmed as a test account by owner. P231.131 prepared the protocol matrix. No callable runtime E2E result exists yet.

The P231.132 browser helper copies a **sensitive** JSON bundle to the local clipboard containing **real**, time-limited staging Firebase Auth ID token and reCAPTCHA Enterprise App Check token. It never prints the values, and it never calls Cloud Run. Clipboard access is inherently sensitive: use only on a private trusted workstation, do not send the clipboard contents in chat, email, logs, GitHub or screenshots; clear clipboard after transfer. Browser helper requires exact staging origin, verified logged-in test user, no App Check debug token, and the approved 2026-11-26 Bangkok date.

P231.132 Cloud Shell Python runner requires the same approved date and exact project/isolated service, checks runtime SA, IAM, revision, then mints a Google ID token with service URL audience using **existing** operator credentials (no grant). It accepts JSON bundle via masked TTY input, never writes token files or prints values; uses Python urllib (no bearer tokens in curl process argv).

Test order: VALID control with real App Check + Auth + IAM, stop unless HTTP 200 + exact expected JSON. If VALID passes, send MISSING App Check and malformed App Check, both with identical IAM/Auth and same target revision. Reports HTTP statuses but not response bodies. **HTTP denials must be corroborated by redacted Cloud Run / Firebase verification logs before declaring App Check enforcement PASS.**

Known limitations: `gcloud auth print-identity-token --audiences` may fail for user credentials or local credential configuration; do not grant permission or impersonate a service account without distinct authorization. Clipboard and local memory carry credentials for short time; do not copy to untrusted devices. HTTP 200 with proper body may prove callable handler path; 401/403 alone does not prove App Check-specific failure.

Only new isolated `p231AppCheckIsolatedProbe` is invoked. Existing usageStatus, recordingStatus, credits, Omise, signup, Production and cleanup are excluded. Current approved date is 2026-11-26 Bangkok; do not extend timebox. No IAM writes, deploy, secret update or cleanup.

P231132_E2E=AWAITING_EXECUTION
P231_RELEASE=NO_GO
