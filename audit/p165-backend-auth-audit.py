#!/usr/bin/env python3
"""P165 offline source-only Cloud Functions Auth/tenant-guard risk inventory.
No runtime import, credentials, network, Firebase emulator or deployments.
This is deliberately NOT a security PASS gate.
"""
import hashlib
from pathlib import Path
import re
import sys

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/"functions/index.js"
RULES=ROOT/"firestore.rules"
EXPECTED_JS_BLOB="92262ea2fbbb941188937d72f0eea74a735d2bf3"
EXPECTED_RULES_BLOB="d3e43720eb079c7f0fec50ec7f4e622fd7316e4a"

def gitblob(b):
    return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()

def handler_blocks(source):
    """Conservatively slice by top-level export starts; no JS execution."""
    hits=list(re.finditer(r"(?m)^exports\.([A-Za-z_]\w*)\s*=\s*on(Call|Request)\s*\(",source))
    return {h.group(1):source[h.start():hits[i+1].start() if i+1<len(hits) else len(source)]
            for i,h in enumerate(hits)}

def assessment(js,rules, strict_hash=True):
    if strict_hash:
        if gitblob(js.encode())!=EXPECTED_JS_BLOB:
            return "P165_BLOCK=BACKEND_SOURCE_DRIFT",[]
        if gitblob(rules.encode())!=EXPECTED_RULES_BLOB:
            return "P165_BLOCK=FIRESTORE_RULES_SOURCE_DRIFT",[]
    exports=handler_blocks(js)
    findings=[]
    def add(fid, trigger, severity, basis):
        if trigger:
            findings.append((fid,severity,basis))
    add("CLIENT_RULES_DO_NOT_BIND_ADMIN_SDK",
        "admin.firestore()" in js and "allow write: if false" in rules,
        "REVIEW_REQUIRED","Admin SDK bypasses client-side Firestore Rules; inspect backend paths")
    # Customer-role 'admin' is an account-level concept and must not be interpreted as platform owner.
    add("ACCOUNT_ROLE_UNCONDITIONAL_ADMIN_RESPONSE",
        bool(re.search(r'exports\.accountRole\s*=\s*onCall\b',js))
        and bool(re.search(r'const role\s*=\s*ref\.id===id\?"admin":"operator"',exports.get("accountRole","")))
        and 'return {role:"admin"' in exports.get("accountRole",""),
        "REVIEW_REQUIRED","accountRole computes variable role then always returns admin; multiUserEnabled=false")
    add("ASSERT_ADMIN_EQUALITY_IS_NOT_PLATFORM_OWNER",
        'async function assertAdmin(uidValue){const accountId=await accountIdFor(uidValue);if(accountId!==uidValue)' in js
        and 'async function accountIdFor(uidValue){return uidValue}' in js,
        "REVIEW_REQUIRED","assertAdmin compares UID to a helper that currently returns the same UID")
    add("DUPLICATE_APPROVAL_SELF_OWNER_MODEL",
        'exports.authorizeDuplicate=onCall' in js
        and 'Account currently has a single Firebase user' in exports.get("authorizeDuplicate",""),
        "MODEL_LIMITATION","Owner approval is account-self authorization, not independent employee/owner separation")
    owner_names=[n for n in exports if n.startswith("owner")]
    for name in owner_names:
        body=exports[name]
        guarded=bool(re.search(r'\brequirePlatformOwner\s*\(\s*req\s*\)',body))
        # Only a lexical check. Do not assume this proves ordering in execution paths.
        add("OWNER_CALLABLE_WITHOUT_VISIBLE_CLAIM_GUARD_"+name.upper(),
            not guarded,"BLOCKER","No visible requirePlatformOwner(req) in owner callable")
    add("OWNER_CLAIM_GUARD_PRESENT",
        bool(owner_names) and all("requirePlatformOwner(req)" in exports[n] for n in owner_names)
        and 'req.auth.token.packtookPlatformOwner!==true' in js
        and "const id=uid(req);" in js,
        "POSITIVE_STATIC","Visible platform-owner custom claim guard on tracked Owner analytics handlers; dynamic order untested")
    add("PUBLIC_WEBHOOK_REQUIRES_SEPARATE_TEST",
        'exports.omisePaymentWebhook=onRequest' in js
        and 'invoker:"public"' in exports.get("omisePaymentWebhook",""),
        "REVIEW_REQUIRED","Public webhook relies on signature/timestamp/provider charge reconciliation; needs isolated negative tests")
    add("ACCOUNT_CROSS_TENANT_ADMIN_QUERY",
        bool(re.search(r'db\.collection\("accounts"\)\.orderBy',js))
        and len(owner_names)>0,
        "REVIEW_REQUIRED","Global account collection queries require confirmed Owner claim and least-privilege service identity")
    return "P165_STATIC_ASSESSMENT_COMPLETED",findings

def main():
    print("P165_MODE=OFFLINE_REVIEW_ONLY")
    try:
        j=SOURCE.read_text(encoding="utf-8")
        r=RULES.read_text(encoding="utf-8")
    except OSError:
        print("P165_BLOCK=SOURCE_MISSING");return 1
    decision,findings=assessment(j,r)
    print(decision)
    if decision!="P165_STATIC_ASSESSMENT_COMPLETED":
        return 1
    for fid,sev,basis in findings:
        print(f"P165_FINDING_{fid}={sev}")
    blockers=sum(1 for x in findings if x[1]=="BLOCKER")
    review=sum(1 for x in findings if x[1] in ("REVIEW_REQUIRED","MODEL_LIMITATION"))
    print(f"P165_VISIBLE_OWNER_CALLABLE_COUNT={sum(x.startswith('exports.owner') for x in j.splitlines())}")
    print(f"P165_BLOCKER_COUNT={blockers} P165_REVIEW_ITEMS={review}")
    print("P165_SOURCE_EXECUTION=0 P165_FIREBASE_CALLS=0 P165_DEPLOYS=0")
    print("P165_DEPLOYED_CODE_OR_RULES_VERIFIED=FALSE")
    print("P165_OWNER_RECOVERED_SOURCE_REVIEWED=FALSE")
    print("P165_DECISION=NO_GO_BACKEND_AUTH_REVIEW_REQUIRED")
    return 0
if __name__=="__main__":
    sys.exit(main())
