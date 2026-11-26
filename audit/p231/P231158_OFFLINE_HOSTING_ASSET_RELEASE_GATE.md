# P231.158 — Five-script asset inventory and offline release manifest

## Operator-provided P231.157 evidence
All five expected public staging JavaScript assets were compared to the checked-in `firebase-staging` versions with static GET only. No asset was unavailable. Four had identical actual contents **and matching Index version queries**:
- `video-history-db.js`
- `video-stream-writer.js`
- `performance-monitor.js`
- `app.js`

The fifth asset, `firebase-packing-bridge.js`, differed in both actual content and index version query. `P231_ASSET_CONTENT_DRIFT_COUNT=1`, `P231_ASSET_UNAVAILABLE_COUNT=0`, `P231157_ASSET_EXIT_CODE=0` (successful audit execution, **not release authorization**).

Previous P231.156 confirmed that exact `index.html` parity is restored after normalizing only the allowed script version-query strings. The `firebase-v4-config.js` local site-key export is still empty and hosted version is not exported. Bridge/Config are not reconciled.

## New P231.158 offline release gate
`audit/p231/isolated-test/p231158-offline-hosting-release-gate.py` performs **no HTTP or cloud calls**. From `firebase.json`, `firebase-staging/index.html` and local bridge/config files it verifies:
- Hosting public directory is explicitly `firebase-staging`.
- Only the five expected versioned JavaScript script references occur; each referenced asset exists.
- Staging project identity, App Check SDK initialization, staging Functions region, Config site-key export, and guarded status callables.
- Reports only boolean shape indicators; never prints site keys or raw code.

Regardless of local source structure, the release gate deliberately exits 3 with `P231_HOSTING_DEPLOY_GATE=BLOCKED`, because the released artifact, runtime smoke checks, complete source parity, rollback and explicit Hosting-only authorization do not yet exist. Exit 3 is the **expected safe refusal** and is not a source syntax failure. A script error/missing source exits 2.

## Next safe source work
1. Review the exact semantic differences in Bridge/App Check and choose the canonical behavior: guarded status calls and environment-specific nonempty **public staging** site-key injection; no Firebase Admin credentials in Web assets.
2. Use an isolated **candidate build tree**, including complete Hosting asset manifest and staging-only key injection, never overwriting `firebase-staging` or current hosted assets. Test missing-key fail closed.
3. Compare all candidate asset files and key runtime paths against known-good public staging behavior with an offline suite.
4. Preserve rollback release/version details and conduct review before any staging-only Hosting deploy. Production and public signup remain NO_GO.

Security evidence: isolated App Check E2E 3/3 HTTP behavior PASS, static source fixtures 9/9 PASS, normal frontend App Check/Auth headers observed on `usageStatus`, HTTP 200 observed. Strict request-to-diagnostic trace correlation remains inconclusive 1/2. These do not certify production release.

P231158_OFFLINE_RELEASE_GATE=CREATED_NOT_YET_EXECUTED
P231158_DEPLOY=NOT_PERFORMED
P231158_RELEASE=NO_GO
