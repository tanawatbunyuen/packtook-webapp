# P157 — Isolate official Firestore Emulator download network path

P156 actual private logs: P155 `setup:emulators:firestore` timed out with exit 124; only one "Downloading" line, zero errors or completion; no proxy variables detected in Cloud Shell. Firebase CLI 15.34.2 references a Firestore Emulator JAR v1.22.0, while isolated cache retains valid v1.21.0.

The official firebase-tools source uses `https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v<version>.jar` for Firestore binary downloads (see Firebase firebase-tools downloadableEmulators source). P157 performs **one timeout-bounded HTTPS HEAD** against the exact v1.22.0 JAR URL. It does not download the body or write to cache. Connections are direct (proxy disabled) to isolate whether the official artifact host is reachable. Response output includes status and Content-Length only; no server responses, URLs with secrets, TLS certificate data, raw logs or credentials.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p157-firestore-download-head-probe
if [ ! -d "$HOME/packtook-p157" ]; then
  git worktree add --detach "$HOME/packtook-p157" origin/review/p157-firestore-download-head-probe
fi
cd "$HOME/packtook-p157"
python3 audit/p157-official-artifact-head.py --head-only
```

The test is a **network read** to the public Firebase distribution host. A successful HEAD does not guarantee a large JAR download can finish; a failure does not guarantee that standard CLI networking would also fail. Keep `NO_GO_OWNER_IMPORT` and `NO_GO_DEPLOY`.
