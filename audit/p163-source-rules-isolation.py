#!/usr/bin/env python3
"""P163 isolated local real-repository Firestore Rules account-isolation checks.

Only GETs for Firestore; creates/deletes disposable LOCAL Auth Emulator users.
Starts separate demo Auth/Firestore emulators, does not touch P141 ports or cloud.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
RULES = ROOT / "firestore.rules"
CONFIG = ROOT / "audit/p163-source-rules-emulator.json"
PROJECT = "demo-packtook-owner-security-p163"
HOST = "127.0.0.1"
PORTS = {"hub": 14500, "firestore": 18180, "auth": 19199}
LOGGING_PORT = 14510
WEBSOCKET_PORT = 9151
# Lock exact reviewed GitHub blob sha1 (git hash-object format) to prevent source drift.
EXPECTED_RULES_GIT_BLOB = "d3e43720eb079c7f0fec50ec7f4e622fd7316e4a"


def http(port, path, payload=None, token=None):
    if port not in PORTS.values() or not path.startswith("/"):
        raise ValueError("disallowed local destination")
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(
        f"http://{HOST}:{port}{path}",
        headers=headers,
        data=json.dumps(payload).encode() if payload is not None else None,
        method="POST" if payload is not None else "GET")
    try:
        with urllib.request.urlopen(request, timeout=4) as r:
            status, raw = r.status, r.read(65536)
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read(65536)
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0, {}
    try:
        data = json.loads(raw) if raw else {}
    except (ValueError, UnicodeDecodeError):
        data = {}
    return status, data if isinstance(data, dict) else {}


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def registry_ready():
    code, data = http(PORTS["hub"], "/emulators")
    if code != 200 or "functions" in data:
        return False
    for name, port in PORTS.items():
        item = data.get(name)
        if not isinstance(item, dict):
            return False
        listen = item.get("listen", [])
        if (item.get("host") != HOST or item.get("port") != port
                or not isinstance(listen, list) or not listen
                or any(not isinstance(x, dict) or x.get("address") != HOST
                       or x.get("family") != "IPv4" for x in listen)):
            return False
    return True


def auth(action, data):
    if action not in ("signUp", "signInWithPassword", "delete"):
        raise ValueError("unapproved action")
    return http(PORTS["auth"],
        "/identitytoolkit.googleapis.com/v1/accounts:" + action + "?key=p163-demo-only",
        payload=data)


def token_valid(code, data):
    return (code == 200 and isinstance(data.get("localId"), str)
            and bool(data["localId"]) and isinstance(data.get("idToken"), str)
            and len(data["idToken"]) > 20)


def doc_get(uid, subpath="", token=None):
    path = f"/v1/projects/{PROJECT}/databases/(default)/documents/accounts/{uid}"
    if subpath:
        path += "/" + subpath
    return http(PORTS["firestore"], path, token=token)[0]


def verify():
    created = []
    ok = False
    cleanup_ok = True
    try:
        users = []
        for i in range(2):
            email = "p163-" + secrets.token_hex(12) + "@example.invalid"
            password = secrets.token_urlsafe(24)
            code, signup = auth("signUp", {
                "email": email, "password": password, "returnSecureToken": True})
            valid = token_valid(code, signup)
            print(f"P163_USER_{i+1}_SIGNUP=" + ("PASS" if valid else "FAIL"))
            if not valid:
                break
            created.append(signup["idToken"])
            code, login = auth("signInWithPassword", {
                "email": email, "password": password, "returnSecureToken": True})
            valid = token_valid(code, login) and login["localId"] == signup["localId"]
            print(f"P163_USER_{i+1}_LOGIN=" + ("PASS" if valid else "FAIL"))
            if not valid:
                break
            users.append(login)
        if len(users) == 2:
            distinct = users[0]["localId"] != users[1]["localId"]
            print("P163_DISTINCT_UIDS=" + ("PASS" if distinct else "FAIL"))
            ok = distinct
            paths = ("", "recordings/nonexistent", "audit/nonexistent")
            for i, actor in enumerate(users):
                own_uid = actor["localId"]
                other_uid = users[1-i]["localId"]
                for label, target, bearer, allowed in (
                    ("OWN", own_uid, actor["idToken"], {404}),
                    ("OTHER", other_uid, actor["idToken"], {403}),
                    ("ANONYMOUS", own_uid, None, {403}),
                ):
                    for j, suffix in enumerate(paths):
                        code = doc_get(target, suffix, token=bearer)
                        # All documents are absent: own GET must be 404. No data written.
                        valid = code in allowed
                        print(f"P163_USER_{i+1}_{label}_PATH_{j+1}=" +
                              ("PASS" if valid else "FAIL"))
                        ok = ok and valid
    finally:
        for token in reversed(created):
            code, _ = auth("delete", {"idToken": token})
            cleanup_ok = cleanup_ok and code == 200
        print("P163_DISPOSABLE_AUTH_CLEANUP=" + ("PASS" if cleanup_ok else "FAIL"))
        print("P163_FIRESTORE_WRITES=0 P163_OWNER_IMPORTS=0 P163_DEPLOYS=0")
        print("P163_DEPLOYED_PRODUCTION_RULES_ATTESTED=FALSE")
        print("P163_DECISION=" + ("SOURCE_RULES_ACCOUNT_ISOLATION_ATTESTED"
                                 if ok and cleanup_ok else "NO_GO_ISOLATION_INCOMPLETE"))
    return ok and cleanup_ok


def main():
    print("P163_MODE=ISOLATED_LOCAL_SOURCE_RULES")
    try:
        data = RULES.read_bytes()
    except OSError:
        print("P163_BLOCK=SOURCE_RULES_MISSING")
        return 1
    if git_blob(data) != EXPECTED_RULES_GIT_BLOB:
        print("P163_BLOCK=SOURCE_RULES_GIT_BLOB_CHANGED")
        return 1
    print("P163_SOURCE_RULES_GIT_BLOB_MATCH=PASS")
    try:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
        config_ok = (cfg["firestore"]["rules"] == "../firestore.rules"
                     and set(cfg["emulators"]) == {"auth","firestore","hub","logging","ui"}
                     and cfg["emulators"]["ui"]["enabled"] is False
                     and all(cfg["emulators"][n]["port"] == port
                             and cfg["emulators"][n]["host"] == HOST
                             for n,port in PORTS.items())
                     and cfg["emulators"]["logging"]["port"] == LOGGING_PORT
                     and cfg["emulators"]["logging"]["host"] == HOST
                     and cfg["emulators"]["firestore"]["websocketPort"] == WEBSOCKET_PORT)
    except (OSError, KeyError, ValueError, TypeError):
        config_ok = False
    if not config_ok:
        print("P163_BLOCK=ISOLATED_CONFIG_CHANGED")
        return 1
    for port in (*PORTS.values(), LOGGING_PORT, WEBSOCKET_PORT):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex((HOST, port)) == 0:
                print("P163_BLOCK=ISOLATED_PORT_IN_USE_" + str(port))
                return 1
    firebase = shutil.which("firebase")
    if not firebase or not shutil.which("java") or not shutil.which("node"):
        print("P163_BLOCK=REQUIRED_LOCAL_CLI_MISSING")
        return 1
    private_home = Path.home() / ".packtook-demo-emulator-home"
    if private_home.is_symlink() or not private_home.is_dir():
        print("P163_BLOCK=PRIVATE_EMULATOR_CACHE_MISSING")
        return 1
    log_path = private_home / "p163-isolated-emulator.log"
    old_umask = os.umask(0o077)
    try:
        log = log_path.open("w", encoding="utf-8")
    finally:
        os.umask(old_umask)
    env = {
        "HOME": str(private_home),
        "PATH": os.environ.get("PATH","/usr/local/bin:/usr/bin:/bin"),
        "NODE_ENV": "test", "CI": "true", "FIREBASE_SKIP_UPDATE_CHECK": "1",
        "GCLOUD_PROJECT": PROJECT, "GOOGLE_CLOUD_PROJECT": PROJECT,
        "FIREBASE_PROJECT_ID": PROJECT,
        "FIRESTORE_EMULATOR_HOST": f"{HOST}:{PORTS['firestore']}",
        "FIREBASE_AUTH_EMULATOR_HOST": f"{HOST}:{PORTS['auth']}",
    }
    try:
        proc = subprocess.Popen(
            [firebase,"emulators:start","--project",PROJECT,
             "--only","firestore,auth","--config",str(CONFIG),"--non-interactive"],
            env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    except OSError:
        log.close()
        print("P163_BLOCK=LOCAL_CLI_COULD_NOT_START")
        return 1
    log.close()
    result = 1
    try:
        ready = False
        for _ in range(60):
            if proc.poll() is not None:
                break
            if registry_ready():
                ready = True
                break
            time.sleep(2)
        print("P163_ISOLATED_REGISTRY=" + ("PASS" if ready else "FAIL"))
        if ready:
            result = 0 if verify() else 1
        else:
            print("P163_BLOCK=ISOLATED_EMULATOR_NOT_READY")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=12)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        print("P163_EMULATOR_PROCESS_STOPPED=TRUE")
        print("P163_PRIVATE_LOCAL_LOG_ONLY=TRUE")
    return result


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print("P163_BLOCK=LOCAL_RUN_EXCEPTION")
        print("P163_DECISION=NO_GO_ISOLATION_INCOMPLETE")
        sys.exit(1)
