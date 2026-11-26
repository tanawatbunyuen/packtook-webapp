# P231.149 — Normal staging PACKTOOK client observed sending App Check header

## Operator-reported P231.148 passive browser observer
The owner reported two separate console observations, each with:
- `P231_OBSERVED_CALL=usageStatus`
- `P231_TRANSPORT=FETCH`
- `P231_APPCHECK_HEADER_PRESENT=YES`
- `P231_FIREBASE_AUTH_HEADER_PRESENT=YES`
- `P231_CREDENTIAL_VALUES=NOT_PRINTED`

P231.148 was designed to observe ordinary browser-generated status calls, not invoke the backend itself. The owner had previously confirmed the browser signed-in user was a staging test account. The P231.148 observer was run within the approved 2026-11-26 Bangkok staging test window.

## Disposition
- **Normal client App Check header attachment: PASS — REQUEST HEADER PRESENCE OBSERVED**, for two observed `usageStatus` fetch requests.
- **Normal client Firebase Auth header presence: PASS — REQUEST HEADER PRESENCE OBSERVED**.
- **Normal client HTTP success, backend App Check token verification, and data response: NOT VERIFIED by this passive observer**. Header presence does not establish token validity or backend acceptance.
- This observed path is `usageStatus` only; `recordingStatus` header attachment remains unobserved, although the same hosted Firebase SDK callable path is statically present.
- **GitHub vs hosted staging source/config drift** identified by P231.144/P231.145 remains unresolved. Header success on the hosted app is not approval to deploy repository files with an empty site key.
- Isolated staging function's valid/missing/invalid App Check E2E HTTP behavior remains 3/3 PASS, static fixtures 9/9 PASS; strict logging request correlation remains INCONCLUSIVE 1/2.
- No user credential values were printed by reported observer. No new deployments, IAM changes, cleanup or signup activation are authorized. Production remains NO_GO.

## Next evidence, without repeat calls
Existing browser DevTools Network tab may show the **HTTP status codes** for the two `usageStatus` requests already sent. Report only the status code(s) and whether a response was successful, without copying request headers, response bodies, identities or tokens. Do not invoke credit, billing, recording or signup endpoints merely to obtain evidence. If not retained, mark status NOT_VERIFIED rather than re-running requests outside the active-test authorization window.

P231149_NORMAL_CLIENT_USAGE_APPCHECK_HEADER=PASS_OBSERVED
P231149_NORMAL_CLIENT_USAGE_FIREBASE_AUTH_HEADER=PASS_OBSERVED
P231149_OBSERVED_USAGE_REQUESTS=2
P231149_CLIENT_USAGE_HTTP_RESPONSE=NOT_VERIFIED
P231149_RECORDING_STATUS_HEADER=NOT_OBSERVED
P231149_SOURCE_PARITY=DRIFT_CONFIRMED
P231149_STRICT_ISOLATED_LOG_ROOT_CAUSE=INCONCLUSIVE
P231149_PRODUCTION_RELEASE=NO_GO
