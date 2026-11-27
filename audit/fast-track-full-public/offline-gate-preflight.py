#!/usr/bin/env python3
"""PACKTOOK Fast Track Full Public offline decision preflight.
Validates plan/ledger, checks no release authorization, always blocks until
verified evidence is added and independent release approval is granted.
Zero network, cloud, file writes or deploy.
"""
import json,sys
from pathlib import Path
p=Path("audit/fast-track-full-public/GATE_STATUS.json")
def show(k,v):print(f"PACKTOOK_{k}={v}",flush=True)
show("CHECK","FULL_PUBLIC_FAST_TRACK_GATE_LEDGER_OFFLINE")
try:
 d=json.loads(p.read_text("utf8"))
 assert d["schema_version"]==1 and d["project"]=="PACKTOOK" and d["plan"]=="FAST_TRACK_FULL_PUBLIC"
 assert d["branch"]=="review/p231-appcheck-runtime-readiness"
 assert d["decision"]=="NO_GO_FULL_PUBLIC"
 assert d["deploy_authorized"] is False and d["public_signup_enabled_by_this_plan"] is False
 assert d["production_writes_authorized"] is False
 for key,expected_ids in (("gate_a",[f"A{i}" for i in range(1,5)]),
                          ("gate_b",[f"B{i}" for i in range(1,7)]),
                          ("gate_c",[f"C{i}" for i in range(1,8)])):
  g=d[key]
  assert g["status"] in ("BLOCKED","BLOCKED_NOT_EXECUTED")
  assert [v["id"] for v in g["checks"]]==expected_ids
  allowed={"OPEN","PARTIAL","PASS_OFFLINE_MOCK"}
  assert all(item["status"] in allowed for item in g["checks"])
  if key!="gate_a":assert all(item["status"]=="OPEN" for item in g["checks"])
  if key=="gate_a":
   assert next(x for x in g["checks"] if x["id"]=="A3")["status"]=="PASS_OFFLINE_MOCK"
   assert next(x for x in g["checks"] if x["id"]=="A2")["status"]=="PARTIAL"
 assert len(d["reusable_evidence"])>=7
except Exception:
 show("LEDGER_VALIDATION","FAIL_CLOSED")
 show("RELEASE","NO_GO")
 sys.exit(2)
show("LEDGER_VALIDATION","PASS")
show("REUSED_HISTORICAL_EVIDENCE_REFERENCES",len(d["reusable_evidence"]))
for id in "abc":
 g=d["gate_"+id]
 show("GATE_"+id.upper(),g["status"])
 show("GATE_"+id.upper()+"_OPEN_CHECKS",sum(item["status"]=="OPEN" for item in g["checks"]))
 show("GATE_"+id.upper()+"_PARTIAL_CHECKS",sum(item["status"]=="PARTIAL" for item in g["checks"]))
 show("GATE_"+id.upper()+"_MOCK_ONLY_CHECKS",sum(item["status"]=="PASS_OFFLINE_MOCK" for item in g["checks"]))
show("REVIEW_ONLY_CANDIDATE","PINNED_IN_OPERATOR_TEMP_WORKSPACE")
show("ACTUAL_DEPLOYABLE_CANDIDATE","NOT_APPROVED")
show("REAL_CANDIDATE_E2E","NOT_EXECUTED")
show("RELEASE_APPROVAL","NOT_GRANTED")
show("STAGING_DEPLOY","NOT_AUTHORIZED")
show("PRODUCTION_DEPLOY","NOT_AUTHORIZED")
show("PUBLIC_SIGNUP","NOT_AUTHORIZED")
show("NETWORK_REQUESTS","0")
show("CLOUD_WRITES","0")
show("FILE_WRITES","0")
show("RELEASE","NO_GO")
sys.exit(3)
