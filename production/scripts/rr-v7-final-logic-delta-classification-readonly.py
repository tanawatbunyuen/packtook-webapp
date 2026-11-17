#!/usr/bin/env python3
"""PACKTOOK V7 Final Logic Delta Classification: Staging-only, read-only.

Reports allowlisted difference *classes* for two non-return handler changes and
three high-impact shared-module differences. Performs no Cloud Functions calls.
No source lines, source paths, raw object identifiers, secrets or hashes output.

Lexical analysis is NOT semantic equivalence and does NOT establish App Check.
Classification leaves unresolved differences blocked for human code review.
"""
import argparse
import importlib.util
import pathlib
import re
import subprocess

ROOT=pathlib.Path(__file__).resolve().parent
def load(file,alias):
    spec=importlib.util.spec_from_file_location(alias,ROOT/file)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
att=load("rr-v7-deployed-source-attestation-readonly.py","v7final_att")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","v7final_sem")
scoped=load("rr-v7-scoped-handler-delta-readonly.py","v7final_scoped")
targeted=load("rr-v7-targeted-handler-logic-readonly.py","v7final_targeted")
HELPER_NAMES=("uid","ownerRef","ensureAccount","accountIdFor",
              "creditAvailable","walletEnabled","pendingReservations",
              "subscriptionState","purchaseDecision","barcodeKey",
              "validOp","validDevice")
PATTERNS={
 "AUTH_TENANCY":r"\b(?:uid|own|ownerRef|ensureAccount|accountIdFor|req\.auth|accounts|permission-denied|unauthenticated)\b",
 "CREDIT_ACCOUNTING":r"\b(?:creditAvailable|creditWalletRemaining|creditWalletV1|walletEnabled|pendingReservations|walletStartingCredits|reserved|used|remaining|subscriptionState|limits)\b",
 "FIRESTORE_READ_PATH":r"\b(?:db|firestore|collection|doc|get|snap|snapshot|ref|query|where|orderBy|limit)\b",
 "DATA_PREPARATION":r"\b(?:const|let|var|data|periodId|Date|Number|parse|String|trim)\b",
 "INPUT_VALIDATION":r"\b(?:validOp|validDevice|typeof|invalid-argument|failed-precondition)\b",
 "ERROR_CONTROL_FLOW":r"\b(?:throw|catch|try|return|if|else|await|Promise|HttpsError)\b",
 "APP_CHECK":r"\b(?:enforceAppCheck|appCheck)\b",
 "RESPONSE_SHAPE":r"\b(?:recordingId|barcode|status|file|plan|canBuyMore|purchaseReason|planExpiresAt)\b",
 "RECOVERY_CONTROL":r"\b(?:recoverStaleVideoReservation|confirmNoVideo|STALE_RESERVATION_MS|recoveryReason|barcodeLocks)\b",
}
# Do not claim a match from presence of only a keyword. All categories are
# changes needing human analysis, not tests that proved logic properties.
def classify_lines(lines):
    joined="\n".join(lines)
    return tuple(k for k,p in PATTERNS.items() if re.search(p,joined))

def handler_differences(local,remote,name):
    first=sem.handler(local,name)
    second=sem.handler(remote,name)
    blocks=scoped.changed(first,second)
    changed_lines=[line for a,b in blocks for line in a+b]
    categories=classify_lines(changed_lines)
    # Do not disclose arbitrary changed identifiers or source literals.
    if not blocks:
        label="EXACT"
    elif name in ("recordingStatus","usageStatus"):
        label="NON_RETURN_LOGIC_REVIEW" if any("return " not in line for line in changed_lines) else "RETURN_LINE_REVIEW"
    else:
        label="HANDLER_REVIEW_REQUIRED"
    return {"class":label,"blocks":len(blocks),"categories":categories}

def shared_differences(local,remote):
    a=scoped.masked_module(local)
    b=scoped.masked_module(remote)
    blocks=scoped.changed(a,b)
    changed_lines=[line for old,new in blocks for line in old+new]
    classes=classify_lines(changed_lines)
    helper_signal=tuple(name for name in HELPER_NAMES
                        if re.search(r"(?<![A-Za-z0-9_$])"+re.escape(name)+r"(?![A-Za-z0-9_$])","\n".join(changed_lines)))
    # Any difference outside selected handler bodies blocks stage advancement.
    return {"class":"EXACT" if not blocks else "DRIFT_REVIEW_REQUIRED",
            "blocks":len(blocks),
            "categories":classes,
            "allowlisted_helper_touched":helper_signal}

def report(local,remote,name):
    h=handler_differences(local,remote,name)
    s=shared_differences(local,remote)
    print("FUNCTION:",name)
    print("HANDLER_DELTA_CLASS:",h["class"])
    print("HANDLER_CHANGED_BLOCKS:",h["blocks"])
    print("HANDLER_LOGIC_CATEGORIES:",",".join(h["categories"]) or "NONE_IDENTIFIED")
    print("SHARED_DELTA_CLASS:",s["class"])
    print("SHARED_CHANGED_BLOCKS:",s["blocks"])
    print("SHARED_LOGIC_CATEGORIES:",",".join(s["categories"]) or "NONE_IDENTIFIED")
    print("ALLOWLISTED_HELPERS_IN_SHARED_CHANGES_COUNT:",len(s["allowlisted_helper_touched"]))
    # Reuse already-reviewed response-expression scanner, but never promote its
    # result to proof of runtime API contract or credit arithmetic.
    if name in targeted.TARGETS:
        try:
            value=targeted.inspect(local,remote,name)
            print("RESPONSE_EXPRESSION_SIGNAL:",value["response"])
            print("RESPONSE_EXPECTED_FIELD_EXPRESSION_CHANGES:",len(value["changed_fields"]))
        except (ValueError,UnicodeError):
            print("RESPONSE_EXPRESSION_SIGNAL: NOT_VERIFIABLE")
    print("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")
    print("FUNCTION_GATE: REVIEW_REQUIRED")

def run():
    parser=argparse.ArgumentParser()
    parser.add_argument("--inspect-source",action="store_true")
    args=parser.parse_args()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_FINAL_LOGIC_CLASSIFICATION: BLOCKED_EXPLICIT_SOURCE_FLAG")
            return 2
        local=(ROOT.parents[1]/"functions"/"index.js").read_bytes()
        count=0
        for name in att.NAMES:
            try:
                meta=att.function_metadata(name)
                pinned=att.pinned_source(meta)
                if pinned is None:raise ValueError("PINNED_SOURCE_REQUIRED")
                remote=att.handler_from_zip(att.bounded_archive(pinned))
                report(local,remote,name)
                count+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("FINAL_LOGIC_CLASSIFICATION: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(count)+"/5")
        print("V7_FINAL_LOGIC_CLASSIFICATION: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if count==len(att.NAMES) else 2
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_FINAL_LOGIC_CLASSIFICATION: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(run())
