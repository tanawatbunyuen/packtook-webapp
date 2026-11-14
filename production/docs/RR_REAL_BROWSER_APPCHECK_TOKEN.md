# Live Firebase App Check browser token test — authorized isolated staging
2026-11-14. User authorized isolated staging App Check testing. This Draft PR runs real headless Chromium against only https://packtook-staging.web.app, loads the web SDK App Check already initialized by staging site, and requests a fresh App Check token in page memory. The token and provider error messages are **never printed or persisted**.

Success means the browser SDK returned a token, **not** that backend independently verified it or that limited-use consumption / replay protection works. If the headless CI browser cannot complete reCAPTCHA Enterprise attestation, test fails with a sanitized BLOCKED reason. This is not proof of production failure; test must be repeated in a supported authorized browser.

No account login, secrets, payment, charges, refunds, public signup or production access. Validating Owner login/role and Omise read-only TEST GET still needs authorized session and secure isolated nonproduction secret availability.
NO_GO_RELEASE / PUBLIC CLOSED / NO DEPLOY / NO MERGE.
