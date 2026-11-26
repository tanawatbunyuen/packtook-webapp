#!/usr/bin/env bash
# P231.107 — read-only staging Firebase app inventory for App Check E2E planning.
# No credential minting, no service invocation, no changes to IAM/deploy/cleanup.
set -u -o pipefail
set +x
PROJECT=packtook-staging
echo 'P231_CHECK=STAGING_APPCHECK_APP_INVENTORY_READONLY'
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then
 echo 'P231_PROJECT=BLOCKED_NOT_STAGING';exit 2
fi
if ! command -v firebase >/dev/null || ! command -v node >/dev/null;then
 echo 'P231_GATE=BLOCKED_REQUIRED_CLI';exit 2
fi
if [ "$(TZ=Asia/Bangkok date +%F)" != '2026-11-26' ];then
 echo 'P231_APPROVED_E2E_DATE=EXPIRED';exit 2
fi
# No raw app identifiers, display names or email addresses printed.
RAW="$(firebase apps:list --project "$PROJECT" --json 2>/dev/null)"
if [ "$?" -ne 0 ];then echo 'P231_FIREBASE_APP_INVENTORY=UNAVAILABLE';exit 2;fi
printf '%s' "$RAW" | node -e '
let s="";
process.stdin.on("data",x=>s+=x);
process.stdin.on("end",()=>{
try {
 const obj=JSON.parse(s);
 if(obj.status!=="success" && obj.status!==undefined) throw Error("CLI error");
 const apps=Array.isArray(obj.result)?obj.result:(Array.isArray(obj.apps)?obj.apps:null);
 if(!apps) throw Error("Unexpected app list schema");
 const web=apps.filter(x=>String(x.platform||x.type||"").toUpperCase()==="WEB");
 console.log("P231_FIREBASE_APP_INVENTORY=READABLE");
 console.log("P231_REGISTERED_WEB_APP_COUNT="+web.length);
 console.log("P231_VALID_APP_ID=NOT_SELECTED");
 console.log("P231_APPCHECK_PROVIDER=NOT_VERIFIED");
} catch {console.log("P231_FIREBASE_APP_INVENTORY=UNEXPECTED_SCHEMA");process.exitCode=2}
})' || exit 2
echo 'P231_VERIFIED_STAGING_AUTH_USER=NOT_VERIFIED'
echo 'P231_STAGING_APPCHECK_TOKEN=NOT_MINTED'
echo 'P231_E2E=NOT_PERFORMED'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_CLEANUP=NOT_PERFORMED'
echo 'P231_RELEASE=NO_GO'
