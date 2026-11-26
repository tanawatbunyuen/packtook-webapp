# P231.156 — Exact index comparison after removing only approved script-version query differences

P231.155 operator output:
- One index changed block: one line on each side
- HTML tag counts, DOM IDs, attribute-name counts match
- Script asset basenames match; **script version queries do not match**
- Stylesheet references and versions match
- Parsed text content matches
- No source or cloud writes; `P231155_INDEX_EXIT_CODE=0`

The above **suggests** the remaining index difference may solely be version-query values, but it did not compare all attribute values. P231.156 adds an exact-string comparison after **only** normalizing supported `<script src="...js?v=...">` versions. It never prints URL/version/query values or source HTML. If the normalized HTML strings match and versioned script asset basenames match in order, `P231_INDEX_DRIFT_CLASSIFICATION=ONLY_SUPPORTED_SCRIPT_VERSION_QUERIES`. If not, it returns exit 3 and reports `ADDITIONAL_DIFFERENCES_OR_UNSUPPORTED_SYNTAX`.

This is stronger evidence than matching DOM IDs and parsed text nodes, but does not prove the content of referenced JavaScript or runtime behavior. Bridge and Config source drift remain unresolved; do not deploy the repository version with an empty App Check site-key export. Production stays NO_GO. The script performs one public static GET; no credentials, auth, App Check tokens, Functions calls, IAM mutation, deployment, or cleanup.

P231156_INDEX_VERSION_QUERY_ONLY=AWAITING_OPERATOR_RESULT
P231156_HOSTING_DEPLOY=BLOCKED
P231156_RELEASE=NO_GO
