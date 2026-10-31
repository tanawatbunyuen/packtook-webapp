# PACKTOOK V6.0 — Production Foundation (isolated from Staging)

**Status: Code ready; not deployed to a real Production Firebase project.**
**This is a pre-launch foundation, NOT permission to accept live payments or record customer videos.**

## Environment boundaries

| | Staging (existing, unchanged) | Production (new) |
|---|---|---|
| Firebase project | `packtook-staging` | **unique new project ID containing `prod`** (example `packtook-prod-01` only if available) |
| Source | `firebase-staging/` in repo | `production/` in this branch |
| Customer data | Existing test Auth + Firestore | Completely separate empty Auth + Firestore |
| Marketing | None | `production/public/` prelaunch |
| Customer App | Actual staging packing app | `production/app/` closed portal (no packing/payments) |
| Owner | Existing staging analytics | `production/owner/` closed landing (no cross-tenant access) |
| Omise | Test credentials only | **NOT provisioned** |
| Functions | Staging backend | **NOT deployed in V6.0** |
| Firestore rules | Existing staging rules | Fail-closed V6.0 draft (explicit deploy only) |

Firebase recommends a separate project for each environment:
https://firebase.google.com/docs/projects/dev-workflows/overview-environments

### Why V6.0 holds the production app closed

The current staging Functions explicitly reject Omise Live charges, and the local-video reliability test was deferred. Copying those Functions into Production and enabling payments would be unsafe. The V6.0 foundation establishes a distinct Firebase project and safe static sites; the V6.1 release will migrate/verify packing, server-side wallet, subscription protection, payments, incident recovery, and deployment tests before access opens.

V6.0 includes a prepared customer authentication page (`production/app/index.html`, `auth.js`) with login, signup, reset password and email verification code. `runtime-config.js` intentionally sets `enabled:false`, `registrationEnabled:false`, and `policiesApproved:false`, so the live V6.0 portal shows a disabled/closed page. Do not turn these flags on before the legal, auth and backend release gates pass.

## Cloud Shell setup — safe copy/paste

**1. Create a new Firebase Project**, e.g. `packtook-prod-01` if available, from the [Firebase Console](https://console.firebase.google.com/). **Do not add an extra Hosting site to `packtook-staging` as a substitute:** Hosting multisites in the same project share Authentication and Firestore.

Before setting up Firestore, choose and document the region deliberately. Existing staging Functions use `asia-southeast1` (Singapore). For Production consider the current availability, costs, latency and data residency needs (Bangkok or Singapore options may differ by database edition). Firestore database location is a consequential decision. Enable Blaze/billing only when needed for Cloud Functions and future Live Payment, with billing budget alerts and restricted IAM roles. An alert is not a hard cap.

**2. Clone Production source into a separate Cloud Shell folder** (do not check out production into your working staging folder):

```bash
cd ~
git clone --depth 1 --branch feature/v6.0-production-foundation \
  https://github.com/tanawatbunyuen/packtook-webapp.git packtook-production-v6
cd ~/packtook-production-v6/production
```

**3. Validate code and prepare independent Hosting sites.** Replace `YOUR-PROD-PROJECT-ID` with the **exact** Firebase ID you just created:

```bash
node scripts/verify.mjs YOUR-PROD-PROJECT-ID
bash scripts/bootstrap.sh YOUR-PROD-PROJECT-ID
```

The bootstrap script validates the Firebase project is accessible, verifies it is not `packtook-staging`, checks the existing sites, asks for explicit approval and creates up to three Hosting sites. It writes `production/.firebaserc` only (ignored by git), not your existing Staging folder.

Default Hosting site names:

- Marketing: `YOUR-PROD-PROJECT-ID.web.app`
- Customer: `YOUR-PROD-PROJECT-ID-app.web.app`
- Owner: `YOUR-PROD-PROJECT-ID-owner.web.app`

Additional Hosting IDs must be globally unique and no longer than 30 characters. If a generated site ID is taken, run `bash scripts/bootstrap.sh <prod-id> <custom-app-site-id> <custom-owner-site-id>`.

**4. Deploy ONLY the safe holding pages.**

```bash
bash scripts/deploy-hosting.sh YOUR-PROD-PROJECT-ID
```

This command deliberately uses `--only hosting:marketing,hosting:app,hosting:owner`; no Firestore, Functions, accounts, or billing changes. Do **not** run a bare `firebase deploy`.

**5. If you create the Production Firestore database**, choose Production Mode and lock it to deny all reads/writes initially:

```bash
bash scripts/lock-firestore.sh YOUR-PROD-PROJECT-ID
```

Do not run this after an operational Production Customer backend is enabled without reviewing the rules.

**6. Production project next actions (manual in Firebase/GCP console):**

- Register separate Production Web Apps; store their generated public Firebase web config **in production config only**, never copy Staging config. The config example is in `production/config/firebase-web.example.js`.
- Keep Email/Password signups closed until policies and onboarding are ready. Configure Firebase Authentication authorized domains once actual domains are connected.
- Enable App Check where appropriate, monitor Auth abuse, set quotas/alerts, configure least-privilege IAM.
- No production Owner claims, no customer data migration, no Omise Live keys yet.
- Save location/region, support contacts, business entity, Privacy/Terms/Refund approvals and disaster recovery process in the launch record.

## Domain mapping

After purchasing a domain and verifying ownership in **Production** Firebase Hosting:

- `packtook.com` or `www.packtook.com` → Production **Marketing**
- `app.packtook.com` → Production **Customer**
- `owner.packtook.com` → Production **Owner**

These are **examples only, not verified registered domains**. Firebase Hosting manages HTTPS certificates once verification and DNS are complete. See https://firebase.google.com/docs/hosting/custom-domain

Do not attach any of these public domains to `packtook-staging`.

## Launch gates (V6.1 and later)

1. Backend production Functions and Firestore rules deployed against the new project, independent IAM/secrets; no test keys.
2. Full customer packing process and local file permissions tested on actual Chrome/Edge, long sessions, forced close/recovery, duplicate order approval, device transitions.
3. Production plan quota/credit adjustments and subscription state transitions tested under concurrent requests and payment retries.
4. Omise merchant approval, Live keys, signed Webhook, reconciliation, refunds, handling failed/ambiguous charge, accounting reconciliation; staging test charges never count as live.
5. Approved Privacy Policy, Terms, Refund Policy, contact details and user disclosure/consent flow. Drafts are in `legal-drafts/` and are intentionally **not deployed**.
6. Domain, Auth authorized domains, logging, cost alerts, security review, backup and restore tests complete.
7. Only then approve switching Production runtime flags and deploying actual Customer/Owner apps.

## Support and rollback

For V6.0 rollback, use Firebase Hosting release history for each Production site. Staging has not been touched. No migrated customer data exists and there should be **zero actual production charges**.

Useful commands:
```bash
firebase hosting:sites:list --project YOUR-PROD-PROJECT-ID
firebase projects:list
firebase hosting:channel:deploy review-v60 --only marketing --project YOUR-PROD-PROJECT-ID
```

> The last command uses a Hosting preview channel; it is optional and must be run from `production/` after target setup. Do not publish staging configuration or payment secrets in GitHub.
