# PACKTOOK P86 — Safe Selector and Rollback Validation (Offline)

**State:** offline review, NOT deployment-ready. No live Cloud API calls,
Firebase CLI deployment planning command, or production changes.

## Established information

- P80 owner inspection found Staging guard source drift on existing
  `recordingStatus` and `usageStatus`.
- P83/P84 owner inspection confirmed five Staging Gen2 functions stable
  over read-only snapshots, with pinned source generations and revision
  metadata. Source pin was NOT shared between status/credit groups.
- P85 checked-out `production/firebase.json` has a `beta` codebase
  sourced from `production/functions`. All five existing status and
  credit callable exports are in this same repository source codebase.
- None of this establishes actual deployed Firebase CLI codebase
  ownership, IAM least privilege, live App Check, a safe specific
  deploy selector, or a tested rollback.

## P86 scope risk matrix

1. Replacing the **entire beta source directory** is blocked: this
   could affect credit callables and unrelated functions.
2. Targeting **only the two named existing functions** is a possible
   narrow strategy for **independent review only**, NOT a known-safe
   Firebase CLI selector. Do not run an unreviewed command.
3. Registering a **new codebase/alias** cannot itself fix the deployed
   original-name callable authorization behavior and may break clients.

The P86 analyzer does not output any command to deploy.

## Rollback evidence requirements

`production/staging-candidates/p86-rollback-evidence.json` records
12 checks beginning at `NOT_VERIFIED`: exact function revisions,
generation-specific source for status and credit functions, source
readability, dependency retention, runtime identities, build
reproducibility, isolated Staging restore drill, post-restore function
parity, exclusion of credit functions, rollback triggers, and owner
approval. Source pin **presence is NOT rollback restorability**.

The offline evidence classifier never grants deployment even if someone
fills all fields with VERIFIED: independent protected operational evidence
is required.

## Deployment blockers

- Existing P80 source guard drift remains unremediated
- Backend App Check enforced in live Cloud: NOT_PROVEN
- Effective IAM of shared runtime service identity: NOT_VERIFIED
- Live Staging CLI ownership and deploy selector: NOT_VERIFIED
- Immutable restorable rollback + private incident drill: NOT_VERIFIED
- Monitoring, PDPA and owner-scoped change ticket: outstanding

Next useful step is a **narrow read-only live ownership/provenance
inspection** without printing secret values or Firebase service
identities. A later deployment requires separate explicit approval;
no Cloud Shell run is necessary for P86 offline development.

**P86_STAGING_DEPLOY=BLOCKED / RELEASE=NO_GO_RELEASE.**
