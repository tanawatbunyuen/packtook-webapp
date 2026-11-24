# P162 — Local Auth credential flow and Firestore deny-all read

P161 real Cloud Shell output: Hub, Firestore, Auth registry PASS, Firestore anonymous GET 403 PASS, no Functions emulator. Subsequent P141 starter exited 1 because the previous emulator process already occupied Firestore port 18080. **Do not start another P141 instance.**

P162 checks the exact IPv4 local Emulator Hub registry and static deny-all Firestore rules fixture *before any local account creation*. It verifies an unauthenticated GET is denied (HTTP 403), creates two random `@example.invalid` Auth Emulator accounts using Firebase local Auth REST signUp, signs both in with email/password, confirms separate UIDs and ID tokens, verifies Firestore GET remains 403 under each identity, and deletes the two local test accounts. No Firestore writes, Owner Functions, Firebase cloud calls, deployment, secrets, tokens, credentials or response bodies printed. Do not save output from the Auth emulator to a public artifact. Failed cleanup must be treated as NO_GO and addressed locally.

With existing emulator process listening (do not run starter again), run:
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p162-demo-auth-deny-all-security
if [ ! -d "$HOME/packtook-p162" ]; then
  git worktree add --detach "$HOME/packtook-p162" origin/review/p162-demo-auth-deny-all-security
fi
cd "$HOME/packtook-p162"
python3 audit/p162-demo-auth-deny-all.py
```

Expected P162_DECISION=LOCAL_AUTH_AND_DENY_ALL_READ_ATTESTED, P162_DEMO_AUTH_ACCOUNT_CLEANUP=PASS. If not, remain NO_GO and inspect only redacted local statuses. Actual production rules are not covered: the demo intentionally uses a deny-all fixture, so this **does not prove production cross-account isolation** or Owner role checks. Additional rules-specific fixtures must be written for true account isolation. NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
