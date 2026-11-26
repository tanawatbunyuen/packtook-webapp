#!/usr/bin/env python3
"""P231.173 browser-runner readiness only. No browser launch or network requests.
Never inspects tokens, account, profile, or browser storage.
"""
import json,pathlib,shutil,subprocess,sys,re
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
emit("CHECK","CANDIDATE_BROWSER_RUNTIME_PREREQUISITE_GATE_OFFLINE")
root=pathlib.Path("firebase-staging")
try:
 cfg=json.loads(pathlib.Path("firebase.json").read_text("utf8"))
 if cfg.get("hosting",{}).get("public")!="firebase-staging":raise ValueError("wrong hosting dir")
 bridge=(root/"firebase-packing-bridge.js").read_text("utf8")
 config=(root/"firebase-v4-config.js").read_text("utf8")
 index=(root/"index.html").read_text("utf8")
 sitekey_empty=bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config))
 if not sitekey_empty:raise ValueError("unexpected local site-key export")
 if not all(x in bridge for x in ['protectedApi("usageStatus")','protectedApi("recordingStatus")','initializeAppCheck(app,']):
  raise ValueError("source guard missing")
except Exception:
 emit("GATE","BLOCKED_REPOSITORY_SOURCE_PRECONDITION")
 emit("RELEASE","NO_GO")
 sys.exit(2)
browsers=("chromium","chromium-browser","google-chrome","google-chrome-stable")
binary=next((name for name in browsers if shutil.which(name)),None)
node=shutil.which("node")
npm=shutil.which("npm")
playwright=False
if node:
 try:
  p=subprocess.run(["node","-e","try{require.resolve('playwright');process.exit(0)}catch(e){process.exit(1)}"],
                   capture_output=True,timeout=10)
  playwright=p.returncode==0
 except Exception:pass
emit("HOSTING_PUBLIC_DIRECTORY","EXPECTED_STAGING")
emit("GUARDED_STATUS_SOURCE","PRESENT")
emit("PUBLIC_SITE_KEY_IN_REPO","EMPTY_EXPECTED")
emit("CHROMIUM_EXECUTABLE_FOUND","YES" if binary else "NO")
emit("NODE_AVAILABLE","YES" if node else "NO")
emit("NPM_AVAILABLE","YES" if npm else "NO")
emit("PLAYWRIGHT_PACKAGE_RESOLVES","YES" if playwright else "NO")
emit("BROWSER_LAUNCHED","NO")
emit("REAL_BROWSER_RUNTIME_TEST","NOT_PERFORMED")
emit("CANDIDATE_ON_REGISTERED_STAGING_ORIGIN","NOT_AVAILABLE")
emit("RECAPTCHA_ENTERPRISE_TOKEN","NOT_REQUESTED")
emit("MOCKED_BROWSER_TEST","NOT_PERFORMED")
emit("PERSISTENT_CANDIDATE_ARTIFACT","NOT_CREATED")
emit("FIREBASE_CLI_PACKAGING_PARITY","NOT_VERIFIED")
emit("READINESS_DECISION","BLOCKED_BROWSER_ORIGIN_AND_ARTIFACT" if binary or playwright else "BLOCKED_BROWSER_RUNNER_ORIGIN_AND_ARTIFACT")
emit("NETWORK_REQUESTS","0")
emit("CLOUD_WRITES","0")
emit("SOURCE_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(0)
