#!/usr/bin/env python3
"""P126 offline mocks; no network, no cloud API."""
import contextlib,io,json,pathlib,runpy,subprocess
script=pathlib.Path(__file__).with_name("p126-build-source-artifact-existence.py")
real_run=subprocess.run
class Response:
    def __init__(self,obj=None,success=True):
        self.returncode=0 if success else 1
        self.stdout=json.dumps(obj) if obj is not None else ""
        self.stderr="" if success else "mock denied"
def run_scenario(denied=False):
    calls=[]
    def fake_run(args,**kwargs):
        calls.append(args)
        assert args[0]=="gcloud"
        assert not any("deploy" in x or "secrets" in x for x in args)
        if args[1:3]==["functions","describe"]:
            name=args[3]
            return Response({"name":"projects/packtook-staging/locations/asia-southeast1/functions/"+name,
                "buildConfig":{"source":{"storageSource":{"bucket":"staging-fixture-bucket","object":name+".zip"}}}})
        if args[1:4]==["storage","objects","describe"]:
            return Response({"size":"15200"},success=not denied)
        raise AssertionError("unauthorized subprocess")
    out=io.StringIO()
    subprocess.run=fake_run
    try:
        with contextlib.redirect_stdout(out):runpy.run_path(str(script),run_name="__main__")
    finally:subprocess.run=real_run
    assert len(calls)==12
    assert "gs://staging-fixture-bucket" not in out.getvalue()
    assert "P126_WRITES=0 P126_ARCHIVE_DOWNLOADS=0 P126_SECRET_READS=0" in out.getvalue()
    return out.getvalue()
s=run_scenario()
assert "P126_ACCESSIBLE=6 P126_INACCESSIBLE=0 P126_OTHER=0" in s
print("P126_MOCK_METADATA_ACCESSIBLE=PASS")
s=run_scenario(denied=True)
assert "P126_ACCESSIBLE=0 P126_INACCESSIBLE=6 P126_OTHER=0" in s
print("P126_MOCK_PERMISSION_DENIAL_FAILS_CLOSED=PASS")
print("P126_OFFLINE_FIXTURES=2/2_PASS")
