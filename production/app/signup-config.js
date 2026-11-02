// PACKTOOK V6.5 — client-side registration rollout configuration.
// Firebase App Check reCAPTCHA Enterprise site key is PUBLIC, never a secret.
// V6.9.1: App Check provider shown as Registered in Firebase Console (2026-11-02).
// Full Web Site Key has NOT been supplied: screenshot only shows a truncated ID.
// Never use an ellipsis/placeholder; set the full public key using
// scripts/set-appcheck-site-key.mjs after checking Google Cloud Key details.
// Even with a real key, Public signup needs server/legal approval before opening.
// Server-side flags in functions/index.js are authoritative. This file grants no access.
export const signupConfig=Object.freeze({
 appCheckSiteKey:"",
 policyVersion:"2026-11-v1",
 termsUrl:"policy-terms.html",
 privacyUrl:"policy-privacy.html"
});
