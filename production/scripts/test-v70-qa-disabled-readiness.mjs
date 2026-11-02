// PACKTOOK V7.0 — source-only safety regression for QA-disabled preparation.
// Does NOT invoke Firebase, network, environment files or deployments.
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./prepare-v70-qa-disabled.sh",import.meta.url),"utf8");
assert(source.includes('PROJECT="packtook-prod-01"'));
assert(source.includes('BRANCH="feature/v7.0-controlled-free-signup-qa"'));
assert(source.includes('node scripts/check-v70-qa-preflight.mjs "$PROJECT" --qa-off'));
assert(source.includes('firebase functions:list --project "$PROJECT"'));
assert(source.includes('node scripts/probe-free-deployment.mjs "$PROJECT" --expect-v66 --json'));
assert(source.includes("git -C \"$REPO\" diff --quiet"));
assert(source.includes("umask 077"));
assert(source.includes("STOP: no Production functions changed"));
assert(!/^[^#\n]*firebase deploy\b/m.test(source),"Readiness script must never invoke deploy");
assert(!/^[^#\n]*gcloud\s+(?:deploy|functions\s+deploy)\b/m.test(source));
assert(!/\b(?:PACKTOOK_V7_QA_ENABLED)=true\b/.test(source),"Must not turn QA ON");
assert(!/\b(?:PACKTOOK_PUBLIC_SIGNUP_ENABLED)=true\b/.test(source));
console.log("RESULT: PACKTOOK V7.0 QA-DISABLED READ-ONLY READINESS SAFETY PASS (source-only)");
