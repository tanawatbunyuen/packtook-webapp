# P231.121 — Verified site key matches; inspect Enterprise domain allowlist

P231.120 Cloud Shell operator report (2026-11-26): hosted Enterprise site-key literal exactly MATCHES registered App Check Enterprise key; exit 0; no cloud writes, deployments or cleanup. This confirms equality only, not allowed domains, browser attestation, valid App Check token or callable App Check enforcement.

Google Cloud reCAPTCHA Enterprise key REST GET supports `webSettings.allowedDomains` and `webSettings.allowAllDomains`: https://docs.cloud.google.com/recaptcha/docs/reference/rest/v1/projects.keys . Firebase security guidance warns against disabling domain verification: https://firebase.google.com/docs/app-check/recaptcha-keys .

P231.121 is read-only. It gets the Enterprise site key registered with the single staging Firebase Web App via the Firebase App Check API, then GETs the matching reCAPTCHA Enterprise key resource in the staging project. Both API calls include `X-Goog-User-Project: packtook-staging`; the script reports only whether the fixed staging host is covered by an allowed domain (including explicit parent-domain suffix), whether all domains are allowed, and the count of configured domains. No domains list, key, raw response, OAuth access token or app ID is printed or saved.

Gate meanings: `PASS` = host listed and `allowAllDomains` false; `ALLOW_ALL_SECURITY_REVIEW` = domain verification disabled, requiring security review even if the host is listed; `BLOCKED` = fixed staging host not covered and all-domains disabled. A 403 means insufficient access or policy; never auto-grant IAM. Missing key and mismatch remain blockers. This is not evidence of browser attestation.

No change to provider config, staging Hosting/Functions, IAM, public signup, production or cleanup. Active E2E past the original 2026-11-26 Bangkok window requires new approval.

P231_HOSTED_REGISTERED_SITE_KEY=MATCH_OPERATOR_REPORTED
P231_DOMAIN_ALLOWLIST=AWAITING_RESULT
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO