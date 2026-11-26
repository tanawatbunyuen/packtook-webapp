#!/usr/bin/env python3
"""P231.119 — Classify argument passed to hosted Enterprise provider, read-only."""
import re,subprocess,sys
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
print("P231_CHECK=HOSTED_ENTERPRISE_PROVIDER_ARGUMENT_READONLY",flush=True)
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,url):
        raise ValueError("redirect blocked")
try:
    project=subprocess.check_output(["gcloud","config","get-value","project"],stderr=subprocess.DEVNULL,text=True,timeout=15).strip()
    if project!="packtook-staging":
        print("P231_GATE=BLOCKED_NOT_STAGING");sys.exit(2)
    with build_opener(NoRedirect).open(Request("https://packtook-staging.web.app/firebase-packing-bridge.js",method="GET"),timeout=20) as response:
        if response.status!=200 or "javascript" not in response.headers.get_content_type().lower(): raise ValueError("not JS")
        body=response.read(450001)
    if len(body)>450000:raise ValueError("too large")
    source=body.decode("utf-8")
except (OSError,ValueError,TimeoutError,UnicodeError,HTTPError,URLError,subprocess.SubprocessError):
    print("P231_HOSTED_BRIDGE=UNAVAILABLE");sys.exit(2)
found=list(re.finditer(r"\bnew\s+ReCaptchaEnterpriseProvider\s*\(",source))
print("P231_PROVIDER_CTOR_COUNT_CLASS="+("ZERO" if len(found)==0 else "ONE" if len(found)==1 else "MULTIPLE"))
if len(found)!=1:
    print("P231_PROVIDER_ARGUMENT_CLASS=NOT_CLASSIFIABLE");sys.exit(2)
arg=source[found[0].end():found[0].end()+2048].lstrip()
if not arg:
    category="EMPTY_OR_UNAVAILABLE"
elif arg[0] in (chr(34),chr(39),chr(96)):
    delimiter=arg[0];end=None;escaped=False
    for i,ch in enumerate(arg[1:],start=1):
        if escaped:escaped=False;continue
        if ord(ch)==92:escaped=True;continue
        if ch==delimiter:end=i;break
    if end is None:category="UNTERMINATED_OR_COMPLEX_LITERAL"
    else:
        inner=arg[1:end];after=arg[end+1:].lstrip()
        if not after.startswith(")"):category="COMPLEX_EXPRESSION"
        elif delimiter==chr(96) and "${" in inner:category="DYNAMIC_TEMPLATE_LITERAL"
        else:category="EMPTY_STRING_LITERAL" if not inner.strip() else "NONEMPTY_STRING_LITERAL"
elif re.match(r"^[A-Za-z_$][\w$]*\s*\)",arg):category="IDENTIFIER_ARGUMENT"
elif re.match(r"^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*\)",arg):category="PROPERTY_ACCESS_ARGUMENT"
else:category="COMPLEX_OR_UNRECOGNIZED_EXPRESSION"
print("P231_PROVIDER_ARGUMENT_CLASS="+category)
print("P231_SOURCE_VALUE=NOT_PRINTED")
print("P231_REGISTERED_KEY_EQUIVALENCE=NOT_VERIFIED")
print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
