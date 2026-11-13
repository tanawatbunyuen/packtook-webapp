# PACKTOOK — Owner Staging Screenshot and Real Public Hosting Smoke
2026-11-13. NO_GO_RELEASE / PUBLIC CLOSED / NO DEPLOY / NO MERGE.

## Provided visual evidence
A screenshot from the user shows https://packtook-staging.web.app/ with a branded login form and Firebase Staging selector. This establishes visual browser rendering on their computer, not authenticated Owner permission or genuine App Check protection.

**Incident/security:** The screenshot visibly exposes a typed password. Advise account owner to rotate credentials immediately (and invalidate existing sessions if supported). Do NOT use, extract, commit, or reproduce the exposed password or user identity. Do not attempt login using credentials shown on an image. No live login was attempted.

## Read-only verification
GitHub Actions smoke uses unauthenticated HTTPS GET only for the staging homepage and five JS assets. It checks PACKTOOK and login-page markers. No credentials, no signup, no user data, no App Check consumption, no Omise requests.

## Outstanding gates
Owner login/claims need an independently authenticated private browser session; App Check must be proved with real registered limited-use token; Omise GET needs a test secret and approved test charge injected into isolated staging runner outside PR. This smoke does not provide these.

No public signup enablement, Firebase project changes, production writes or release approvals.
