# P147 — Local Node runtime and error fingerprint (no Firebase execution)

P146 operator log classification: 15 lines, three generic ERROR lines, first line 2; no recognized HTTP, DNS, Java, rules or permission failure category. Cache hash parity confirmed by P144. Before another Emulator restart, inspect the CLI Node runtime: prior process observation included Node 26.13.0. Firebase Functions documentation explicitly supports Node 20/22, Firebase CLI release notes introduced Node 24; Node 26 compatibility has **not** been established for this particular setup. This is only a **hypothesis**, not proof of root cause.

P147 reports current Node **major version** and controlled allowlisted tags from error lines in the existing private log, with no raw log lines, arbitrary words, token/URL/path contents, or Firebase CLI commands. The script invokes the installed Node only to read process.versions.node; there are no Firebase calls or restarts.

## Run from dedicated worktree

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p147-runtime-compatibility-diagnostics
git worktree add --detach "$HOME/packtook-p147" origin/review/p147-runtime-compatibility-diagnostics
cd "$HOME/packtook-p147"
python3 audit/p147-runtime-and-error-tags.py
```

Only share `P147_` lines. If Node 26 is confirmed, compare using an **already installed** Node 22 binary after checking that it's available, do not change system default Node, and do not launch recovered Owner source. NO_GO_DEPLOY remains.
