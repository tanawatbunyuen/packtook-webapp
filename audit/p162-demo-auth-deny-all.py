#!/usr/bin/env python3
"""P162 demo-only Auth email/password and Firestore deny-all read attestation.

Creates two uniquely named local Auth Emulator accounts and deletes both in finally.
Never writes to Firestore; never prints credentials, tokens, emails, response bodies.
No network calls except fixed localhost ports, no Firebase CLI/Owner Functions.
"""
import json
import pathlib
import secrets
import sys
import urllib.error
import urllib.request

PROJECT = "demo-packtook-owner-security"
HOST = "127.0.0.1"
HUB_PORT, AUTH_PORT, FIRESTORE_PORT = 14400, 19099, 18080
FAKE_KEY = "demo-only-key"
RULES = pathlib.Path(__file__).with_name("p140-firestore-deny-all.rules")
DENY_ALL = """rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}"""
READ_PATH = f"/v1/projects/{PROJECT}/databases/(default)/documents/p162_security_probe/nonexistent"


def request(port, path, *, payload=None, token=None):
    """Only fixed loopback endpoints. Return code and parsed JSON, never logs body."""
    if port not in (HUB_PORT, AUTH_PORT, FIRESTORE_PORT) or not path.startswith("/"):
        raise ValueError("not a local approved endpoint")
    url = f"http://{HOST}:{port}{path}"
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode() if payload is not None else None,
        headers=headers, method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            status, raw = resp.status, resp.read(65536)
    except urllib.error.HTTPError as error:
        status, raw = error.code, error.read(65536)
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, {}
    try:
        parsed = json.loads(raw) if raw else {}
        return status, parsed if isinstance(parsed, dict) else {}
    except (ValueError, UnicodeDecodeError):
        return status, {}


def registry_ready():
    code, obj = request(HUB_PORT, "/emulators")
    if code != 200 or not isinstance(obj, dict) or "functions" in obj:
        return False
    for name, port in (("hub", HUB_PORT), ("auth", AUTH_PORT), ("firestore", FIRESTORE_PORT)):
        item = obj.get(name)
        if not isinstance(item, dict):
            return False
        listeners = item.get("listen", [])
        if (item.get("host") != HOST or item.get("port") != port
                or not isinstance(listeners, list) or not listeners
                or any(not isinstance(x, dict) or x.get("address") != HOST
                       or x.get("family") != "IPv4" for x in listeners)):
            return False
    return True


def auth_call(action, payload):
    if action not in ("signUp", "signInWithPassword", "delete"):
        raise ValueError("unexpected auth action")
    return request(AUTH_PORT,
                   "/identitytoolkit.googleapis.com/v1/accounts:"
                   + action + "?key=" + FAKE_KEY, payload=payload)


def valid_auth_result(code, obj):
    return (code == 200 and isinstance(obj.get("localId"), str)
            and len(obj["localId"]) > 0 and isinstance(obj.get("idToken"), str)
            and len(obj["idToken"]) > 20)


def check():
    print("P162_MODE=DEMO_LOCAL_AUTH_AND_FIRESTORE_ONLY")
    if PROJECT != "demo-packtook-owner-security" or not registry_ready():
        print("P162_BLOCK=LOCAL_EMULATOR_REGISTRY_NOT_ATTESTED")
        return 1
    print("P162_DEMO_IPV4_REGISTRY=PASS")
    try:
        rules_match = RULES.read_text(encoding="utf-8").strip() == DENY_ALL.strip()
    except OSError:
        rules_match = False
    if not rules_match:
        print("P162_BLOCK=DENY_ALL_RULES_FIXTURE_MISMATCH")
        return 1
    unauth_code, _ = request(FIRESTORE_PORT, READ_PATH)
    print("P162_UNAUTHENTICATED_FIRESTORE_READ=" + ("PASS" if unauth_code == 403 else "FAIL"))
    if unauth_code != 403:
        print("P162_DECISION=NO_GO_BASELINE_DENIAL_MISSING")
        return 1
    created = []
    success = False
    cleanup_ok = True
    try:
        people = []
        for idx in range(2):
            # Random local-only example.invalid addresses; no production identities.
            email = "p162-" + secrets.token_hex(12) + "@example.invalid"
            password = secrets.token_urlsafe(24)
            status, account = auth_call("signUp", {
                "email": email, "password": password, "returnSecureToken": True})
            if valid_auth_result(status, account):
                created.append(account["idToken"])
            else:
                print(f"P162_ACCOUNT_{idx+1}_SIGNUP=FAIL")
                break
            print(f"P162_ACCOUNT_{idx+1}_SIGNUP=PASS")
            status, signed_in = auth_call("signInWithPassword", {
                "email": email, "password": password, "returnSecureToken": True})
            login_ok = valid_auth_result(status, signed_in) and signed_in["localId"] == account["localId"]
            print(f"P162_ACCOUNT_{idx+1}_PASSWORD_SIGNIN=" + ("PASS" if login_ok else "FAIL"))
            if not login_ok:
                break
            people.append(signed_in)
        if len(people) == 2:
            separate = people[0]["localId"] != people[1]["localId"]
            print("P162_TWO_DISTINCT_DEMO_IDENTITIES=" + ("PASS" if separate else "FAIL"))
            passes = separate
            for idx, account in enumerate(people):
                code, _ = request(FIRESTORE_PORT, READ_PATH, token=account["idToken"])
                denied = code == 403
                print(f"P162_ACCOUNT_{idx+1}_AUTHENTICATED_FIRESTORE_READ=" +
                      ("PASS" if denied else "FAIL"))
                passes = passes and denied
            success = passes
    finally:
        for token in reversed(created):
            code, _ = auth_call("delete", {"idToken": token})
            cleanup_ok = cleanup_ok and code == 200
        print("P162_DEMO_AUTH_ACCOUNT_CLEANUP=" + ("PASS" if cleanup_ok else "FAIL"))
        print("P162_FIRESTORE_WRITES=0 P162_OWNER_IMPORTS=0 P162_DEPLOYS=0")
        print("P162_CROSS_ACCOUNT_PRODUCTION_RULES_TESTED=FALSE")
        print("P162_DECISION=" +
              ("LOCAL_AUTH_AND_DENY_ALL_READ_ATTESTED" if success and cleanup_ok
               else "NO_GO_AUTH_OR_RULES_ATTESTATION_INCOMPLETE"))
    return 0 if success and cleanup_ok else 1


if __name__ == "__main__":
    try:
        sys.exit(check())
    except Exception:
        print("P162_BLOCK=LOCAL_TEST_ERROR")
        print("P162_DECISION=NO_GO_AUTH_OR_RULES_ATTESTATION_INCOMPLETE")
        sys.exit(1)
