# P145 — Fix Firestore rules path in dedicated Firebase emulator config

Operator P143 confirmed both cached JARs CRC valid and P144 confirmed exact SHA-256 parity. P144 reported explicit error and download-start indicator but no emulator binary launch or readiness. A static P140 review found a concrete configuration bug: the isolated config at `audit/p140-firebase-emulator.json` declared a rules path of `audit/p140-firestore-deny-all.rules`, even though rules live alongside the config in the same `audit/` directory. Firebase CLI resolves config project-relative file paths from its config/project directory. The duplicated `audit/` segment can cause missing-rules-file startup failures. The original P141 log has NOT yet confirmed this as its particular error.

P145 fixes the rules path to `p140-firestore-deny-all.rules` and checks that it resolves to a real deny-all rules file. This is a **review-branch change only**, not a Firebase rules deploy. The CI checks are mock/offline and do not start real emulators.

## Safe next action

Use the newest dedicated P145 worktree and FIRST run the offline config test. Then, when convenient, run the corrected P141 starter from this branch:

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p145-emulator-config-rules-path-fix
git worktree add --detach "$HOME/packtook-p145" origin/review/p145-emulator-config-rules-path-fix
cd "$HOME/packtook-p145"
node audit/p145-rules-path-regression.cjs
bash audit/p141-demo-emulator-start.sh
```

Any response `P141_BLOCK` means stop and examine only a locally redacted error category. Do not share raw logs or recovered Owner source. Emulators are isolated demo services, not proof that real handlers are safe. **NO_GO_OWNER_IMPORT / NO_GO_DEPLOY**.
