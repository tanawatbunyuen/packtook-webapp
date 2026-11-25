# P219 — G02 candidate remediation verification

Operator-reported Staging source SHA256: 25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3; P188 candidate: c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b. The old ZIP was reported containing legacy automatic Owner backfill and implicit self-Admin role paths. String matches are not exploit proof.

P188/P218 already construct a separate corrected candidate. P219 verifies precise candidate pin, all six security guard invariants and negative patterns before re-running real Firebase Auth + Firestore emulator Owner and cross-tenant attacks and Callable HTTP tests.

This is a local repair verification only. Staging current revision is NOT fixed by this PR. Cloud Staging access was scoped to READ ONLY. A separate authorization and independent security review are required before isolated Staging test deployment. Never replace the live usageStatus function, change IAM/secret/App Check, deploy a new function, backfill legacy Owners or enable public signup without that approval. G02 and all release gates remain NO_GO.
