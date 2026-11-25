# P216 — P188 vs protected Staging Source ZIP: byte verifier

**Actual G02 state remains NO_GO / NO_GO_RELEASE / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.**

This is the first operator-local utility in the sequence that **can compare actual source bytes**, when an independently authorized staging operator possesses an original trusted Cloud Functions source ZIP. It does **not** fetch the ZIP itself or establish whether the archive is genuinely the one deployed.

## Verified historical pins, not proof of origin

- Reported source: gs://gcf-v2-sources-689946391888-asia-southeast1/usageStatus/function-source.zip, generation 1794070024475037
- Reported Cloud Build: 8dc6958c-b6dc-4188-a675-2740b18f7098
- Reported Cloud Run revision: usagestatus-00021-nob
- P188 isolated candidate SHA256: c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b
- 7-day Artifact Registry cleanup policy may limit retrievable container images, but does NOT prove any specific deletion.
- Existing reported Staging revision predates the P188 candidate; even if ZIP contents unexpectedly match, independent source-to-build-to-revision verification remains necessary.

## Safe offline use (not GitHub CI)

After authorized operator has placed the original ZIP in a secure local directory (outside repository), and after rebuilding P188 locally with demo-only environment as required:

    python3 audit/p216/source_zip_verify.py /secure/private/staging/function-source.zip

The verifier accepts a bounded ordinary ZIP with exactly one code entrypoint named index.js or functions/index.js, rejects ZIP-slip paths, duplicate names, symlinks, encrypted/unsupported entries, archives >16 MiB, expansion >32 MiB, >500 members and entrypoint >2 MiB. Other layouts are marked REJECTED for manual review; the verifier does not guess where bundled source code is. It reads only the entrypoint bytes; no file is extracted or printed. It prints sanitized equality/denial only. A mismatch is an important negative result and must not be ignored.

**Trust boundary:** Byte equality to a local archive is *not* authenticity of provider archive, Cloud Build output, the deployed Cloud Run image, actual Staging handler code, App Check, or reviewer signoff. No local invocation can promote G02 to GO. Never place raw source ZIP, customer data, Auth/App Check tokens or credentials in GitHub, CI logs, PRs or chat.

GitHub Actions executes only synthetic ZIP adversarial fixtures with generated P188 candidate and the existing P215 release gates. No staging/production Cloud API calls, IAM changes, deployment, merge, migration or public signup.
