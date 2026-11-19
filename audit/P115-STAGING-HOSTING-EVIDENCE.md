# P115 — staging hosting read-only source provenance probe

The reviewed app source (P113 App Check candidate) is **not** evidence of the code serving on Firebase Staging. Run the P115 probe to compare SHA-256 of three public hosting assets to this review branch.

## Scope
- Anonymous GET of `https://packtook-staging.web.app/` assets only
- 7-second per-request timeout; 1 MiB response cap
- No authentication, App Check tokens, payment requests, Cloud Functions, mutations, or deployment
- Does not follow redirects; no secrets or response bodies printed
- Fetches `firebase-packing-bridge.js`, `firebase-v4-config.js`, `index.html`

## Interpret results
- `EXACT_SOURCE_MATCH`: the bytes match this GitHub branch. It **does not** prove authenticated Cloud Functions or App Check runtime.
- `HOSTED_SOURCE_DIFFERS`: source provenance drift; expected until frontend reviewed changes are deployed.
- `HTTP_ERROR`/`TRANSPORT_ERROR`: remote unavailable or request disallowed; **not** evidence of secure runtime.
- The decision remains `NO_GO_RUNTIME_NOT_ATTESTED` regardless of asset match.
- Key provisioning, Firebase Project app registration, actual token verification, and scoped deploy audit are separate requirements.

## Commands
```sh
node --check audit/p115-staging-hosting-readonly.cjs
node audit/p115-staging-hosting-readonly.cjs
```

Use only the reviewed staging hostname. No production deploy authorized.
