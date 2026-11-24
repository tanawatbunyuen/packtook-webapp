# P161 — Read-only Firebase Emulator registration and deny-all proof

User confirmed the P160 official v1.22.0 JAR completely downloaded, size/ZIP/CRC validated; P141 reported both Firestore and Auth listeners responding in the demo project. The Hub also advertised Firestore at 127.0.0.1:18080. These observations are not yet sufficient to prove all three services are registered or Firestore client rules deny reads.

This script checks the Hub's local `/emulators` JSON endpoint for exact IPv4 Hub 14400, Firestore 18080, Auth 19099 and absence of Functions Emulator. It performs **one unauthenticated GET of an explicitly nonexistent Firestore document** in the demo project. HTTP 403 is required to attest client read denial; no document contents are printed. It does not contact or change any remote Firebase Cloud project, does not read Auth accounts, and makes no Firestore writes.

Run from a **second Cloud Shell tab** while the P141 starter remains running in its original tab:

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p161-emulator-identity-readonly-attestation
if [ ! -d "$HOME/packtook-p161" ]; then
 git worktree add --detach "$HOME/packtook-p161" origin/review/p161-emulator-identity-readonly-attestation
fi
cd "$HOME/packtook-p161"
python3 audit/p161-local-identity-attest.py
```

Even successful P161 attests only local service registration and Firestore unauthenticated read denial. It does not confirm full Firebase Auth functionality, Owner Function permission checks, recovered source integrity, App Check or production security. NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
