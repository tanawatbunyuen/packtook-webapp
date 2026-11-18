# PACKTOOK P79 — Staging Revision Stability Read-Only Preflight

P78 owner-supplied read-only result verified that the five scoped Gen 2
Staging Cloud Functions were ACTIVE, had service identities and build
source metadata. It did not verify source contents, guard wrappers or
backend App Check. P79 collects **two consecutive metadata snapshots**
of the five Functions, comparing state, generation, updateTime, source
locator, revision, service identity and runtime configuration **in RAM**.
It prints only safe presence/stability booleans and statuses.

The P79 script defaults to NO CLOUD ACCESS. It requires `--inspect`, and
will refuse an active project other than `packtook-staging`. It makes
only explicitly scoped read-only `gcloud functions describe` calls. It
does not print secrets, IAM principals, source identifiers, URLs or
configuration values, and does not change project settings.

Even 5/5 `STABLE_METADATA_ONLY` is not proof of pinned archive contents,
reviewed IAM roles, runtime App Check, or closure of the P63 Staging
callable guard drift. P74/P77 evidence and P78 release gates remain open.
No deployment is authorized.

## Operator Cloud Shell (after this branch CI passes)
Use a clean clone or a fresh folder, keeping existing Cloud Shell changes.
Do not run on the Production project.

```bash
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p79-staging-revision-stability-preflight \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
python3 "$WORKDIR/packtook/production/scripts/p79-staging-revision-readonly.py" --inspect
```

Send only the script's redacted summary. Never paste raw function
descriptions, service account emails or provider tokens.

**P79 is metadata-only. RELEASE=NO_GO_RELEASE.**
