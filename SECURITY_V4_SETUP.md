# PACKTOOK V4 — Security Phase 1 + 2 (STAGING)

This branch is isolated. Existing PACKTOOK GitHub Pages production demo has NOT been switched to secure login.

## Included
- Secure sign up / login / reset request / logout staging UI: secure-v4.html.
- SQL owner accounts, recording reservations, audit log, locked-down RLS.
- Supabase Edge Function server-side authenticated credit ledger operations.
- Limits: Free 20, Starter 50, Basic 300, Growth 1500, Business 5000, Pro unlimited.

## Deployment steps
1. Create a dedicated staging Supabase project. Enable email confirmation, set Site URL and Allowed Redirect URLs, enable MFA for admin.
2. Run the SQL migrations in filename order in SQL editor.
3. Deploy supabase/functions/packtook-credits/index.ts as a Supabase Edge Function. Leave JWT verification ON. Set PACKTOOK_WEB_ORIGIN=https://tanawatbunyuen.github.io. SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must only be stored server-side.
4. Copy v4-config.example.js to v4-config.js; configure only public Supabase project URL, publishable API key and Edge Function URL.
5. Serve the staging page secure-v4.html through HTTPS. Test user creation, email verification, login, reset, logout, status, reserve, fail.
6. Integrate reserve before startRecording; complete after successful local file verification; fail on proven failed recording. Never trust localStorage as the quota source.
7. Before opening paid subscriptions, implement renewal periods, payment webhooks, monitoring, backups, rate limiting and stale reservation reconciliation.

## Important limits
- Browser JS can be edited by end users; only server-issued usage receipts are authoritative.
- Local file success is self-reported by browser and cannot be cryptographically proven without trusted client/device mechanisms.
- Changes to account plan MUST be made only by verified billing webhooks or privileged admin tools.
- Owner-only design; multi-staff permissions and device binding are future work.
- No production secrets should ever be committed to GitHub.

## Negative and concurrency tests
- Bad password denied; unconfirmed email blocked when email confirmation enabled.
- Browser localStorage changes do not change server quotas.
- Direct anon or authenticated RPC calls are denied.
- User A cannot read User B account or reserve their credits.
- Reuse same operation UUID => idempotent reservation.
- Two concurrent reservations for last available credit => only one succeeds.
- Complete twice => idempotent; fail after complete => rejected.
- Free request number 21 => rejected. Pro unlimited.
- Expired token => denied; password recovery changes password securely.

## Current deployment status
Code is committed on a feature branch, not deployed. A Supabase staging project and configuration are required to execute the secure flow.