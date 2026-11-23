# P156 — Diagnose stalled Firestore JAR 1.22.0 official setup

Actual P155 Cloud Shell result: `P155_SETUP_EXIT_CODE=124` (180s timeout); JAR 1.22.0 absent/invalid; one valid JAR (1.21.0). This means a download operation was not completed. It does **not** alone establish whether remote connectivity, a stalled HTTP request, or CLI behavior caused it.

P155 deliberately invoked Firebase CLI with `env -i`, explicitly preserving `PATH` and `HOME` but not any `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`/etc. In managed Cloud Shell environments a proxy may be needed; stripping it is a **testable candidate**, not proof.

P156 reads only the existing private P155 setup log plus the **names** (presence flags) of current proxy environment variables. No proxy URL/hostname, raw log, secret, user identity or untrusted value is emitted. It does not call Firebase CLI, restart, download, or modify Cloud.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p156-proxy-env-and-download-timeout-diagnostic
if [ ! -d "$HOME/packtook-p156" ]; then
  git worktree add --detach "$HOME/packtook-p156" origin/review/p156-proxy-env-and-download-timeout-diagnostic
fi
cd "$HOME/packtook-p156"
python3 audit/p156-timeout-env-diagnostic.py
```

Only share P156_ lines. If a proxy env is present in the operator shell and the setup wrapper stripped it, the next candidate is a narrow **allowlist** of HTTPS/HTTP/NO_PROXY environment variables in the isolated download-only wrapper (without ever logging their values), with bounded download and integrity verification. Do not retry the same download before diagnosis. Keep NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
