#!/usr/bin/env python3
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("p165-backend-auth-audit.py")
spec=importlib.util.spec_from_file_location("p165",p)
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
js=t.SOURCE.read_text();rules=t.RULES.read_text()
status,findings=t.assessment(js,rules)
assert status=="P165_STATIC_ASSESSMENT_COMPLETED"
fids={f[0] for f in findings}
assert "ACCOUNT_ROLE_UNCONDITIONAL_ADMIN_RESPONSE" in fids
assert "ASSERT_ADMIN_EQUALITY_IS_NOT_PLATFORM_OWNER" in fids
assert "OWNER_CLAIM_GUARD_PRESENT" in fids
assert "PUBLIC_WEBHOOK_REQUIRES_SEPARATE_TEST" in fids
print("P165_EXPECTED_REVIEW_FINDINGS=PASS")
s,_=t.assessment(js+" ",rules)
assert s=="P165_BLOCK=BACKEND_SOURCE_DRIFT"
print("P165_REJECT_BACKEND_SOURCE_DRIFT=PASS")
s,_=t.assessment(js,rules+" ")
assert s=="P165_BLOCK=FIRESTORE_RULES_SOURCE_DRIFT"
print("P165_REJECT_RULES_SOURCE_DRIFT=PASS")
altered=js.replace("requirePlatformOwner(req);","/*guard intentionally removed for fixture*/",1)
s,found=t.assessment(altered,rules,strict_hash=False)
assert s=="P165_STATIC_ASSESSMENT_COMPLETED"
assert any(x[0].startswith("OWNER_CALLABLE_WITHOUT_VISIBLE_CLAIM_GUARD") for x in found)
print("P165_DETECT_MISSING_OWNER_CLAIM_GUARD=PASS")
print("P165_OFFLINE_FIXTURES=4/4_PASS")
