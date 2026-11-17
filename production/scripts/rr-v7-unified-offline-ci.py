#!/usr/bin/env python3
"""Offline-only unified V7 CI test runner with machine-readable duration summary.

Imports each declared offline unittest file exactly once, runs suites together,
compiles paired script with doraise=True. Does not contact Staging.
Never dumps source or secret-bearing test content.
"""
import importlib.util
import pathlib
import py_compile
import sys
import time
import unittest

ROOT=pathlib.Path(__file__).resolve().parent
SCRIPTS=(
 "staging-hosting-parity",
 "hosting-blocker-diagnostic",
 "staging-hosting-drift-triage",
 "staging-semantic-drift",
 "targeted-hosting-diff",
 "staging-bridge-security-triage",
 "staging-backend-appcheck-inventory",
 "deployed-provenance-inventory",
 "staging-source-cohort",
 "build-provenance",
 "deployed-source-attestation",
 "handler-semantic-attestation",
 "scoped-handler-delta",
 "narrow-drift-triage",
 "helper-impact",
 "final-contract-review",
 "targeted-handler-logic",
 "final-logic-delta-classification",
 "deployment-delta-attribution",
 "delta-scope-reconciliation",
 "one-pass",
 "ast-delta-review",
 "performance-benchmark",
 "ast-statement-security",
)

def suite_and_compiled(names=SCRIPTS):
    suite=unittest.TestSuite()
    for index,name in enumerate(names):
        test=ROOT/("test-rr-v7-"+name+"-readonly.py")
        source=ROOT/("rr-v7-"+name+"-readonly.py")
        if not test.is_file() or not source.is_file():
            raise ValueError("MISSING_DECLARED_OFFLINE_TEST")
        py_compile.compile(str(source),doraise=True)
        py_compile.compile(str(test),doraise=True)
        spec=importlib.util.spec_from_file_location("v7_perf_suite_"+str(index),test)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        suite.addTests(unittest.defaultTestLoader.loadTestsFromModule(mod))
    return suite

def main():
    started=time.monotonic()
    try:
        suite=suite_and_compiled()
        r=unittest.TextTestRunner(verbosity=1).run(suite)
        print("V7_UNIFIED_OFFLINE_TESTS:",r.testsRun)
        print("V7_UNIFIED_OFFLINE_FAILURES:",len(r.failures))
        print("V7_UNIFIED_OFFLINE_ERRORS:",len(r.errors))
        print("V7_UNIFIED_WALL_MS:",round((time.monotonic()-started)*1000))
        print("STAGING_CALLS: 0")
        print("CLOUD_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")
        return 0 if r.wasSuccessful() else 1
    except (ValueError,OSError,ImportError,SyntaxError,py_compile.PyCompileError):
        print("V7_UNIFIED_OFFLINE: BLOCKED_TEST_LOADING")
        print("CLOUD_WRITES: 0")
        print("RELEASE: NO_GO_RELEASE")
        return 2
if __name__=="__main__":sys.exit(main())
