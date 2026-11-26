# P231.155 — Staging Index single-line drift taxonomy

Operator-reported P231.154 differential test passed (exit 0). Source drift remains:
- Bridge: 4 changed blocks (13 local vs 18 hosted changed lines)
- Config: 1 block (4 local vs 0 hosted changed lines)
- Index: 1 block (1 line local vs 1 hosted), non-whitespace difference

Index structural evidence: DOM ID sets equal, HTML tag counts equal, five named script references equal at basename level, stylesheet counts equal. These facts do **not** establish equal values, rendered text, script query versions, or event behavior.

P231.155 adds `audit/p231/isolated-test/p231155-staging-index-drift-taxonomy-readonly.py`. The script compares actual local and hosted public `index.html` by structural indicators without printing HTML or text content. In particular it checks whether:
- script and stylesheet filenames match ignoring query strings, and whether full references (including version queries) match;
- parsed visible text node arrays match;
- tag/ID/attribute-name counts match;
- number of inline scripts match.

This is an evidence collection aid, not a reason to automatically merge or deploy: an existing one-line text or attribute change can be functionally important.

P231.152 in-memory key candidate is PASS_MEMORY_ONLY from operator; no artifact was created. P231.151 pre-deploy Gate remains BLOCKED, because current Firebase Hosting config publishes `firebase-staging` and source parity is not established. A staging-only Hosting deploy still needs explicit reviewed authorization, artifact verification and rollback safeguards. Production remains NO_GO.

No credentials, client tokens, Function/Firestore calls, IAM changes, cloud writes, deployments or cleanup.

P231155_INDEX_TAXONOMY=AWAITING_OPERATOR_RESULT
P231155_SOURCE_PARITY=DRIFT
P231155_HOSTING_DEPLOY=BLOCKED
P231155_PRODUCTION=NO_GO
