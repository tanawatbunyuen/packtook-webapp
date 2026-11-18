#!/usr/bin/env python3
"""P78 optional operator-run Cloud Shell read-only metadata check.

Never deploys, changes active project, reads source archives, or displays IAM
principals, secrets, environment values or source URIs. Requires --inspect.
"""
import argparse
import json
import subprocess
import sys

PROJECT = "packtook-staging"
REGION = "asia-southeast1"
NAMES = ("recordingStatus", "usageStatus", "reserveCredit",
         "finalizeCredit", "recoverStaleVideoReservation")


def call(args):
    result = subprocess.run(args, capture_output=True, text=True,
                            timeout=25, check=False)
    if result.returncode:
        raise RuntimeError("READ_ONLY_COMMAND_FAILED")
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inspect", action="store_true")
    args = parser.parse_args()
    if not args.inspect:
        print("P78_OPERATOR_OPT_IN_REQUIRED")
        return 2
    try:
        active = call(["gcloud", "config", "get-value", "project"])
        if active != PROJECT:
            print("P78_PROJECT_GUARD=BLOCKED_WRONG_ACTIVE_PROJECT")
            return 2
        records = []
        for name in NAMES:
            raw = call(["gcloud", "functions", "describe", name,
                        "--gen2", "--region", REGION, "--project", PROJECT,
                        "--format=json"])
            if len(raw) > 120000:
                raise RuntimeError("RESPONSE_TOO_LARGE")
            body = json.loads(raw)
            config = body.get("serviceConfig") or {}
            build = body.get("buildConfig") or {}
            records.append({
                "name": name,
                "generation": str(body.get("environment", "NOT_VERIFIED")),
                "state": "ACTIVE" if body.get("state") == "ACTIVE" else "NOT_ACTIVE_OR_UNKNOWN",
                "runtime_service_identity_present": bool(config.get("serviceAccountEmail")),
                "source_revision_metadata_present": bool(
                    body.get("updateTime") and
                    (build.get("source") or build.get("build"))
                ),
                # Never infer App Check from generation/config metadata.
                "backend_app_check": "NOT_PROVEN",
                "guarded_wrapper_deployed": "NOT_VERIFIED",
            })
        print("P78_PROJECT_GUARD=PASS_STAGING_ONLY")
        for item in records:
            print("P78_FUNCTION=" + item["name"])
            print("  GENERATION=" + item["generation"])
            print("  FUNCTION_STATE=" + item["state"])
            print("  RUNTIME_IDENTITY_PRESENT=" +
                  ("YES" if item["runtime_service_identity_present"] else "NO"))
            print("  PINNED_SOURCE_METADATA=" +
                  ("PRESENT_UNVERIFIED" if item["source_revision_metadata_present"]
                   else "NOT_VERIFIED"))
            print("  BACKEND_APP_CHECK=NOT_PROVEN")
            print("  GUARDED_CALL=NOT_VERIFIED")
        print("P78_READ_ONLY_METADATA=CHECKED_NO_SECRETS_PRINTED")
        return 0
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError,
            subprocess.TimeoutExpired):
        print("P78_METADATA=NOT_VERIFIABLE")
        return 2
    finally:
        print("P78_CLOUD_WRITES=0")
        print("P78_DEPLOY=0")
        print("P78_RELEASE=NO_GO_RELEASE")


if __name__ == "__main__":
    sys.exit(main())
