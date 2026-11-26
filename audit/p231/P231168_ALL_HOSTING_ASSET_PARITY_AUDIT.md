# P231.168 — Complete staging public-file parity inventory (read-only)

## Operator-confirmed P231.167
- Staging Hosting directory: `firebase-staging`.
- Locally estimated deployable inventory: **12 files**, **215,712 bytes**, with zero ignored entries, symlinks, risky filename indicators or unsupported entries.
- Seven previously inspected required files present.
- Nonconfig whole-local-directory source fingerprint: `1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098`.
- `P231_SOURCE_INVENTORY_GATE=PASS_INVENTORY_ONLY`, exit code 0.
- Site-key Config remains empty in checked-in source. Firebase CLI packaging equivalence was NOT VERIFIED. No Hosting artifact exists.

## P231.168
Added `audit/p231/isolated-test/p231168-all-hosting-public-assets-parity-readonly.py`.
This script walks every **non-ignored regular file** under `firebase-staging` using the repo's existing Hosting ignore rules, and compares its bytes against an HTTPS GET of the *corresponding public static URL* at `https://packtook-staging.web.app`. It:
- Checks Hosting directory and exact ignore-rule set.
- Rejects symlink paths and unexpected file types.
- Caps file sizes and enforces an inventory count ceiling.
- Rejects apparent HTML Hosting fallback for non-HTML filenames.
- Reports only content MATCH/DRIFT/UNAVAILABLE counts, and named status for the seven previously reviewed allowlisted assets; does not print non-allowlisted filenames, JS source, config values, keys or credentials.
- Does not enumerate extra public files that might exist on Hosted but be absent locally; it is therefore not a complete bidirectional deploy snapshot.
- Makes only public static GET requests; does not invoke Functions, Auth or App Check, and does not write to local or Cloud storage.

**Expected based on earlier seven-file audit**: at least the three known Bridge/Config/Index assets are still DRIFT, but no outcome for the other five files should be assumed before testing. Exit 0 denotes successful audit even if DRIFT exists; UNAVAILABLE returns exit 2. Neither outcome permits deployment.

## Next source decisions
The remaining important tasks are to (1) reconcile the exact Hosting config/Bridge implementation on a reviewed source branch, (2) prepare a reproducible and complete candidate artifact with reviewed staging-only public key injection, (3) validate its complete manifest, callable smoke and rollback mechanism, and (4) seek narrowly scoped deployment authorization. Do not treat a nonempty public key and static feature flags as sufficient runtime validation.

P231168_ALL_STATIC_ASSET_PARITY=AWAITING_OPERATOR_RESULT
P231168_STAGING_HOSTING_DEPLOY=BLOCKED
P231168_PRODUCTION_RELEASE=NO_GO
