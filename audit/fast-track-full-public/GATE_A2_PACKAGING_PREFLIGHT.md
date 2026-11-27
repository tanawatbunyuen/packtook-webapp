# Gate A2 — Offline Hosting-only package preflight

The owner-reported Gate Ledger check on 2026-11-27 returned `PACKTOOK_LEDGER_VALIDATION=PASS`, Gate A BLOCKED (2 OPEN, 1 PARTIAL, 1 MOCK PASS), B and C unexecuted, and fail-closed exit 3. The exact review artifact SHA-256 remains `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2`.

## What this test provides
`gate-a2-hosting-packaging-preflight.py` independently reads the pinned Candidate ZIP and Manifest; verifies all 12 file digest/length records; validates five HTML script references; checks that the source Hosting path is `firebase-staging`; inspects the configured ignore patterns; and ensures the repository's Firestore/Functions sections are **not included** in the Hosting ZIP. Checks the manifest commit is an ancestor of checked-out HEAD.

Run in Cloud Shell after `git pull`:
```bash
python3 -B audit/fast-track-full-public/gate-a2-hosting-packaging-preflight.py
echo "PACKTOOK_GATE_A2_PREFLIGHT_EXIT=$?"
```
The script is standard-library-only and uses NO Google/Firebase network requests, no CLI deployment, no Firebase authentication or production writes. It does not change the review ZIP or repository.

## Material limitation
This is **not** an official Firebase CLI deploy-package parity test. Firebase CLI may transform Hosting configuration and upload plans differently. Do not treat an Exit 0 as Gate A PASS. The exact staging site target and latest approved CLI behavior must be confirmed before separately authorized test-channel deployment.

**Safety decision:** Although modern Firebase CLI recognizes `firebase deploy --dry-run`, even a dry-run has had a cloud-creation bug historically (Firebase CLI 15.37.0 release notes corrected a Firestore database creation issue). Avoid `firebase deploy --dry-run` in this no-cloud-write scope. Instead use this strictly offline inspection, and reserve authentic Hosting operation/packaging comparison for a separately approved staging-only window.

## Remaining blockers
A1 Bridge's hosted differences require behavior/security signoff; A2 official packaging parity and artifact approval open; A3 local mock Chrome smoke PASS but not real Firebase; A4 rollback runbook prepared, rehearsal still unapproved. B and C remain unexecuted; Full Public NO_GO.
