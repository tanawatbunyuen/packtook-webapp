// PACKTOOK V6.5 — client-side registration rollout configuration.
// Firebase App Check reCAPTCHA Enterprise site key is PUBLIC, never a secret.
// Leave empty until domain authorization, App Check, legal review and QA are done.
// Server-side flags in functions/index.js are authoritative. This file grants no access.
export const signupConfig=Object.freeze({
 appCheckSiteKey:"",
 policyVersion:"2026-11-v1",
 termsUrl:"policy-terms.html",
 privacyUrl:"policy-privacy.html"
});
