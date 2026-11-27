#!/usr/bin/env python3
"""PACKTOOK Full Public Gate B preflight: offline backend callable security inventory.
Inspect local source WITHOUT executing Functions or touching Firebase.
The output is a review inventory, not an App Check security PASS.
"""
from pathlib import Path
import re,sys,json
SRC=Path("functions/index.js")
def out(k,v):print(f"PACKTOOK_{k}={v}",flush=True)
out("CHECK","GATE_B_OFFLINE_BACKEND_POLICY_INVENTORY")
try:
 s=SRC.read_text("utf8")
 # Named callable declarations; dynamic exports/declarations are explicitly outside this scanner.
 defs=list(re.finditer(r"exports\.([A-Za-z_][\w]*)\s*=\s*(onCall|onRequest)\s*\(",s))
 policies={}
 for i,m in enumerate(defs):
  body=s[m.end():min(m.end()+180,len(s))]
  # Extract first argument of the wrapper to a bracket, comma or brace.
  argument=re.match(r"\\s*([A-Za-z_][\\w]*)\\s*,",body)
  if argument:
   option=argument.group(1)
  elif body.lstrip().startswith("{"):
   option="inlineObject_NOT_SEMANTICALLY_CLASSIFIED"
  else:
   raise ValueError("unparseable options")
  policies[m.group(1)]=(m.group(2),option)
 if len(policies)<20:raise ValueError("missing handlers")
 if 'const statusOptions={...options,enforceAppCheck:true};' not in s:
  raise ValueError("expected statusOptions declaration missing")
 if "exports.usageStatus" not in s or "exports.reserveCredit" not in s:
  raise ValueError("key handlers missing")
 # A static declaration is only a declaration, not proof of effective deployed runtime settings.
 reviewed=[("usageStatus","statusOptions"),("recordingStatus","statusOptions"),
           ("reserveCredit","options"),("finalizeCredit","options")]
 if any(policies.get(name)!=( "onCall",opt) for name,opt in reviewed):
  raise ValueError("critical handlers drift")
 enforce_explicit=sorted(k for k,(typ,opt) in policies.items() if typ=="onCall" and opt=="statusOptions")
 default=sorted(k for k,(typ,opt) in policies.items() if typ=="onCall" and opt=="options")
 indeterminate=sorted(k for k,(typ,opt) in policies.items() if typ=="onCall" and opt not in ("statusOptions","options"))
 http=sorted(k for k,(typ,opt) in policies.items() if typ=="onRequest")
 out("HANDLER_DECLARATIONS_FOUND",len(policies))
 out("CALLABLE_EXPLICIT_STATUS_OPTIONS_COUNT",len(enforce_explicit))
 out("CALLABLE_DEFAULT_OPTIONS_COUNT",len(default))
 out("CALLABLE_OTHER_OPTIONS_COUNT",len(indeterminate))
 out("HTTP_HANDLERS_COUNT",len(http))
 out("EXPLICIT_STATUS_OPTIONS_HANDLERS",",".join(enforce_explicit))
 out("SENSITIVE_DEFAULT_OPTIONS_HANDLERS",",".join(k for k in ("reserveCredit","finalizeCredit","registerDevice","requestPlanChange") if k in default))
 out("PAYMENT_OPTIONS_REVIEW","REQUIRED")
 out("APPCHECK_ALL_HANDLERS_ENFORCED","NOT_ESTABLISHED")
 out("DEPLOYED_CONFIGURATION","NOT_VERIFIED")
 out("GATE_B_SECURITY","OPEN")
 out("CLOUD_WRITES","0");out("NETWORK_REQUESTS","0")
 out("DEPLOY","NOT_PERFORMED");out("FULL_PUBLIC","NO_GO")
 sys.exit(0)
except Exception:
 out("INVENTORY","BLOCKED_UNEXPECTED_SOURCE")
 out("CLOUD_WRITES","0");out("DEPLOY","NOT_PERFORMED");out("FULL_PUBLIC","NO_GO")
 sys.exit(2)
