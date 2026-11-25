# P218 G02 — Correct security source without unsafe Staging overwrite

## Verified findings from operator Staging read-only checks
- Cloud Build **SUCCESS**, 3/3 successful steps, but `results.images`, `images`, `artifacts.images` were missing/None.
- Cloud Run revision `usagestatus-00021-nob` was Ready/Healthy in reported metadata. Three revision image fields matched digest `sha256:524bd687470632f6ad654bfe14d1d58bdfcd1f6bd897d672fcdcff4977de20fa`.
- Original GCS source generation `1794070024475037` linked Function metadata with Build source label. Source ZIP entrypoint SHA256 **`25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3`**, different from secure P188 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b`.
- The operator's Artifact Registry `images describe` returned **Image not found**. This alone does not prove deletion, reason, or runtime failure.
- The hosted Staging backend has **not** been verified running P188. **G02 remains NO_GO**.

## Repair performed
P218 creates a **separate offline review package** containing exact SHA-pinned P188 `index.js` and `functions/package.json`. This package is deliberately outside the deployed `functions/` source. It never edits default root functions, Firestore rules or Firebase configuration. CI re-tests G02 adversarial Owner/tenant controls on the exact P188 bytes. No credentials or endpoint code is included.

Commands for permitted demo-only build:
```sh
GCLOUD_PROJECT=demo-packtook-p184 GOOGLE_CLOUD_PROJECT=demo-packtook-p184 node audit/p188/build-rc.js
node audit/p189/verify.js
node audit/p218/fixtures.js
```
P218 cannot restore the historical digest that is no longer returned by Artifact Registry. It must not attempt to redeploy the original `usageStatus` or claim the old source equals P188.

## Remaining mandatory steps before any *separate staging isolated* deploy
1. Review the exact six security edits and the owner/legacy accounts inventory; independent security signoff remains missing.
2. Prepare a distinct Staging callable name and confirm that **only** an isolated, temporary test endpoint would be created; no replacement of `usageStatus`, no duplicate triggers and no public unauthenticated invocations. A candidate must not grant new Owner identities automatically.
3. Obtain **specific approval for creating an isolated Staging resource** and establish a Cloud Shell/GCP execution environment; previous Read-only authorization does not by itself authorize a deploy.
4. After such a controlled Staging test, independently verify the actual uploaded source bytes, Build, Image and Revision, exercise authenticated negative cases with safe synthetic users only, and remove temporary test resources after separately approved cleanup.
5. G02 requires independent signoff; G03–G08 remain NO_GO regardless of local pass.

**Never automatically merge, deploy, import Owner, change IAM/App Check/Secrets/Payments or open public signup.**
