#!/usr/bin/env python3
"""Offline synthetic fixtures for P81 gate. No cloud access or deployment."""
import importlib.util
from pathlib import Path
s = Path(__file__).with_name('p81-offline-source-audit.py')
spec = importlib.util.spec_from_file_location('p81',s)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
base = """const options={region,maxInstances:5,timeoutSeconds:30};
function guardedCall(o,handler){return onCall(o,async req=>{
 if(isPilotToken(req)){await requirePilotLease(req,{claimRequired:true});}
 return handler(req);
});}
exports.recordingStatus=guardedCall(options,async req=>{});
exports.usageStatus=guardedCall(options,async req=>{});
"""
r=m.audit(base)
assert r['wrapper'] and r['pilot_lease'] and all(r['calls'].values())
assert not r['appcheck_in_shared_options']
assert not m.audit(base.replace('guardedCall(options,async req=>{});','onCall(options,async req=>{});'))['calls']['usageStatus']
assert not m.audit(base.replace('requirePilotLease(req,{claimRequired:true})','requirePilotLease(req,{claimRequired:false})'))['pilot_lease']
assert not m.audit(base.replace('function guardedCall(o,handler)','function notGuarded(o,handler)'))['wrapper']
assert m.audit(base.replace('timeoutSeconds:30','timeoutSeconds:30,enforceAppCheck:true'))['appcheck_in_shared_options']
print('P81_OFFLINE_FIXTURE_MATRIX=5/5 PASS')
