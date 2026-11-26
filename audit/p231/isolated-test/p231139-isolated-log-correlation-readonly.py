#!/usr/bin/env python3
"""P231.139 — Read-only correlation of isolated Cloud Run request statuses
and Firebase App Check diagnostic logs. No raw logs, trace IDs, tokens,
request payloads, account details, or timestamps printed.
"""
import datetime,json,subprocess,sys
from collections import Counter
from zoneinfo import ZoneInfo
PROJECT="packtook-staging"
SERVICE="p231appcheckisolatedprobe"
def out(k,v): print(f"P231_{k}={v}",flush=True)
out("CHECK","ISOLATED_APPCHECK_LOG_CORRELATION_READONLY")
try:
    project=subprocess.check_output(["gcloud","config","get-value","project"],text=True,
                                    stderr=subprocess.DEVNULL,timeout=15).strip()
    if project!=PROJECT:
        out("GATE","BLOCKED_NOT_STAGING");sys.exit(2)
    filt=('resource.type="cloud_run_revision" AND '
          'resource.labels.service_name="'+SERVICE+'"')
    data=subprocess.check_output(["gcloud","logging","read",filt,
                                 "--project="+PROJECT,"--freshness=6h",
                                 "--limit=1000","--format=json"],
                                 text=True,stderr=subprocess.DEVNULL,timeout=45)
    records=json.loads(data)
    if not isinstance(records,list):raise ValueError("unexpected log format")
except Exception:
    out("GATE","BLOCKED_LOG_QUERY")
    out("RELEASE","NO_GO")
    sys.exit(2)

def safe_text(entry):
    # Only small, recognized message fields; never print or persist the content.
    fragments=[]
    val=entry.get("textPayload")
    if isinstance(val,str):fragments.append(val[:2048])
    val=entry.get("jsonPayload")
    if isinstance(val,dict):
        for k in ("message","msg"):
            t=val.get(k)
            if isinstance(t,str):fragments.append(t[:2048])
    return " ".join(fragments).lower()

requests={}
diagnostics={}
status_counts=Counter()
for item in records:
    if not isinstance(item,dict):continue
    if item.get("resource",{}).get("labels",{}).get("service_name")!=SERVICE:continue
    trace=item.get("trace")
    if not isinstance(trace,str) or not trace.startswith("projects/"+PROJECT+"/traces/"):
        trace=None
    http=item.get("httpRequest")
    if isinstance(http,dict) and isinstance(http.get("status"),int):
        code=http["status"]
        status_counts[code]+=1
        if trace:requests.setdefault(trace,[]).append(code)
    msg=safe_text(item)
    if ("app check" in msg or "appcheck" in msg) and any(
        word in msg for word in ("invalid","failed","missing","reject","verify","unauthorized")):
        if trace: diagnostics[trace]=diagnostics.get(trace,0)+1

paired_401=0
paired_200=0
for trace,codes in requests.items():
    if diagnostics.get(trace,0):
        paired_401+=codes.count(401)
        paired_200+=codes.count(200)

out("LOG_WINDOW","LAST_6_HOURS")
out("LOG_ENTRY_COUNT",len(records))
out("HTTP_200_COUNT",status_counts[200])
out("HTTP_401_COUNT",status_counts[401])
out("APPCHECK_DIAGNOSTIC_ENTRIES_WITH_TRACE",sum(diagnostics.values()))
out("HTTP_401_TRACE_MATCHED_APPCHECK_DIAGNOSTIC",paired_401)
out("HTTP_200_TRACE_MATCHED_APPCHECK_DIAGNOSTIC",paired_200)
if status_counts[200]>=1 and status_counts[401]>=2 and paired_401>=2 and paired_200==0:
    conclusion="TRACE_CORRELATION_SUPPORTS_APPCHECK_REJECTIONS"
elif status_counts[401]>0 and paired_401>0:
    conclusion="PARTIAL_TRACE_CORRELATION_INCONCLUSIVE"
else:
    conclusion="TRACE_CORRELATION_NOT_ESTABLISHED"
out("CORRELATION_RESULT",conclusion)
out("LOG_EVIDENCE","TRACE_BASED_ONLY_NO_TIME_PROXIMITY_ASSUMPTIONS")
out("UNMATCHED_LOGS","DO_NOT_INFER_ROOT_CAUSE")
out("RAW_LOGS_AND_TRACE_IDS","NOT_PRINTED")
out("CLOUD_WRITES","0")
out("RUNTIME_CALLS","0")
out("RELEASE","NO_GO")
