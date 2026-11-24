#!/usr/bin/env python3
"""Offline synthetic tests: no real network and no accounts created."""
import importlib.util
import pathlib
import unittest.mock as mock

path = pathlib.Path(__file__).with_name("p162-demo-auth-deny-all.py")
spec = importlib.util.spec_from_file_location("p162_module", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

identity_counter = [0]
accounts = {}
tokens = {}
cleanup = []

def fake_request(port, path, *, payload=None, token=None):
    if port == module.HUB_PORT:
        return 200, {name: {
            "host": module.HOST, "port": portnum,
            "listen": [{"address": module.HOST, "family": "IPv4", "port": portnum}]}
            for name, portnum in (("hub", module.HUB_PORT), ("auth", module.AUTH_PORT),
                                  ("firestore", module.FIRESTORE_PORT))}
    if port == module.FIRESTORE_PORT:
        return 403, {}
    if port == module.AUTH_PORT:
        if ":signUp?" in path:
            identity_counter[0] += 1
            uid = str(identity_counter[0])
            newtoken = "demo-token-" + uid + ("x" * 30)
            accounts[payload["email"]] = (payload["password"], uid, newtoken)
            tokens[newtoken] = uid
            return 200, {"localId": uid, "idToken": newtoken}
        if ":signInWithPassword?" in path:
            password, uid, newtoken = accounts[payload["email"]]
            return (200, {"localId": uid, "idToken": newtoken}) if password == payload["password"] else (400, {})
        if ":delete?" in path:
            cleanup.append(payload["idToken"])
            return (200, {}) if payload["idToken"] in tokens else (400, {})
    raise AssertionError("unexpected request")

with mock.patch.object(module, "request", side_effect=fake_request):
    assert module.check() == 0
    assert len(cleanup) == 2
print("P162_TWO_LOCAL_IDENTITIES_SIGNIN_DENIED_READ_CLEANUP=PASS")

with mock.patch.object(module, "request", side_effect=lambda *a, **kw: (0, {})):
    assert module.check() == 1
print("P162_REJECT_UNREACHABLE_HUB=PASS")

with mock.patch.object(module, "request", side_effect=lambda port, path, **kw:
    (404, {}) if port == module.FIRESTORE_PORT else fake_request(port, path, **kw)):
    assert module.check() == 1
print("P162_REJECT_BASELINE_NO_403=PASS")

def allow_auth_read(port, path, **kw):
    if port == module.FIRESTORE_PORT:
        return 200 if kw.get("token") else 403, {}
    return fake_request(port, path, **kw)
with mock.patch.object(module, "request", side_effect=allow_auth_read):
    assert module.check() == 1
print("P162_REJECT_AUTHORIZED_READ_ON_DENY_ALL=PASS")
print("P162_OFFLINE_FIXTURES=4/4_PASS")
