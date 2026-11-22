#!/usr/bin/env python3
"""Offline positive/negative fixtures; no real Cloud calls."""
import hashlib,json,pathlib,subprocess,sys,tempfile
root=pathlib.Path(__file__).resolve().parent
script=root/"p124-compare-buildsource.py"
with tempfile.TemporaryDirectory() as td:
    d=pathlib.Path(td)
    def digest(value):
        return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
    sources={"recordingStatus":{"storageSource":{"bucket":"fixture","object":"recording"}},"usageStatus":{"storageSource":{"bucket":"fixture","object":"usage"}}}
    revisions={"recordingStatus":"recordingstatus-00020-gof","usageStatus":"usagestatus-00021-nob"}
    base={"project":"packtook-staging","region":"asia-southeast1","functions":{n:{"revision":revisions[n],"descriptor_sha256":digest(sources[n])} for n in sources}}
    baseline=d/"baseline.json";baseline.write_text(json.dumps(base))
    for n,source in sources.items():
        (d/(n+".json")).write_text(json.dumps({"name":f"projects/packtook-staging/locations/asia-southeast1/functions/{n}","buildConfig":{"source":source},"serviceConfig":{"revision":revisions[n]}}))
    def run():
        return subprocess.run([sys.executable,str(script),str(d),str(baseline)],capture_output=True,text=True)
    r=run()
    assert r.returncode==0,(r.stdout,r.stderr)
    assert "P124_MATCH=2/2" in r.stdout
    assert "P124_SOURCE_COMMIT_PARITY=UNVERIFIED" in r.stdout
    print("P124_MATCHING_METADATA_FIXTURE=PASS")
    p=d/"usageStatus.json";obj=json.loads(p.read_text());obj["serviceConfig"]["revision"]="changed";p.write_text(json.dumps(obj))
    r=run();assert r.returncode==1 and "P124_MATCH=1/2" in r.stdout
    print("P124_CHANGED_REVISION_BLOCK=PASS")
    obj["serviceConfig"]["revision"]=revisions["usageStatus"];obj["buildConfig"]["source"]={"storageSource":{"object":"changed"}};p.write_text(json.dumps(obj))
    r=run();assert r.returncode==1 and "P124_MATCH=1/2" in r.stdout
    print("P124_CHANGED_DESCRIPTOR_BLOCK=PASS")
    obj["buildConfig"]["source"]=sources["usageStatus"];obj["name"]="projects/packtook-prod-01/locations/asia-southeast1/functions/usageStatus";p.write_text(json.dumps(obj))
    r=run();assert r.returncode==1 and "WRONG_RESOURCE" in r.stdout
    print("P124_FOREIGN_PROJECT_BLOCK=PASS")
    print("P124_OFFLINE_FIXTURES=4/4_PASS")
