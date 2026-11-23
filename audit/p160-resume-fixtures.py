#!/usr/bin/env python3
import importlib.util
import io
import pathlib
import tempfile
import zipfile

p=pathlib.Path(__file__).with_name("p160-resumable-firestore.py")
spec=importlib.util.spec_from_file_location("p160",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
b=io.BytesIO()
with zipfile.ZipFile(b,"w",compression=zipfile.ZIP_STORED) as z:
    z.writestr("test/Test.class",b"payload"*300)
raw=b.getvalue()
chunk=256

class Response:
    status=206
    def __init__(self,start,end,body):
        self.headers={"Content-Range":f"bytes {start}-{end}/{len(raw)}","Content-Length":str(end-start+1)}
        self._body=io.BytesIO(body)
    def __enter__(self):return self
    def __exit__(self,*a):return False
    def read(self,n):return self._body.read(n)
class Opener:
    def __init__(self,fail_after=None):
        self.calls=0
        self.fail_after=fail_after
    def open(self,req,timeout):
        self.calls+=1
        rng=req.headers["Range"].removeprefix("bytes=")
        start,end=(int(x) for x in rng.split("-"))
        assert timeout==12
        if self.fail_after is not None and start>=self.fail_after:
            raise TimeoutError("private URL never printed")
        return Response(start,end,raw[start:end+1])
with tempfile.TemporaryDirectory() as t:
    folder=pathlib.Path(t)
    first=Opener(fail_after=chunk*2)
    status,bytes_saved=m.download(folder,first,total=len(raw),chunk=chunk,deadline=200)
    assert status=="NETWORK_OR_IO_FAILURE_RESUMABLE",(status,bytes_saved)
    assert bytes_saved==chunk*2
    partial=folder/".p160-firestore-v1.22.0.part"
    assert partial.stat().st_size==bytes_saved
    print("P160_INTERRUPTED_TRANSFER_PRESERVES_PREFIX=PASS")
    rest=Opener()
    status,bytes_saved=m.download(folder,rest,total=len(raw),chunk=chunk,deadline=200)
    assert status=="VERIFIED_AND_INSTALLED",(status,bytes_saved)
    assert m.valid_jar(folder/m.NAME,len(raw))
    assert rest.calls==(len(raw)-chunk*2+chunk-1)//chunk
    assert not partial.exists()
    print("P160_RESUME_EXACT_CHUNK_AND_CRC_INSTALL=PASS")
    again=Opener()
    status,_=m.download(folder,again,total=len(raw),chunk=chunk)
    assert status=="EXISTING_VALID" and again.calls==0
    print("P160_VALID_TARGET_NO_NETWORK=PASS")
    (folder/m.NAME).unlink()
    partial.write_bytes(b"x"*7)
    status,_=m.download(folder,Opener(),total=len(raw),chunk=chunk)
    assert status=="PARTIAL_BOUNDARY_INVALID_NO_OVERWRITE"
    assert partial.read_bytes()==b"x"*7
    print("P160_PARTIAL_BOUNDARY_FAIL_CLOSED=PASS")
    partial.unlink()
    partial.symlink_to(folder/"bad-target")
    status,_=m.download(folder,Opener(),total=len(raw),chunk=chunk)
    assert status=="SYMLINK_BLOCKED"
    print("P160_SYMLINK_FAIL_CLOSED=PASS")
    print("P160_OFFLINE_FIXTURES=5/5_PASS")
