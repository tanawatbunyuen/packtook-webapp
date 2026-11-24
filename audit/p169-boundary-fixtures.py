#!/usr/bin/env python3
"""P169 does not run Firebase or mutate any accounts."""
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("p169",Path(__file__).with_name("p169-auth-boundary-inventory.py"))
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
assert p.git_blob(p.SOURCE.read_bytes())==p.EXPECTED_SOURCE
print("P169_SOURCE_HASH=PASS")
observed={"http":403,"status":"PERMISSION_DENIED",
          "handler_entered":True,"db_reads_unchanged":True}
t=p.triage(observed)
assert t["security_denial"] and not t["protocol_conformant"]
assert t["handler_entered"] and not t["authenticity_verified"]
print("P169_403_WITH_HANDLER_ENTRY_NOT_PROTOCOL_PASS=PASS")
standard=p.triage({"http":401,"status":"UNAUTHENTICATED",
                   "handler_entered":False,"db_reads_unchanged":True})
assert standard["protocol_conformant"] and not standard["authenticity_verified"]
print("P169_401_CANNOT_PROVE_TOKEN_CRYPTOGRAPHY=PASS")
for record in (
 {"http":200,"status":None,"handler_entered":True,"db_reads_unchanged":False},
 {"http":403,"status":"PERMISSION_DENIED","handler_entered":True,"db_reads_unchanged":False},
 {"http":0,"status":None,"handler_entered":False,"db_reads_unchanged":True},
):
 assert not p.triage(record)["security_denial"]
print("P169_FAIL_CLOSED_UNEXPECTED_READ_SUCCESS_OR_NETWORK=PASS")
print("P169_OFFLINE_FIXTURES=4/4_PASS")
