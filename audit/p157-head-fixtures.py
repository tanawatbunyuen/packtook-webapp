#!/usr/bin/env python3
import importlib.util,pathlib,unittest.mock as m
p=pathlib.Path(__file__).with_name("p157-official-artifact-head.py")
spec=importlib.util.spec_from_file_location("p157",p)
obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj)
class FakeResponse:
    status=200
    headers={"Content-Length":"138000000"}
    def __enter__(self):return self
    def __exit__(self,*args):return False
class FakeOpener:
    def open(self,request,timeout):
        assert request.get_method()=="HEAD"
        assert timeout==10
        assert request.full_url.startswith("https://storage.googleapis.com/")
        return FakeResponse()
with m.patch.object(obj.urllib.request,"build_opener",return_value=FakeOpener()):
    code,size,err=obj.check()
    assert (code,size,err)==(200,138000000,"NONE")
print("P157_HEAD_ONLY_ACCEPTED=PASS")
with m.patch.object(obj.urllib.request,"build_opener") as make:
    make.return_value.open.side_effect=TimeoutError("user secret should not print")
    code,size,err=obj.check()
    assert (code,err)==(0,"TIMEOUT")
print("P157_TIMEOUT_SANITIZED=PASS")
with m.patch.object(obj.urllib.request,"build_opener") as make:
    make.return_value.open.side_effect=obj.urllib.error.HTTPError(obj.URL,404,"unknown",None,None)
    code,size,err=obj.check()
    assert (code,err)==(404,"HTTP_ERROR")
print("P157_HTTP_ERROR_STATUS_ONLY=PASS")
print("P157_OFFLINE_FIXTURES=3/3_PASS")
