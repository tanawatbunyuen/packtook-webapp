#!/usr/bin/env python3
"""P231.161 — Offline rollback and release-evidence gate.
Never invokes Firebase, Cloud APIs, Auth, Functions or deployment.
No stored credential, file contents, version IDs, or key values are printed.
Optional external evidence file is never created by this script.
"""
import json,pathlib,re,sys
def out(k,v):print(f"P231_{k}={v}",flush=True)
out("CHECK","STAGING_HOSTING_ROLLBACK_EVIDENCE_GATE_OFFLINE")
manifest_path=pathlib.Path("audit/p231/isolated-test/p231161-rollback-evidence.json")
template_path=pathlib.Path("audit/p231/isolated-test/p231161-rollback-evidence.template.json")
try:
    cfg=json.loads(pathlib.Path("firebase.json").read_text("utf8"))
    if cfg.get("hosting",{}).get("public")!="firebase-staging":
        raise ValueError("unexpected hosting source")
    template=json.loads(template_path.read_text("utf8"))
    if template.get("schema_version")!=1:raise ValueError("unexpected schema version")
except Exception:
    out("GATE","BLOCKED_INVALID_REPOSITORY_CONFIGURATION")
    out("RELEASE","NO_GO")
    sys.exit(2)
out("STAGING_HOSTING_DIRECTORY","EXPECTED")
out("EVIDENCE_TEMPLATE","AVAILABLE")
if not manifest_path.is_file():
    out("OWNER_EVIDENCE_FILE","ABSENT")
    out("HOSTING_RELEASE_PIN","NOT_CAPTURED")
    out("ROLLBACK_EXECUTION_PLAN","NOT_VERIFIED")
    out("IMMUTABLE_CANDIDATE_MANIFEST","NOT_CAPTURED")
    out("RUNTIME_SMOKE","NOT_VERIFIED")
    out("APPROVAL","NOT_GRANTED")
    evidence=False
else:
    try:
        d=json.loads(manifest_path.read_text("utf8"))
        if set(d)!=set(template):raise ValueError("unknown evidence keys")
        if d.get("schema_version")!=1:raise ValueError("version mismatch")
        # Inspect presence, not content; owner-provided evidence must be separately verified.
        pin=bool(re.fullmatch(r"[^\s]{6,256}",str(d.get("previous_hosting_release_id",""))))
        candidate=bool(re.fullmatch(r"[a-f0-9]{64}",str(d.get("candidate_manifest_sha256",""))))
        rollback=(d.get("rollback_procedure_reviewed") is True)
        smoke=(d.get("candidate_runtime_smoke_passed") is True)
        approval=(d.get("staging_hosting_deploy_authorized") is True)
        scope=(d.get("requested_deploy_target")=="staging-hosting-only")
        out("OWNER_EVIDENCE_FILE","PRESENT_UNVERIFIED")
        out("HOSTING_RELEASE_PIN","PROVIDED_UNVERIFIED" if pin else "NOT_CAPTURED")
        out("ROLLBACK_EXECUTION_PLAN","CLAIMED_REVIEWED" if rollback else "NOT_VERIFIED")
        out("IMMUTABLE_CANDIDATE_MANIFEST","PROVIDED_UNVERIFIED" if candidate else "NOT_CAPTURED")
        out("RUNTIME_SMOKE","CLAIMED_PASS" if smoke else "NOT_VERIFIED")
        out("APPROVAL","CLAIMED" if approval else "NOT_GRANTED")
        out("DEPLOY_TARGET_SCOPE","HOSTING_ONLY" if scope else "BLOCKED")
        evidence=all((pin,candidate,rollback,smoke,approval,scope))
    except Exception:
        out("GATE","BLOCKED_MALFORMED_LOCAL_EVIDENCE")
        out("RELEASE","NO_GO")
        sys.exit(2)
out("EVIDENCE_CONTENT_INDEPENDENTLY_VERIFIED","NO")
out("RELEASE_GATE","BLOCKED_PENDING_INDEPENDENT_VALIDATION")
out("READINESS_EVIDENCE_COMPLETENESS","DECLARED_PRESENT_UNVERIFIED" if evidence else "INCOMPLETE")
out("CLOUD_REQUESTS","0")
out("FILE_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
sys.exit(3)
