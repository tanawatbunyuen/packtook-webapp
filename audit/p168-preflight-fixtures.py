#!/usr/bin/env python3
"""P168 source-integrity and generation fixtures, WITHOUT Firebase or npm."""
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("p168",Path(__file__).with_name("p168-callable-http.py"))
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
source=p.SOURCE.read_bytes()
parts=p.reviewed(source)
print("P168_PINNED_REVIEWED_SOURCE=PASS")
try:p.reviewed(source+b" ")
except ValueError:print("P168_DRIFT_FAIL_CLOSED=PASS")
else:raise AssertionError("source drift not blocked")
generated=p.generated_index(parts,Path("/tmp/p168-synthetic-test-trace"))
assert 'sdkRequire("firebase-functions/v2/https")' in generated
assert generated.count("exports.ownerAnalyticsSummary=onCall(")==1
assert generated.count("exports.ownerAnalyticsCustomers=onCall(")==1
assert "exports.omisePaymentWebhook" not in generated
assert "exports.ownerGrantVideoCredits" not in generated
print("P168_ONLY_TWO_EXISTING_OWNER_HANDLERS=PASS")
assert 'dbEvent();return q' in generated
assert 'async get(){dbEvent();return empty;}' in generated
assert 'const db={collection(){dbEvent();return q;}}' in generated
print("P168_INSTRUMENTED_EMPTY_DATABASE=PASS")
print("P168_OFFLINE_FIXTURES=4/4_PASS")
