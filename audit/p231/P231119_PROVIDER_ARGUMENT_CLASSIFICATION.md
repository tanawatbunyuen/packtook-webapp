# P231.119 — Identify hosted provider constructor argument

Operator P231.118: Hosted bridge has both `initializeAppCheck` and `ReCaptchaEnterpriseProvider`, but neither hosted config nor bridge contains the expected `recaptchaEnterpriseSiteKey` symbol; class `SITE_KEY_SOURCE_NOT_CLASSIFIED`. App Check E2E was not performed.

P231.119 GETs the public staging bridge, refuses cross-site redirects, and prints only the syntax class of the first argument passed into the provider constructor: NONEMPTY_STRING_LITERAL / EMPTY_STRING_LITERAL / IDENTIFIER_ARGUMENT / PROPERTY_ACCESS_ARGUMENT / COMPLEX_OR_UNRECOGNIZED_EXPRESSION. Never prints or saves the argument, script source, keys, app IDs or tokens.

A NONEMPTY_STRING_LITERAL only identifies a lexical pattern. It does not prove the literal matches Firebase registration, that reCAPTCHA Enterprise domain authorization succeeds, or that any App Check token exists.

No IAM, Hosting, provider, Function, public signup or production changes; no cleanup. Testing beyond the original 2026-11-26 Bangkok timebox requires renewed active-test approval. Read-only inspection is not E2E.

P231_PROVIDER_ARGUMENT_CLASS=AWAITING_RESULT
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO