#!/usr/bin/env python3
"""P231.138: read-only redacted log corroboration for isolated staging callable.
Never prints log payloads, request IDs, headers, principals or identities.
"""
import datetime,json,re,subprocess,sys
from collections import Counter
from zoneinfo import ZoneInfo
P="packtook-staging"
SERVICE="p231appcheckisolatedprobe"
def report(k,v):print("P231_"+k+"="+str(v),flush=True)
report("CHECK","ISOLATED_APPCHECK_RUNTIME_LOG_CORROBORATION_READONLY")
try:
    if subprocess.check_output(["gcloud","config","get-value","project"],
      text=True,stderr=subprocess.DEVNULL,timeout=20).strip()!=P:
        report("GATE","BLOCKED_NOT_STAGING");sys.exit(2)
    filt=('resource.type="cloud_run_revision" AND '
          'resource.labels.service_name="'+SERVICE+'"')
    raw=subprocess.check_output([
      "gcloud","logging","read",filt,"--project="+P,"--freshness=3h",
      "--limit=500","--format=json"],text=True,stderr=subprocess.DEVNULL,
      timeout=40)
    logs=json.loads(raw)
except Exception:
    report("GATE","BLOCKED_LOG_READ_OR_PARSE")
    report("RELEASE","NO_GO")
    sys.exit(2)
request_codes=Counter()
evidence=Counter()
for item in logs:
    # Only analyze isolated service. Never output raw log texts.
    labels=item.get("resource",{}).get("labels",{})
    if labels.get("service_name")!=SERVICE:continue
    http=item.get("httpRequest") or {}
    code=http.get("status")
    if isinstance(code,int):
        request_codes[code]+=1
    msg=item.get("textPayload","")
    if not isinstance(msg,str):msg=""
    if isinstance(item.get("jsonPayload"),dict):
        js=item["jsonPayload"]
        for k in ("message","msg"):
            if isinstance(js.get(k),str):msg+=" "+js[k]
    low=msg.lower()
    # Narrowly counted candidate diagnostics; no content is echoed.
    if "app check" in low or "appcheck" in low:
        if any(x in low for x in ("invalid","failed","missing","reject","verify","unauthorized")):
            evidence["APPCHECK_REJECTION_CANDIDATE"]+=1
        elif "valid" in low or "verified" in low:
            evidence["APPCHECK_SUCCESS_CANDIDATE"]+=1
        else:evidence["APPCHECK_MENTION"]+=1
report("LOG_WINDOW","LAST_3_HOURS")
report("ISOLATED_LOG_ENTRY_COUNT",len(logs))
report("HTTP_200_COUNT",request_codes[200])
report("HTTP_401_COUNT",request_codes[401])
report("HTTP_403_COUNT",request_codes[403])
report("HTTP_OTHER_COUNT",sum(n for k,n in request_codes.items() if k not in (200,401,403)))
report("APPCHECK_REJECTION_DIAGNOSTIC_CANDIDATES",evidence["APPCHECK_REJECTION_CANDIDATE"])
report("APPCHECK_SUCCESS_DIAGNOSTIC_CANDIDATES",evidence["APPCHECK_SUCCESS_CANDIDATE"])
report("APPCHECK_OTHER_MENTIONS",evidence["APPCHECK_MENTION"])
report("RESULT","LOG_AGGREGATES_ONLY_NOT_REQUEST_CORRELATED")
report("RUNTIME_E2E_HTTP_BEHAVIOR","PASS_OPERATOR_REPORTED")
report("APPCHECK_ENFORCEMENT_ROOT_CAUSE","REQUIRES_CORRELATED_DIAGNOSTICS")
report("TOKEN_VALUES","NOT_READ_OR_PRINTED")
report("IAM_WRITES","0")
report("DEPLOY","NOT_PERFORMED")
report("CLEANUP","NOT_PERFORMED")
report("RELEASE","NO_GO")
