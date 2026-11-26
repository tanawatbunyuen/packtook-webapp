# P231.154 — Source reconciliation differential review

## Operator evidence from P231.152 and P231.153
- P231.152: Public site key available; candidate key nonempty; staging identity correct; `protectedApi` bridge preserved; candidate static safety `PASS_MEMORY_ONLY`; local and hosted bridge/config/index all still differ. No disk/cloud writes, deploy or function calls.
- P231.153: Bridge differs by 4 changed blocks, 56 local versus 61 hosted lines; config differs by 1 block, 15 vs 11 lines; Index differs by 1 block with 65 lines in both copies.
- Eight source-shape feature differences in bridge involve `protectedApi`, `appCheckReady`, `api()` status calls and public-site-key placement. Config export/empty-key shape differs.
- Index references all five expected script assets on both sides; DOM IDs common=95, only-local=0 and only-hosted=0; form count identical. These are structural matches, not proof of complete content parity.

## P231.154 static differential classifier
`audit/p231/isolated-test/p231154-staging-diff-classifier-readonly.py` fetches only publicly hosted bridge/config/index, compares their changed line-block lengths and whitespace-only status without showing any changed lines, keys, app IDs, HTML or JS. It also verifies whether Index tag counts, DOM ID sets, script lists and stylesheet counts match exactly.

**Do not conclude** Index differences are harmless from DOM IDs alone; text content, event names, security attributes or asset versions can change with no DOM ID or tag count change.

## Next engineering decision
There are two separate tasks: (1) freeze an immutable, reviewed hosting candidate with nonempty staging-only public site key, explicit fail-closed rules and reproducible build; (2) reconcile exact runtime functionality between the existing hosted release and repository source, including Index and other assets. Do not rewrite the canonical Bridge based only on keyword matches. A safe release process requires a reviewed artifact diff, rollback manifest, and owner deployment authorization. The current project-level `firebase.json` also configures Functions and Firestore: **never run unscoped `firebase deploy`** for this workflow.

The passing P231.152 memory-only candidate does NOT imply that a built candidate has passed smoke tests or is approved to deploy. Source drift remains an intentional blocker. The isolated App Check E2E HTTP 3/3, source fixtures 9/9 and normal client usageStatus header + HTTP 200 observations remain valid; strict trace correlation stays inconclusive 1/2.

## Safety
No active Firebase tokens, business API, IAM writes, Deploy, Cleanup or Production modifications. Production remains NO_GO.
P231154_DIFFERENCE_CLASSIFIER=AWAITING_OPERATOR_RESULT
P231154_HOSTING_DEPLOY_GATE=BLOCKED
P231154_RELEASE=NO_GO
