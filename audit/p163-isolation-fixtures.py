#!/usr/bin/env python3
"""Offline-only fixture. Verifies cross-account read matrix and fail-closed behavior."""
import importlib.util
import pathlib
from unittest.mock import patch

script = pathlib.Path(__file__).with_name("p163-source-rules-isolation.py")
spec = importlib.util.spec_from_file_location("p163", script)
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
assert p.git_blob(p.RULES.read_bytes()) == p.EXPECTED_RULES_GIT_BLOB
print("P163_EXACT_REVIEWED_RULES_BLOB=PASS")
accounts = {}
tokens = {}
seq = [0]
deleted = []

def auth(action, payload):
    if action == "signUp":
        seq[0] += 1
        uid = f"fixtureuid{seq[0]}"
        token = "fixture_token" + uid + "x"*40
        accounts[payload["email"]] = (payload["password"],uid,token)
        tokens[token] = uid
        return 200, {"localId":uid,"idToken":token}
    if action == "signInWithPassword":
        password, uid, token = accounts[payload["email"]]
        return (200,{"localId":uid,"idToken":token}) if password==payload["password"] else (400,{})
    if action == "delete":
        deleted.append(payload["idToken"])
        return (200,{}) if payload["idToken"] in tokens else (400,{})
    raise AssertionError("unhandled")

def firewall(uid,suffix,token):
    if not token: return 403
    if tokens[token] == uid: return 404
    return 403

with patch.object(p,"auth",side_effect=auth),patch.object(p,"doc_get",side_effect=firewall):
    assert p.verify() is True and len(deleted)==2
print("P163_OWN_404_OTHER_403_ANON_403_THREE_PATHS=PASS")

deleted.clear()
def leaky(uid,suffix,token):
    if not token:return 403
    return 404  # BUG: any signed-in user can read any account.
with patch.object(p,"auth",side_effect=auth),patch.object(p,"doc_get",side_effect=leaky):
    assert p.verify() is False and len(deleted)==2
print("P163_REJECT_CROSS_ACCOUNT_LEAK=PASS")

deleted.clear()
def deny_all(uid,suffix,token):
    return 403
with patch.object(p,"auth",side_effect=auth),patch.object(p,"doc_get",side_effect=deny_all):
    assert p.verify() is False and len(deleted)==2
print("P163_REJECT_DENY_ALL_WHEN_OWNER_READ_EXPECTED=PASS")
print("P163_OFFLINE_FIXTURES=4/4_PASS")
