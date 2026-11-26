#!/usr/bin/env bash
# P231.112 — read-only staging frontend code references, sanitized.
# Does not read or print firebase key values, user identities, or token material.
set -u -o pipefail
set +x
echo 'P231_CHECK=STAGING_CLIENT_APPCHECK_STATIC_INVENTORY'
REPO="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 2
if [ "$(gcloud config get-value project 2>/dev/null)" != 'packtook-staging' ]; then
 echo 'P231_GATE=BLOCKED_PROJECT'; exit 2
fi
cd "$REPO" || exit 2
# Scan only tracked files so no private .env, ignored secrets, npm modules, or git metadata.
python3 - <<'PY'
import subprocess
from pathlib import Path
files = subprocess.check_output(["git","ls-files","-z"]).split(b"\0")
stats = {
 "STAGING_PROJECT_REFERENCES":0,
 "APPCHECK_INITIALIZE_REFERENCES":0,
 "ENTERPRISE_PROVIDER_REFERENCES":0,
 "APPCHECK_GETTOKEN_REFERENCES":0,
 "FIREBASE_AUTH_REFERENCES":0,
}
for raw in files:
    if not raw: continue
    path=Path(raw.decode("utf-8","surrogateescape"))
    if path.suffix.lower() not in (".js",".jsx",".ts",".tsx",".html",".json"):
        continue
    if "node_modules" in path.parts or path.stat().st_size>1024*1024:
        continue
    try: content=path.read_text(encoding="utf-8")
    except (UnicodeDecodeError,OSError):continue
    stats["STAGING_PROJECT_REFERENCES"] += int("packtook-staging" in content)
    stats["APPCHECK_INITIALIZE_REFERENCES"] += int("initializeAppCheck" in content)
    stats["ENTERPRISE_PROVIDER_REFERENCES"] += int("ReCaptchaEnterpriseProvider" in content)
    stats["APPCHECK_GETTOKEN_REFERENCES"] += int("getToken" in content and ("AppCheck" in content or "appCheck" in content))
    stats["FIREBASE_AUTH_REFERENCES"] += int("getAuth(" in content or "initializeAuth(" in content)
for key,val in stats.items():
    print("P231_"+key+"="+str(val)+"_TRACKED_FILES")
print("P231_SCAN_SCOPE=TRACKED_REPO_FILES_ONLY")
print("P231_STAGING_FRONTEND_RUNTIME_CONFIG=NOT_VERIFIED")
print("P231_REAL_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED")
print("P231_E2E=NOT_PERFORMED")
print("P231_CLOUD_WRITES=0")
print("P231_RELEASE=NO_GO")
PY
