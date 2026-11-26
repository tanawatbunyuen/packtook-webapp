# P231.163 — Verify live-channel current release and version status (read-only)

## Operator-confirmed P231.162 metadata
- Channel-scoped list GET: HTTP 200, 5 release entries.
- Listed first release: `sites/packtook-staging/channels/live/releases/1794125129869000`
- Associated version: `sites/packtook-staging/versions/840e12c0c88d8c1c`
- Release time: `2026-11-08T08:05:29.869Z`.
- Identifier formats valid. No cloud writes; selected release metadata not persisted.

**Caution:** A first list item is not independently equivalent to the live channel's *current* release. The official Hosting Channel resource has a `release` output-only field for the current channel release, and a Version resource has a `status` field. Thus P231.163 verifies with the authoritative channel field, not an assumed list ordering.

## Audit script
`audit/p231/isolated-test/p231163-verify-current-live-version-readonly.py` gets an OAuth access token from Cloud Shell's existing gcloud login in-process without displaying it, then issues only:
1. `GET https://firebasehosting.googleapis.com/v1beta1/sites/packtook-staging/channels/live`
2. `GET https://firebasehosting.googleapis.com/v1beta1/{channel.release.version.name}`

It validates the exact staging channel identity, the channel's current release name and version resource name formats, and whether the version status is `FINALIZED`. It compares both current identifiers with the P231.162 observed IDs, emitting **only flags**, the known status enum and counts-presence flags, not credentials or raw JSON. If the live channel has changed, it reports drift and returns exit 3 rather than falsely pinning the old version as current.

Sources:
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.versions
- https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels/get

## Limits
Even if P231.163 passes, a `FINALIZED` Version is only metadata evidence; it is not a verified rollback operation, complete Hosting artifact backup, or staging deployment authorization. There are no IAM changes, deployments, cleanup, App Check token requests, Auth calls, business-function calls or production writes. Keep staging Hosting deploy blocked and production/public signup NO_GO.

P231163_CURRENT_LIVE_VERSION=AWAITING_OPERATOR_RESULT
P231163_ROLLBACK_VERIFIED=NO
P231163_RELEASE=NO_GO
