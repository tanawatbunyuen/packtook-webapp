#!/usr/bin/env python3
import importlib.util,io,pathlib,tempfile,zipfile,unittest.mock as m
p=pathlib.Path(__file__).with_name("p158-verified-artifact-download.py")
spec=importlib.util.spec_from_file_location("p158",p)
obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj)
bio=io.BytesIO()
with zipfile.ZipFile(bio,"w") as z:
    z.writestr("test/Fake.class",b"sample")
data=bio.getvalue()
class Response:
    status=200
    headers={"Content-Length":str(len(data))}
    def __init__(self,body):self.body=io.BytesIO(body)
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,n):return self.body.read(n)
class Opener:
    def __init__(self,body):self.body=body
    def open(self,req,timeout):
        assert req.full_url==obj.URL
        assert timeout==15
        return Response(self.body)
with tempfile.TemporaryDirectory() as t:
    cache=pathlib.Path(t)
    result=obj.download_to(cache,Opener(data),expected_size=len(data))
    assert result=="VALIDATED_AND_INSTALLED",result
    assert obj.validate_jar(cache/obj.NAME,len(data))
    print("P158_VERIFIED_ATOMIC_INSTALL=PASS")
    assert obj.download_to(cache,Opener(data),len(data))=="ALREADY_VALID"
    print("P158_VALID_CACHE_REUSE=PASS")
    (cache/obj.NAME).unlink()
    assert obj.download_to(cache,Opener(data[:-1]),len(data))=="INCOMPLETE_DOWNLOAD"
    assert not (cache/obj.NAME).exists()
    assert not (cache/".p158-firestore-1.22.0.partial").exists()
    print("P158_INCOMPLETE_TRANSFER_FAIL_CLOSED=PASS")
    (cache/obj.NAME).symlink_to(cache/"nonexistent")
    assert obj.download_to(cache,Opener(data),len(data))=="TARGET_SYMLINK"
    print("P158_SYMLINK_FAIL_CLOSED=PASS")
    print("P158_OFFLINE_FIXTURES=4/4_PASS")
