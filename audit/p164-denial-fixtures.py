#!/usr/bin/env python3
"""P164 mocked checks. Never uses network or real emulator."""
import importlib.util
from pathlib import Path
from unittest.mock import patch
path=Path(__file__).with_name("p164-client-write-denial.py")
spec=importlib.util.spec_from_file_location("p164",path)
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
u=[0]
users={}
cleanup=[]
def fake_auth(action,data):
    if action=="signUp":
        u[0]+=1
        uid="user"+str(u[0])
        token="fixture_"+uid+"x"*40
        users[data["email"]]=(data["password"],uid,token)
        return 200,{"localId":uid,"idToken":token}
    if action=="signInWithPassword":
        password,uid,token=users[data["email"]]
        return (200,{"localId":uid,"idToken":token}) if password==data["password"] else (400,{})
    if action=="delete":
        cleanup.append(data["idToken"])
        return 200,{}
    raise AssertionError("bad auth")

with patch.object(t.p,"auth",side_effect=fake_auth),\
     patch.object(t,"client_commit",return_value=403),\
     patch.object(t,"read_path",return_value=403):
    assert t.verify_p164() is True
    assert len(cleanup)==2
print("P164_DENY_ALL_CLIENT_WRITES_AND_UNMAPPED_READS=PASS")
cleanup.clear()
with patch.object(t.p,"auth",side_effect=fake_auth),\
     patch.object(t,"client_commit",return_value=200),\
     patch.object(t,"read_path",return_value=403):
    assert t.verify_p164() is False
    assert len(cleanup)==2
print("P164_REJECT_UNEXPECTED_WRITE_SUCCESS=PASS")
cleanup.clear()
with patch.object(t.p,"auth",side_effect=fake_auth),\
     patch.object(t,"client_commit",return_value=403),\
     patch.object(t,"read_path",return_value=404):
    assert t.verify_p164() is False
    assert len(cleanup)==2
print("P164_REJECT_UNMAPPED_READ_404=PASS")
cleanup.clear()
with patch.object(t.p,"auth",side_effect=fake_auth),\
     patch.object(t,"client_commit",return_value=0),\
     patch.object(t,"read_path",return_value=403):
    assert t.verify_p164() is False
    assert len(cleanup)==2
print("P164_REJECT_NETWORK_UNKNOWN=PASS")
print("P164_OFFLINE_FIXTURES=4/4_PASS")
