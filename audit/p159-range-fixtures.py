#!/usr/bin/env python3
from pathlib import Path
import importlib.util,io,urllib.error
p=Path(__file__).with_name("p159-small-range-probe.py")
spec=importlib.util.spec_from_file_location("p159",p)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
data=b"A"*1048576
class Resp:
    def __init__(self,code=206,headers=None,body=data):
        self.status=code
        self.headers=headers if headers is not None else {"Content-Range":"bytes 0-1048575/136707194"}
        self.stream=io.BytesIO(body)
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,n):return self.stream.read(n)
class Opener:
    def __init__(self,response):self.response=response
    def open(self,request,timeout):
        assert request.get_method()=="GET"
        assert request.headers["Range"]=="bytes=0-1048575"
        assert timeout==12
        if isinstance(self.response,Exception):raise self.response
        return self.response
assert mod.probe(Opener(Resp()))==(206,1048576,"RANGE_GET_VALID")
print("P159_HTTP_206_EXACT_RANGE_VALID=PASS")
assert mod.probe(Opener(Resp(code=200)))==(200,0,"UNEXPECTED_STATUS_OR_CONTENT_RANGE")
print("P159_REJECTS_FULL_GET_FALLBACK=PASS")
assert mod.probe(Opener(Resp(body=b"A"*100)))==(206,100,"SHORT_OR_EXCESS_BODY")
print("P159_SHORT_BODY_DETECTED=PASS")
assert mod.probe(Opener(TimeoutError("private server path"))) == (0,0,"NETWORK_TIMEOUT")
print("P159_TIMEOUT_REDACTED=PASS")
print("P159_OFFLINE_FIXTURES=4/4_PASS")
