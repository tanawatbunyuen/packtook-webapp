# P231.160 — Candidate integrity and release-manifest readiness

## Operator-confirmed P231.159
`P231_OFFLINE_TESTS=10/10_PASS`, `P231159_CANDIDATE_EXIT_CODE=0`. The local temporary staging candidate had all five JS assets, a nonempty public staging Enterprise site-key export, staging project and region, App Check initialization/auto-refresh, protected status guards and unchanged other assets. The candidate was discarded after the test. There was **no deploy**, **no persistent candidate**, **no runtime smoke**, and hosted source parity remained unresolved.

## P231.160 implementation
`audit/p231/isolated-test/p231160-hosting-release-manifest-readonly.py` checks the seven **explicitly allowlisted** Hosting files (index, public config, bridge and four other scripts), reading local repository files and publicly served staging versions. Both Index files must reference exactly the five versioned scripts that were previously audited. It prints only content equality, inventory counts, the repo's empty public key gate and readiness flags.

It deliberately prints no file contents, byte hashes, source-derived digests, key values, credentials or response bodies. It makes **only public Hosting static GETs**; no Auth, App Check issuance, Cloud Functions, IAM, database writes, production changes or deploy.

## Why no rollback claim
This audit does not capture or persist a Firebase Hosting release version, storage snapshot or deployable rollback artifact. It can verify the current public static bytes, but **cannot certify rollback feasibility or artifact reproducibility** from those observations alone. A rollback process needs (i) an authorized, immutable Hosting release identifier from Firebase Hosting, (ii) a complete tested artifact or verified ability to roll back to the pinned release, (iii) clear owner/operator authorization, and (iv) a staged, Hosting-only publish and rollback procedure.

## Security and deployment gates
- Source/hosted drift: bridge, config and index remain different; Index was shown to differ only in supported version query text, which does not establish runtime file parity for the bridge.
- Repo site key: intentionally empty; a blind deploy would break guarded status calls.
- Candidate runtime: not executed; normal already-hosted client `usageStatus` App Check/Auth header and HTTP 200 observations are valid, but not candidate runtime proof.
- Isolated E2E: 3/3 HTTP behavior observed; static fixtures 9/9 PASS; strict 401 diagnostic trace correlation 1/2 INCONCLUSIVE.
- Production and public signup: NO_GO/CLOSED.

P231160_MANIFEST=PREPARED_AWAITING_OPERATOR_RESULT
P231160_DEPLOY=NOT_PERFORMED
P231160_RELEASE=NO_GO
