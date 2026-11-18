# PACKTOOK P92 — Known-good Rollback Image Provenance Review

## Owner evidence from P91
The live Staging read-only inspection reported 20 distinct historical
image *references* across 20 recordingStatus revisions and 21 distinct
references across 21 usageStatus revisions. Current Function revisions
were found in history, with one matching reference each. Metadata was
stable. This does not prove image immutability, existence, current
pullability, security or rollback viability.

## P92 difference from P91
A redacted, operator-only read-only inspector classifies historical
image references into explicitly SHA256 digest-pinned syntax vs
tag/other references, without exposing URLs, image names or digests.
It validates current-revision appearance and metadata stability. It
never retrieves container layers, Registry IAM, source ZIPs, secrets,
image signatures, users or billing. A digest reference remains
**metadata only**; Artifact Registry deletion or lack of access can
make the image unusable. Digest spelling alone does not map a deployed
revision to a Git commit.

No prior revision is chosen as known-good. Even a matching image across
revisions cannot be treated as a secure rollback.

## Optional Staging-only Cloud Shell inspection (read-only)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p92-known-good-rollback-provenance \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P92 IMAGE DIGEST PROVENANCE ==='
set +e
timeout --signal=TERM --kill-after=5s 120s \
  python3 -u "$WORKDIR/packtook/production/scripts/p92-image-digest-provenance-readonly.py" --inspect
RESULT=$?
echo "P92_EXIT_CODE=$RESULT"
echo 'P92_DIAGNOSTIC_COMPLETE'
```

No npm install. The tool does not deploy, modify traffic, list IAM
policies or read image bytes. If it fails or times out, keep NO_GO.

## Next evidence to acquire independently
1. Historical image digest metadata and whether image registry
   retains that digest, using least-privilege evidence without printing
   internal image path or digest.
2. Deployment-image-to-source and Git-commit equivalence with
   reproducible build provenance.
3. Determine **independently reviewed known-good** original-code
   revision; historical Ready is not sufficient.
4. Demonstrate a restore in an authorized isolated environment and
   confirm no credit mutation.
5. Validate current Staging deployed codebase ownership, a safe
   function-scoped deployment selector, IAM, backend App Check, live
   Auth negative tests and owner release change process.

P80 confirmed Staging guard drift for recordingStatus and usageStatus
remains unremediated. P81/P82 is candidate-only. No Cloud writes,
production changes, IAM changes, traffic changes, deployment or merge
are performed by P92. RELEASE=NO_GO_RELEASE.
