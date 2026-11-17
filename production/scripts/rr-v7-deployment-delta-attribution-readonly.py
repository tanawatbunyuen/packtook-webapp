#!/usr/bin/env python3
"""PACKTOOK V7 Deployment Delta Attribution; read-only Staging source archive.

Attaches text changes to conservative top-level JS declarations. No JS parsing
or behavior proofs. Undecidable scope is explicitly UNATTRIBUTED. No deployed
source, arbitrary identifiers, paths, snippets, bucket IDs or secrets printed.
"""
import argparse
import difflib
import importlib.util
import pathlib
import re
import subprocess
from collections import Counter

ROOT=pathlib.Path(__file__).resolve().parent

def load(path,name):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

att=load("rr-v7-deployed-source-attestation-readonly.py","attributeatt")
sem=load("rr-v7-handler-semantic-attestation-readonly.py","attributesem")
target=load("rr-v7-targeted-handler-logic-readonly.py","attributetarget")

DECL=re.compile(r"^(?:(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|exports\.([A-Za-z_$][\w$]*)\s*=|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)")
SELECTED=set(att.NAMES)
# Do not print unknown symbol names: their value may contain sensitive details.
CRITICAL_HELPERS={"uid","ownerRef","ensureAccount","accountIdFor",
 "creditAvailable","walletEnabled","pendingReservations","subscriptionState",
 "purchaseDecision","barcodeKey","validOp","validDevice"}
DECL_KIND={"function":"FUNCTION","exports":"EXPORT","const":"TOP_LEVEL_BINDING"}

def regions(source):
    """Return top-level source regions; conservative column-0 declarations.

    The opening header is an independent region. Only plain declaration
    layouts are supported; nested text or unusual JS may be mis-attributed,
    so this is never a security clearance.
    """
    lines=source.decode("utf-8","strict").splitlines(keepends=True)
    positions=[]
    for idx,line in enumerate(lines):
        m=DECL.match(line)
        if m:
            groups=m.groups()
            kind=("function","exports","const")[next(i for i,x in enumerate(groups) if x is not None)]
            symbol=next(x for x in groups if x is not None)
            positions.append((idx,kind,symbol))
    if not positions:raise ValueError("NO_DECLARATIONS")
    chunks={}
    starts=[(0,"header","header")]+positions
    # If first declaration on first line, skip empty header.
    for i,(start,kind,symbol) in enumerate(starts):
        end=starts[i+1][0] if i+1<len(starts) else len(lines)
        if start==end:continue
        key=(kind,symbol)
        if key in chunks:raise ValueError("DUPLICATE_DECLARATION")
        chunks[key]="".join(lines[start:end])
    return chunks

def change_class(a,b):
    if a==b:return "EXACT"
    if a is None or b is None:return "DECLARATION_ADDED_OR_REMOVED"
    if "".join(a.split())=="".join(b.split()):
        # Formatting-only is heuristic: whitespace in JS strings is meaningful.
        return "WHITESPACE_ONLY_TEXT_NOT_SEMANTIC_PROOF"
    blocks=difflib.SequenceMatcher(a=a.splitlines(),b=b.splitlines(),autojunk=False).get_opcodes()
    modified=[line for tag,i,j,k,l in blocks if tag!="equal" for line in a.splitlines()[i:j]+b.splitlines()[k:l]]
    if modified and all(not line.strip() or line.lstrip().startswith("//") for line in modified):
        return "COMMENT_OR_BLANK_LINES_ONLY"
    return "EXECUTABLE_OR_UNRESOLVED_DRIFT"

def attribute(local,remote):
    a=regions(local);b=regions(remote)
    entries=[]
    for key in sorted(set(a)|set(b)):
        state=change_class(a.get(key),b.get(key))
        if state=="EXACT":continue
        kind,symbol=key
        scope=("SELECTED_HANDLER" if kind=="exports" and symbol in SELECTED
               else "CRITICAL_HELPER" if kind=="function" and symbol in CRITICAL_HELPERS
               else "OTHER_EXPORTED_FUNCTION" if kind=="exports"
               else "OTHER_TOP_LEVEL_FUNCTION" if kind=="function"
               else "TOP_LEVEL_BINDING" if kind=="const"
               else "MODULE_HEADER")
        entries.append((scope,state))
    return entries

def handler_details(local,remote,name):
    first=sem.handler(local,name)
    second=sem.handler(remote,name)
    if first==second:return "EXACT",0
    result=change_class(first,second)
    # The explicit handler extraction is stronger than diff guessing.
    if name in target.TARGETS:
        try:
            expression=target.selected_changes(first,second,name)[0]
        except ValueError:expression="NOT_VERIFIABLE"
    else:expression="NOT_APPLICABLE"
    return result,expression

def report(local,remote,name):
    details=attribute(local,remote)
    count=Counter(details)
    print("FUNCTION:",name)
    print("SELECTED_HANDLER_DELTA:",handler_details(local,remote,name)[0])
    if name in target.TARGETS:
        print("HANDLER_RESPONSE_EXPRESSION_SIGNAL:",handler_details(local,remote,name)[1])
    for scope in ("SELECTED_HANDLER","CRITICAL_HELPER","OTHER_EXPORTED_FUNCTION",
                  "OTHER_TOP_LEVEL_FUNCTION","TOP_LEVEL_BINDING","MODULE_HEADER"):
        n=sum(v for (s,c),v in count.items() if s==scope)
        print("DECLARATIONS_CHANGED_"+scope+":",n)
    print("DECLARATION_CHANGE_CLASSES:",
          ",".join(sorted(set(c for _,c in details))) or "NONE")
    print("UNATTRIBUTED_SCOPE_RISK: NOT_CLEARED")
    print("HANDLER_FUNCTIONAL_EQUIVALENCE: NOT_PROVEN")
    print("FUNCTION_GATE: REVIEW_REQUIRED")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--inspect-source",action="store_true")
    args=p.parse_args()
    try:
        att.guard()
        if not args.inspect_source:
            print("V7_DEPLOYMENT_DELTA_ATTRIBUTION: BLOCKED_EXPLICIT_SOURCE_FLAG")
            return 2
        local=(ROOT.parents[1]/"functions"/"index.js").read_bytes()
        count=0
        for name in att.NAMES:
            try:
                meta=att.function_metadata(name)
                pinned=att.pinned_source(meta)
                if pinned is None:raise ValueError("PINNED_SOURCE_REQUIRED")
                deployed=att.handler_from_zip(att.bounded_archive(pinned))
                report(local,deployed,name)
                count+=1
            except (ValueError,OSError,UnicodeError,subprocess.TimeoutExpired):
                print("FUNCTION:",name)
                print("DEPLOYMENT_DELTA_ATTRIBUTION: NOT_VERIFIABLE")
        print("SOURCE_ARCHIVES_INSPECTED:",str(count)+"/5")
        print("V7_DEPLOYMENT_DELTA_ATTRIBUTION: REVIEW_REQUIRED")
        print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_PROVEN")
        print("DEVICE_TEST_AUTHORIZED: NO")
        return 0 if count==len(att.NAMES) else 2
    except (ValueError,OSError,subprocess.TimeoutExpired):
        print("V7_DEPLOYMENT_DELTA_ATTRIBUTION: BLOCKED_ENVIRONMENT")
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("STAGING_CREDIT_WRITES: 0")
        print("PRODUCTION_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":raise SystemExit(main())
