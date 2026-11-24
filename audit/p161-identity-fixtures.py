#!/usr/bin/env python3
import importlib.util,pathlib,unittest.mock as m,json
p=pathlib.Path(__file__).with_name("p161-local-identity-attest.py")
s=importlib.util.spec_from_file_location("p161",p);a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
good={k:{"host":"127.0.0.1","port":v,"listen":[{"address":"127.0.0.1","family":"IPv4","port":v}]} for k,v in a.PORTS.items()}
def fake_good(url):
    if url.endswith("/emulators"):return 200,json.dumps(good).encode()
    if "/documents/p161_unauthed_readonly_probe/" in url:return 403,b""
    raise AssertionError("unexpected URL")
with m.patch.object(a,"get",side_effect=fake_good):
    assert a.check()==0
print("P161_ALL_SERVICES_AND_DENY_ALL=PASS")
bad={**good,"auth":dict(good["auth"],host="::1")}
with m.patch.object(a,"get",side_effect=lambda url:(200,json.dumps(bad).encode()) if url.endswith("/emulators") else (403,b"")):
    assert a.check()==1
print("P161_REJECT_IPV6_AUTH=PASS")
with m.patch.object(a,"get",side_effect=lambda url:(200,json.dumps(good).encode()) if url.endswith("/emulators") else (404,b"")):
    assert a.check()==1
print("P161_REJECT_UNATTESTED_FIRESTORE_RULES=PASS")
with m.patch.object(a,"get",return_value=(0,b"")):
    assert a.check()==1
print("P161_HUB_UNAVAILABLE_FAIL_CLOSED=PASS")
print("P161_OFFLINE_FIXTURES=4/4_PASS")
