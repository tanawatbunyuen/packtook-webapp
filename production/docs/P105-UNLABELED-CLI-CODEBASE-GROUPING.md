# P105 — Firebase CLI codebase grouping with absent labels

Owner Staging diagnostics: P102 27 stable Gen2 functions, status 2/2,
credit 3/3, prefix collisions 0. P103 all five codebase labels absent.
P104 entry points/runtime/service metadata 5/5, with five distinct
build source references. These observations do **not** prove different
source code or codebase ownership.

P105 executes the compiled `groupEndpointsByCodebase` helper from
published `firebase-tools@15.29.0`, using synthetic Staging endpoint
metadata with absent codebase labels. It checks the two scoped statuses
and three credit functions against a full local 'want' backend versus a
status-only 'want' backend. The helper assigns endpoints by matching
function names before falling back to codebase labels. This makes
absence of labels a possible normal case for matching known names,
but **does not establish** that the real Cloud Deployment Planner will
operate safely or without deletion.

A deployed function with the *same project, region and name* may match
a desired Firebase codebase even when the deployment label conflicts;
the deployed ownership therefore remains unverified. In addition,
Firebase name selectors can match children with a hyphen prefix.
The actual live inventory checks found zero such collisions (P102),
but the full live 'have' backend and the built candidate 'want' backend
have not been checked together.

This is **offline only**. No Cloud Shell request is necessary for P105.
No source/credit modifications, GCP API calls, IAM, deploy, traffic,
rollback or merge. P80 guard drift remains UNREMEDIATED, P99 account
compatibility NOT_EQUIVALENT, and deployment remains BLOCKED.

Next before release: source-to-deployed attestation, status-only
selected endpoints from an actual bounded deploy-plan read, delete
candidates, and an approved immutable recovery path. NO_GO_RELEASE.
