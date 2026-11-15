# Omise Test Charge 404 — Support evidence pack

Read-only diagnostic conclusion: Cloud Run Job `packtook-omise-test-probe-q8g8x` (Nov 15, 2026) called **GET /charges/{id}** and returned HTTP 404 `not_found`. Source: operator shared sanitized logs. The user separately confirmed dashboard Charge ID, paid test mode charge 299 THB, Secret Manager version 1 ENABLED and Secret Key matches dashboard. These user checks are **not independent API verification**.

Official Omise reference: `GET https://api.omise.co/charges/{id}` and `404 not_found` is object not found, not API version incompatibility (`serializer_not_found` or `service_not_found`). See https://docs.omise.co/charges-api and https://docs.omise.co/api-errors.

## Safely generate a support note without provider calls
Using the existing Cloud Shell worktree on this reviewed branch, save *only application log text for the known execution*, **not** the complete Cloud Logging JSON including labels or runtime environment:

```bash
gcloud beta run jobs executions logs read packtook-omise-test-probe-q8g8x \
  --project=packtook-staging --region=asia-southeast1 --limit=30 > /tmp/omise-q8g8x.log
python3 production/scripts/rr-omise-support-evidence.py \
  --execution=packtook-omise-test-probe-q8g8x \
  --log-file=/tmp/omise-q8g8x.log \
  --out=/tmp/packtook-omise-support-note.txt
cat /tmp/packtook-omise-support-note.txt
```

The script **never connects to Google Cloud or Omise**. It reads only a saved input file and outputs a strict fixed template with allowlisted status/code. It does not copy any raw logging lines, response bodies, secrets, header values, email, UID or request ID. It refuses overwrites. Review note privately before emailing. Delete raw logs after review if not needed.

## Next controlled action
Provide the sanitized note to Omise Support and request confirmation that this exact test charge is accessible by the API for this account, whether the charge is associated with an alternate credential scope or whether there is a provider-side data visibility issue. Do not disclose the Test Secret Key.

No more blind Cloud Run execution. No new charge, secret rotation, IAM update, API version change, Production release or credit grant until provider evidence clarifies the issue. All other non-payment smoke/unit testing may continue offline.

**NO_GO_RELEASE / PUBLIC CLOSED / STAGING ONLY.**
