// PACKTOOK V6.5 — client-side registration rollout configuration.
// Firebase App Check reCAPTCHA Enterprise site key is PUBLIC, never a secret.
// V6.9.2: owner supplied a replacement PUBLIC reCAPTCHA Enterprise Web Site Key (2026-11-02).
// Verify its Production GCP project, Firebase App Check registration and domain before deployment.
// Browser App Check token attestation has NOT yet been validated with this replacement key.
// Site Key alone must never unlock Public signup or override server-side flags.
// Even with a real key, Public signup needs server/legal approval before opening.
// Server-side flags in functions/index.js are authoritative. This file grants no access.
export const signupConfig=Object.freeze({
 appCheckSiteKey:"6Lf49gwuAAAAAOxO-S58hKwuPORm6txb9n33_DPL",
 policyVersion:"2026-11-v1",
 termsUrl:"policy-terms.html",
 privacyUrl:"policy-privacy.html"
});
