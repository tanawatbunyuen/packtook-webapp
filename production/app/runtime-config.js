// PACKTOOK V6.0 public runtime configuration (safe defaults).
// Production Auth stays OFF until reviewed policy text, verified Firebase project and
// production-only backend are ready. Never copy values from packtook-staging.
window.PACKTOOK_PRODUCTION_CONFIG = Object.freeze({
  enabled: false,
  registrationEnabled: false,
  policiesApproved: false,
  expectedProjectId: "",
  firebase: null
});
