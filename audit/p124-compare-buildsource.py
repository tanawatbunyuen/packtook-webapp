#!/usr/bin/env python3
"""P124 read-only metadata comparison; never reads source archives or secrets."""
import json,hashlib,pathlib,sys
if len(sys.argv)!=3:
    print("P124_USAGE: python3 audit/p124-compare-buildsource.py <describe-json-dir> <baseline-json>")
    raise SystemExit(2)
root=pathlib.Path(sys.argv[1]); base=json.loads(pathlib.Path(sys.argv[2]).read_text())
if base.get("project")!="packtook-staging" or base.get("region")!="asia-southeast1":
    raise SystemExit("P124_BLOCK_PROJECT_SCOPE")
expected={"recordingStatus","usageStatus"}
if set(base.get("functions",{}))!=expected: raise SystemExit("P124_BLOCK_BASELINE_SCOPE")
matched=0
for name in sorted(expected):
    fn=json.loads((root/(name+".json")).read_text())
    full=f"projects/packtook-staging/locations/asia-southeast1/functions/{name}"
    if fn.get("name")!=full:
        print(f"P124_FUNCTION={name} RESULT=WRONG_RESOURCE")
        continue
    build=fn.get("buildConfig") or {}
    descriptor=build.get("source")
    rev=(fn.get("serviceConfig") or {}).get("revision") or (fn.get("serviceConfig") or {}).get("revisionName") or "UNSET"
    digest=hashlib.sha256(json.dumps(descriptor,sort_keys=True).encode()).hexdigest() if descriptor else "UNAVAILABLE"
    expected_item=base["functions"][name]
    ok=rev==expected_item["revision"] and digest==expected_item["descriptor_sha256"]
    print(f"P124_FUNCTION={name} REVISION_MATCH={str(rev==expected_item['revision']).upper()} DESCRIPTOR_MATCH={str(digest==expected_item['descriptor_sha256']).upper()} RESULT={'BASELINE_MATCH' if ok else 'DRIFT_OR_UNVERIFIED'}")
    matched+=int(ok)
print(f"P124_MATCH={matched}/2")
print("P124_SOURCE_COMMIT_PARITY=UNVERIFIED")
print("P124_DECISION=NO_GO_DEPLOY_PROVENANCE_NOT_ATTESTED")
print("P124_WRITES=0 P124_SECRET_READS=0 P124_DEPLOYS=0")
if matched!=2:raise SystemExit(1)
