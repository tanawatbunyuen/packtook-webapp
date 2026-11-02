// PACKTOOK V6.5 — client-side registration rollout configuration.
// Firebase App Check reCAPTCHA Enterprise site key is PUBLIC, never a secret.
// V6.9.1: App Check provider shown as Registered in Firebase Console (2026-11-02).
// Public reCAPTCHA Enterprise Web Site Key was supplied by project owner (2026-11-02).
// Browser token and Google Cloud Key details/status are NOT yet validated.
// Site Key alone must never unlock Public signup or override server-side flags.
// Even with a real key, Public signup needs server/legal approval before opening.
// Server-side flags in functions/index.js are authoritative. This file grants no access.
export const signupConfig=Object.freeze({
 appCheckSiteKey:"6Lfq9gwuAAAAAMtVvIRwb95QUCiP9qrxDgZtkeGZ",
 policyVersion:"2026-11-v1",
 termsUrl:"policy-terms.html",
 privacyUrl:"policy-privacy.html"
});
