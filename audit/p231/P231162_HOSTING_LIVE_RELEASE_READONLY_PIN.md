# P231.162 — Read-only Firebase Hosting live release metadata

## Prerequisite operator evidence
P231.161 evidence gate correctly blocked release (exit 3): no owner evidence file, pinned Hosting release absent, no independently validated rollback procedure, no immutable candidate manifest, no candidate runtime smoke and no deploy approval. No cloud requests/writes.

## API verification
Official Firebase Hosting REST API supports **GET** `/v1beta1/sites/{siteId}/channels/{channelId}/releases` to list a particular channel's releases. Using `sites/{site}/releases` without a channel may mix live and preview releases; **P231.162 deliberately queries the `live` channel only**, avoiding an incorrect rollback pin.

Official API docs: https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels.releases/list

## Script
`audit/p231/isolated-test/p231162-hosting-live-release-readonly.py` runs in owner Cloud Shell:
- Calls `gcloud auth print-access-token` **capturing stdout in process memory only**, never logging token; no keyfile or credentials are written.
- Sends one authenticated HTTP **GET** to `firebasehosting.googleapis.com` for `sites/packtook-staging/channels/live/releases?pageSize=5`.
- Accepts a release only if response release name, version name and timestamp match expected staging resource patterns. The selected release is first in the API's list; verify ordering before treating it as the current live version.
- Prints selected public resource identifiers/release time (not passwords) only if all shapes validate. Does not save a pin on disk or claim rollback availability.
- On 403, 404, or missing data, reports only a sanitized status and remains blocked.
- **No POST, PATCH, DELETE, deploy, Cloud Functions, IAM, Firestore, billing, credit mutation, production or public signup actions.**

## Important limitation
A live release resource name is **metadata**; it is not an immutable full Hosting file backup. P231.162 does not validate that the release/version can still be restored, capture a deployable artifact or authorize rollback. If metadata is returned, a separate integrity/roll-back review will be required. P231.161's fail-closed release gate remains in effect.

P231162_LIVE_RELEASE_METADATA=PREPARED_AWAITING_OPERATOR_RESULT
P231162_ROLLBACK_VERIFIED=NO
P231162_DEPLOY=NOT_PERFORMED
P231162_RELEASE=NO_GO
