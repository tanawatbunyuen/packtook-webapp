# P159 — Small GET / range network diagnosis

Operator's real P157 HEAD against official Firestore Emulator 1.22.0 returned 200 and Content-Length 136707194. But real P158 streamed GET returned `NETWORK_OR_IO_FAILURE`, which collapsed multiple error types. To isolate actual HTTP GET response from a long transfer, P159 sends a **single public HTTPS Range GET for exactly 0–1048575** to the same official artifact, with a 12-second socket timeout. It validates HTTP 206 and the exact Content-Range, reads at most 1048577 bytes into memory (one extra byte to reject excessive body) and writes nothing. It also reports whether the existing isolated cache filesystem has >=500MB free.

The official Google Cloud Storage API supports ranged GET requests and 206 Partial Content; however, a successful small range still does not prove the full 136.7MB transfer can finish. Response body is discarded, and only numeric HTTP code/byte count/category appear. No Firebase CLI, Owner imports, emulator startup, deployments or private source/log exposure.

Cloud Shell:
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p159-small-http-range-probe
if [ ! -d "$HOME/packtook-p159" ]; then
 git worktree add --detach "$HOME/packtook-p159" origin/review/p159-small-http-range-probe
fi
cd "$HOME/packtook-p159"
python3 audit/p159-small-range-probe.py --range-only
```

Next, if 206 succeeds and sufficient space remains, implement verified chunk download with resilient range retries and resumable checkpoint, not repeated full GET attempts. If GET fails, diagnose returned category and avoid retrying large downloads. NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
