# PACKTOOK P93 — Artifact Registry Digest Metadata Resolvability

## Operator P92 evidence
Staging shows 20/20 recordingStatus and 21/21 usageStatus historical
Cloud Run image references in digest-pinned syntax. All 41 historical
Ready metadata conditions and creation times are present. This does
not demonstrate current image availability or rollback recoverability.

## What P93 adds
P93 is an opt-in **Staging-only read-only** Artifact Registry metadata
lookup. A run checks ONE of two original status functions, reading
its current visible revision plus at most TWO more recent prior visible
revisions (bounded 3 total). The prior revisions are sampled by creation
timestamp for observational evidence, NOT selected as rollback candidates.

Image references are accepted only if they are complete SHA-256 references
to `asia-southeast1-docker.pkg.dev/packtook-staging/...`, never an
arbitrary external registry, Production project or mutable tag.

Uses `gcloud artifacts docker images describe` with full digest and
`--format=json` (Google documented read-only interface) and requires
`image_summary.digest` to match the requested SHA-256 digest.
Permission errors, repository mismatch, missing fields, changed
Function metadata and unsupported registry paths fail closed.
The tool suppresses raw Cloud CLI errors, image names, digests and
resource addresses in user-facing output.

The result is only **matching digest metadata readable**. It does NOT
pull/recreate the container, attest its supply chain, verify a
known-good previous security policy, prove source-to-Git equivalence,
select a safe deployment selector or restore a prior revision.

## Operator Cloud Shell (optional, read-only)
Run on a trusted Cloud Shell with active project `packtook-staging`.
Each function is independently opt-in. No npm install, elevated
permissions, IAM writes or deployments required; if registry metadata
permissions are missing, the script returns NOT_VERIFIABLE.

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p93-registry-image-availability \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

for NAME in recordingStatus usageStatus; do
  echo "=== P93 REGISTRY CHECK: $NAME ==="
  timeout --signal=TERM --kill-after=5s 150s \
    python3 -u "$WORKDIR/packtook/production/scripts/p93-registry-digest-metadata-readonly.py" \
      --inspect --function "$NAME"
done
```

If one function fails, the loop stops. Avoid repeated attempts.
This check makes a maximum of 3 read-only Artifact Registry metadata
lookups per Function; access may be denied without Artifacts Reader.

## Important unresolved release gates
P80 deployed Staging Guard Drift remains UNREMEDIATED.
Existing five status/credit exports share `beta` in the checked-out
repository; the live deployment selector is NOT_VERIFIED. App Check
backend enforcement, effective IAM, exact source-to-revision mapping,
known-good prior code and a tested isolated restore remain unresolved.
No Cloud resource change, traffic shift, IAM action or deploy is
authorized by this package. `RELEASE=NO_GO_RELEASE`.
