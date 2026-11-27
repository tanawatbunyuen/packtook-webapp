#!/usr/bin/env python3
"""One-run PACKTOOK Fast Track decision summary, offline fail-closed.
No Firebase CLI, network, auth, cloud mutations, or file writes.
Exit 3 means the planning ledger correctly prevents public launch.
"""
import json,re,sys
from pathlib import Path
def emit(name,value):print("PACKTOOK_"+name+"="+str(value),flush=True)
emit("CHECK","FAST_TRACK_INTEGRATED_RELEASE_DECISION")
try:
 p=Path("audit/fast-track-full-public/GATE_STATUS.json")
 d=json.loads(p.read_text("utf8"))
 fn=Path("functions/index.js").read_text("utf8")
 rules=Path("firestore.rules").read_text("utf8")
 hosting=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
 assert d["project"]=="PACKTOOK" and d["decision"]=="NO_GO_FULL_PUBLIC"
 assert d["deploy_authorized"] is False and d["production_writes_authorized"] is False
 assert d["public_signup_enabled_by_this_plan"] is False
 assert hosting["public"]=="firebase-staging"
 assert d["gate_a"]["status"]=="BLOCKED"
 assert d["gate_b"]["status"]=="BLOCKED_NOT_EXECUTED"
 assert d["gate_c"]["status"]=="BLOCKED_NOT_EXECUTED"
 assert next(x for x in d["gate_a"]["checks"] if x["id"]=="A3")["status"]=="PASS_OFFLINE_MOCK"
 assert next(x for x in d["gate_a"]["checks"] if x["id"]=="A2")["status"]=="PARTIAL"
 assert "const statusOptions={...options,enforceAppCheck:true};" in fn
 handlers=list(re.finditer(r"exports\.([A-Za-z_][\w]*)\s*=\s*(onCall|onRequest)\s*\(",fn))
 assert len(handlers)==23
 assert "allow write: if false;" in rules
 assert "function signedIn()" in rules
 # Source-only red flags -- never silently claim runtime deployment parity.
 assert "exports.reserveCredit=onCall(options" in fn
 assert "exports.createOmisePayment=onCall(paymentSecrets" in fn
 assert "exports.omisePaymentWebhook=onRequest" in fn
except Exception:
 emit("PREFLIGHT","FAIL_CLOSED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
emit("PREFLIGHT","PASS")
emit("REUSABLE_EVIDENCE_ITEMS",len(d["reusable_evidence"]))
emit("GATE_A_STATUS",d["gate_a"]["status"])
emit("GATE_A_MOCK_BROWSER","PASS_REUSE")
emit("GATE_A_CANDIDATE_PACKAGING","PARTIAL_OFFLINE_ONLY")
emit("GATE_B_STATUS",d["gate_b"]["status"])
emit("GATE_B_BACKEND_HANDLER_DECLARATIONS",len(handlers))
emit("GATE_B_UNIFORM_APPCHECK","NOT_ESTABLISHED")
emit("GATE_B_REAL_E2E","NOT_EXECUTED")
emit("GATE_C_STATUS",d["gate_c"]["status"])
emit("OFFLINE_FIRESTORE_RULES","READ_ONLY_REVIEW_NOT_DEPLOYED_PROOF")
emit("OMISE_TEST_MODE","REAL_SANDBOX_E2E_NOT_EXECUTED")
emit("SOURCE_SIGNUP_CONTROL","NOT_FOUND_IN_FUNCTIONS_INDEX_REQUIRES_TARGET_INVENTORY")
emit("RELEASE_DEPLOY","NOT_AUTHORIZED")
emit("PUBLIC_SIGNUP","NOT_AUTHORIZED")
emit("CLOUD_WRITES","0")
emit("NETWORK_REQUESTS","0")
emit("FILE_WRITES","0")
emit("RELEASE","NO_GO")
sys.exit(3)
