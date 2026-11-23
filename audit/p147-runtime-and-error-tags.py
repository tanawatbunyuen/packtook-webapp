#!/usr/bin/env python3
"""P147: offline, redacted CLI runtime / error-shape diagnostics. Never invokes CLI."""
import argparse, pathlib, re, subprocess, sys, shutil, json
from collections import Counter
TOKENS={
 "ERR_REQUIRE_ESM","ERR_MODULE_NOT_FOUND","MODULE_NOT_FOUND","ERR_INVALID_ARG_TYPE",
 "ERR_OSSL_EVP_UNSUPPORTED","ERR_UNKNOWN_FILE_EXTENSION","EPIPE","ENOENT",
 "ERR_PACKAGE_PATH_NOT_EXPORTED","TypeError","ReferenceError","SyntaxError",
 "DeprecationWarning","UnhandledPromiseRejection","fetch","Failed","Cannot",
 "Not","error","Error","Error:","firebase","firestore","emulator","auth",
 "download","downloading","Downloaded","Downloading","unsupported","Unsupported",
 "runtime","version","version:","node","npm","project","config","rules",
 "Unexpected","unexpected","undefined","certificate","permission","required",
 "home","initialize","starting","start","usage","available","access",
 "update","updates","check","checking","API","jar","Java","java","timeout"
}
def safe_log(log):
    if log.is_symlink() or not log.is_file() or log.stat().st_size>2_000_000:
        raise RuntimeError("LOG_UNSAFE_OR_MISSING")
    lines=log.read_text(encoding="utf8",errors="replace").splitlines()
    candidates=[]
    for n,line in enumerate(lines,1):
        if re.search(r"(?i)\berror\b|exception|failed|fatal",line):
            # Only literal tokens in a closed non-sensitive vocabulary, never input values.
            words=re.findall(r"[A-Za-z_]+(?::)?",line)
            tagged=[w.upper() for w in words if w in TOKENS or w.upper() in TOKENS]
            candidates.append((n,"_".join(tagged[:12]) or "NO_ALLOWLIST_TOKENS"))
    return lines,candidates
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--log", default=str(pathlib.Path.home()/".packtook-demo-emulator-home/p141-emulator.log"))
    args=p.parse_args()
    node=shutil.which("node")
    if not node: raise RuntimeError("NODE_NOT_FOUND")
    r=subprocess.run([node,"-p","process.versions.node"],capture_output=True,text=True,timeout=4,check=True)
    version=r.stdout.strip()
    if not re.fullmatch(r"\d{1,3}\.\d{1,3}\.\d{1,3}",version): raise RuntimeError("NODE_VERSION_UNEXPECTED")
    major=int(version.split(".")[0])
    lines,errors=safe_log(pathlib.Path(args.log))
    print("P147_MODE=LOCAL_NODE_VERSION_AND_PRIVATE_ERROR_TAGS_ONLY")
    print("P147_NODE_MAJOR="+str(major))
    print("P147_NODE_22_OR_24="+str(major in (22,24)).upper())
    print("P147_NODE_26_OR_HIGHER="+str(major>=26).upper())
    print("P147_LOG_LINES="+str(len(lines)))
    print("P147_ERROR_LINE_COUNT="+str(len(errors)))
    for n,tags in errors[:8]:
        print("P147_ERROR_LINE_"+str(n)+"_ALLOWLIST_TAGS="+tags)
    print("P147_DIAGNOSTIC="+("CHECK_NODE_RUNTIME_22_OR_24" if major>=26 else "NODE_RUNTIME_MAJOR_NOT_OBVIOUS_BLOCKER"))
    print("P147_ERROR_RAW_TEXT_PRINTED=NO P147_ERROR_USER_TOKENS_PRINTED=NO")
    print("P147_FIREBASE_CLI_RUNS=0 P147_EMULATOR_STARTS=0 P147_CLOUD_CALLS=0 P147_DEPLOYS=0")
    print("P147_DECISION=NO_GO_EMULATOR_NOT_ATTESTED")
if __name__=="__main__":
    try:main()
    except Exception as e:
        reason=str(e) if isinstance(e,RuntimeError) and str(e) in ("LOG_UNSAFE_OR_MISSING","NODE_NOT_FOUND","NODE_VERSION_UNEXPECTED") else "LOCAL_PROBE_FAILED"
        print("P147_BLOCK="+reason)
        sys.exit(1)
