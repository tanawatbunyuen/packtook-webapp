#!/usr/bin/env python3
"""P110: redacted, static onCall options resolution for archived Staging source.

Supports top-level object spreads with last-write-wins and simple const
object literals. Unknown expressions fail closed. This does NOT prove
runtime App Check, authentication, or serving revision. Read-only.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import sys
import zipfile

HERE=Path(__file__).resolve()
spec=importlib.util.spec_from_file_location("p107",HERE.with_name("p107-staging-handler-drift-classify-readonly.py"))
p107=importlib.util.module_from_spec(spec);spec.loader.exec_module(p107)
p106=p107.p106
NAMES=p106.NAMES
MAX_SCAN=12000

def fragments(value,delimiter=","):
    """Split JS at top-level delimiter; unknown lexical cases return None."""
    if len(value)>MAX_SCAN:return None
    pieces=[];start=0;stack=[];quote=None;escaped=False;i=0
    while i<len(value):
        c=value[i]
        if quote:
            if escaped:escaped=False
            elif c=="\\":escaped=True
            elif c==quote:quote=None
        elif value.startswith("//",i):
            end=value.find("\n",i+2)
            if end<0:break
            i=end;continue
        elif value.startswith("/*",i):
            end=value.find("*/",i+2)
            if end<0:return None
            i=end+2;continue
        elif c in "'\"\x60":
            quote=c
        elif c in "{[(":
            stack.append(c)
        elif c in "}])":
            if not stack:return None
            last=stack.pop()
            if (last,c) not in (("{","}"),("[","]"),("(",")")):return None
        elif c==delimiter and not stack:
            pieces.append(value[start:i].strip());start=i+1
        i+=1
    if quote or stack:return None
    pieces.append(value[start:].strip())
    return pieces

def first_oncall_arg(handler,name):
    if handler is None:return None
    marker="exports."+name+"="
    compact=re.match(r"\s*"+re.escape(marker)+r"\s*onCall\s*\(",handler)
    if not compact:return None
    begin=compact.end()
    chars=handler[begin:begin+MAX_SCAN]
    stack=[];quote=None;escaped=False;i=0
    while i<len(chars):
        c=chars[i]
        if quote:
            if escaped:escaped=False
            elif c=="\\":escaped=True
            elif c==quote:quote=None
        elif chars.startswith("//",i):
            end=chars.find("\n",i+2)
            if end<0:return None
            i=end;continue
        elif chars.startswith("/*",i):
            end=chars.find("*/",i+2)
            if end<0:return None
            i=end+2;continue
        elif c in "'\"\x60":quote=c
        elif c in "{[(":stack.append(c)
        elif c in "}])":
            if not stack:return None
            left=stack.pop()
            if (left,c) not in (("{","}"),("[","]"),("(",")")):return None
        elif c=="," and not stack:
            return chars[:i].strip()
        i+=1
    return None

def shared_literal(src,name):
    if not re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*",name):return None
    pattern=rf"\b(?:const|let|var)\s+{re.escape(name)}\s*=\s*"
    matches=list(re.finditer(pattern,src))
    if len(matches)!=1:return None
    pos=matches[0].end()
    # Bounded top-level const initializer followed by semicolon.
    tail=src[pos:pos+MAX_SCAN]
    if not tail.startswith("{"):return None
    level=0;quote=None;esc=False
    for i,c in enumerate(tail):
        if quote:
            if esc:esc=False
            elif c=="\\":esc=True
            elif c==quote:quote=None
        elif c in "'\"\x60":quote=c
        elif c=="{":level+=1
        elif c=="}":
            level-=1
            if level==0:return tail[:i+1]
    return None

def resolve(src,expression,depth=0):
    if expression is None or depth>2:return ("UNRESOLVED",False)
    e=expression.strip()
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*",e):
        literal=shared_literal(src,e)
        return resolve(src,literal,depth+1) if literal else ("UNRESOLVED",False)
    if not (e.startswith("{") and e.endswith("}")):return ("UNRESOLVED",False)
    pieces=fragments(e[1:-1])
    if pieces is None:return ("UNRESOLVED",False)
    value="NOT_DECLARED";has_spread=False
    for part in pieces:
        if not part:continue
        if part.startswith("..."):
            has_spread=True
            state,_=resolve(src,part[3:].strip(),depth+1)
            if state!="NOT_DECLARED":value=state
        else:
            found=re.match(r"^(?:enforceAppCheck|['\"]enforceAppCheck['\"])\s*:\s*(.*)$",part,re.S)
            if found:
                token=found.group(1).strip()
                value="TRUE" if token=="true" else "FALSE" if token=="false" else "UNRESOLVED"
            elif ":" not in part and re.fullmatch(r"enforceAppCheck",part):
                value="UNRESOLVED"
            elif re.search(r"\b(enforceAppCheck|__proto__)\b",part):
                value="UNRESOLVED"
    return (value,has_spread)

def classification(src,fn):
    body=p106.exported_handler(src.encode("utf-8"),fn)
    if body is None:return {"status":"HANDLER_NOT_LOCATED","composite":"UNKNOWN","appCheck":"UNRESOLVED"}
    expr=first_oncall_arg(body,fn)
    if expr is None:return {"status":"ONCALL_OPTIONS_NOT_PARSED","composite":"UNKNOWN","appCheck":"UNRESOLVED"}
    state,spread=resolve(src,expr)
    return {"status":"OPTIONS_PARSED","composite":"HAS_SPREAD" if spread else "NO_SPREAD",
            "appCheck":{"TRUE":"STATIC_TRUE","FALSE":"STATIC_FALSE",
                       "NOT_DECLARED":"NO_STATIC_SETTING_FOUND"}.get(state,"UNRESOLVED")}

def inspect(reader=p106.call,progress=lambda s:None):
    progress("P110_STEP=PROJECT_GUARD")
    if reader(["gcloud","config","get-value","project"])!=p106.PROJECT:
        raise ValueError("P110_WRONG_PROJECT")
    rows=[]
    for i,fn in enumerate(NAMES,1):
        progress(f"P110_STEP=ARCHIVE_{i}_OF_2")
        archived=p107.read_archive(reader,fn,progress=lambda _:None)
        try:source=archived.decode("utf-8")
        except UnicodeDecodeError:raise ValueError("P110_INVALID_SOURCE_ENCODING") from None
        rows.append((fn,classification(source,fn)))
    return rows

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--inspect",action="store_true")
    args=ap.parse_args()
    if not args.inspect:
        print("P110_EXPLICIT_OPERATOR_OPT_IN_REQUIRED");return 2
    try:
        rows=inspect(progress=lambda x:print(x,flush=True))
        print("P110_PROJECT_GUARD=PASS_STAGING_ONLY")
        for name,record in rows:
            print("FUNCTION="+name)
            print("P110_OPTIONS_PARSE="+record["status"])
            print("P110_COMPOSITE_OPTIONS="+record["composite"])
            print("P110_STATIC_APP_CHECK_SETTING="+record["appCheck"])
        print("P110_STATIC_ANALYSIS_ONLY=YES")
        print("P110_EFFECTIVE_APP_CHECK=NOT_PROVEN")
        print("P110_RUNTIME_AUTH=NOT_PROVEN")
        print("P110_SERVING_REVISION_PARITY=NOT_VERIFIED")
        print("P110_CREDIT_FUNCTIONS=UNTOUCHED")
        print("P110_LEGACY_ACCOUNT_PARITY=NOT_EQUIVALENT")
        print("P110_DEPLOY=BLOCKED")
        return 0 if all(record["status"]=="OPTIONS_PARSED" for _,record in rows) else 2
    except (ValueError,OSError,TypeError,json.JSONDecodeError,zipfile.BadZipFile):
        print("P110_COMPOSITE_OPTIONS=NOT_VERIFIABLE")
        return 2
    finally:
        print("P110_CLOUD_WRITES=0")
        print("P110_IAM_CHANGES=0")
        print("P110_TRAFFIC_CHANGES=0")
        print("P110_RELEASE=NO_GO_RELEASE")
if __name__=="__main__":
    sys.exit(main())
