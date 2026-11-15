#!/usr/bin/env python3
"""Make a secret-free Omise TEST support note from pre-existing Cloud Run logs.
Never calls Google Cloud or Omise. Only known stable non-secret fields are emitted.
"""
import argparse
import re
from pathlib import Path

EXEC=re.compile(r"^packtook-omise-test-probe-[a-z0-9]{5}$")
CATEGORIES={"PROVIDER_HTTP_NOT_SUCCESS","PROVIDER_TIMEOUT",
 "TEST_CHARGE_ID_OR_LIVEMODE_MISMATCH","AMOUNT_OR_OWNER_METADATA_MISMATCH",
 "CONFIG_OR_PROVIDER_FAILURE","TEST_SECRET_ONLY"}
CODES={"not_found","serializer_not_found","service_not_found","UNKNOWN",
 "authentication_failure","key_expired_error","locked_account_error","not_authorized",
 "too_many_requests","internal_error","search_unavailable"}
FIELD=re.compile(r"(?m)^.*?\b(OMISE_TEST_READ_ONLY_VERIFIED|FAILURE_CATEGORY|PROVIDER_HTTP_STATUS|PROVIDER_ERROR_CODE):[ \t]*([^\r\n]*)$")
CHARGE="chrg_test_69jkgjiaft9zvl2pzst"
PROJECT="packtook-staging"
def sanitized(lines, execution):
 if not EXEC.fullmatch(execution):raise ValueError("INVALID_EXECUTION_NAME")
 if len(lines)>20000:raise ValueError("INPUT_TOO_LARGE")
 fields={}
 for match in FIELD.finditer(lines):
  key,value=match.groups()
  fields[key]=value.strip()
 status=fields.get("OMISE_TEST_READ_ONLY_VERIFIED")
 if status not in ("PASS","FAIL"):raise ValueError("UNKNOWN_VERIFICATION_STATUS")
 category=fields.get("FAILURE_CATEGORY","NOT_REPORTED")
 if category!="NOT_REPORTED" and category not in CATEGORIES:category="OTHER_REDACTED"
 rawcode=fields.get("PROVIDER_ERROR_CODE","NOT_REPORTED")
 code=rawcode if rawcode in CODES or rawcode=="NOT_REPORTED" else "OTHER_REDACTED"
 http=fields.get("PROVIDER_HTTP_STATUS","NOT_REPORTED")
 if http not in ("NOT_REPORTED","UNKNOWN") and not (http.isascii() and http.isdigit() and 100<=int(http)<=599):
  http="OTHER_REDACTED"
 return {"execution":execution,"verification":status,"failure":category,"http_status":http,"provider_code":code}
def render(evidence):
 return ("PACKTOOK / Omise Test Mode - Support Evidence (sanitized)\n"
  "Project environment: packtook-staging (no production)\n"
  "Charge ID: "+CHARGE+"\n"
  "Dashboard: Test Mode; 299 THB; PromptPay; paid (reported by operator)\n"
  "Test Secret Key: operator confirmed matches Secret Manager version 1 (not independently verified by this report)\n"
  "API endpoint: GET https://api.omise.co/charges/{id}\n"
  "Cloud Run execution: "+evidence["execution"]+"\n"
  "Charge verification: "+evidence["verification"]+"\n"
  "Failure category: "+evidence["failure"]+"\n"
  "HTTP status: "+evidence["http_status"]+"\n"
  "Provider error code: "+evidence["provider_code"]+"\n"
  "Request: Please confirm whether this test charge is visible through the Test API for this Omise account and explain the 404/not_found response.\n"
  "Security: No API keys, request/response bodies, credential headers, or customer metadata included.\n"
  "No production deploy or real payment operation authorized.\n")
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--execution",required=True)
 p.add_argument("--log-file",type=Path,required=True,help="existing text log file; never automatically fetch")
 p.add_argument("--out",type=Path,help="optional output file; defaults to stdout")
 args=p.parse_args()
 evidence=sanitized(args.log_file.read_text(encoding="utf8"),args.execution)
 report=render(evidence)
 if args.out:
  if args.out.exists():raise SystemExit("OUTPUT_EXISTS_NO_OVERWRITE")
  args.out.write_text(report,encoding="utf8")
  print("SANITIZED_SUPPORT_NOTE_CREATED")
 else:print(report,end="")
if __name__=="__main__":main()
