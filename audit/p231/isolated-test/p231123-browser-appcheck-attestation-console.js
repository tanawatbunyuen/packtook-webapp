// P231.123 — Paste into Chrome/Edge DevTools Console on https://packtook-staging.web.app.
// This creates a temporary, separately named Firebase client instance in this tab.
// It performs ONE real App Check token request; no backend business callable invoked.
// Do not run beyond the approved 2026-11-26 Asia/Bangkok testing window.
// No token, site key, Firebase config, or error message will be printed.
(async () => {
  const report = (name, value) => console.log("P231_" + name + "=" + value);
  report("CHECK", "REAL_BROWSER_ISOLATED_APPCHECK_ATTESTATION");
  try {
    if (location.origin !== "https://packtook-staging.web.app") {
      report("GATE", "BLOCKED_WRONG_ORIGIN"); return;
    }
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date()).filter(x => x.type !== "literal").map(x => [x.type,x.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    if (today !== "2026-11-26") {
      report("GATE", "BLOCKED_APPROVED_DATE_EXPIRED"); return;
    }
    if (self.FIREBASE_APPCHECK_DEBUG_TOKEN !== undefined) {
      report("GATE", "BLOCKED_DEBUG_TOKEN_PRESENT"); return;
    }
    const sdk = "https://www.gstatic.com/firebasejs/11.10.0/";
    const [appSdk, checkSdk, configModule] = await Promise.all([
      import(sdk + "firebase-app.js"),
      import(sdk + "firebase-app-check.js"),
      import("/firebase-v4-config.js")
    ]);
    if (!configModule.firebaseConfig || configModule.firebaseConfig.projectId !== "packtook-staging") {
      report("GATE", "BLOCKED_CONFIG_NOT_STAGING"); return;
    }
    // Public site key remains only in memory; never print it or commit it.
    const response = await fetch("/firebase-packing-bridge.js", {method:"GET",credentials:"omit",cache:"no-store",redirect:"error"});
    if (!response.ok) { report("GATE", "BLOCKED_BRIDGE_NOT_READABLE"); return; }
    const bridge = await response.text();
    const anchor = bridge.match(/\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)/);
    if (!anchor || !anchor[2]) {report("GATE","BLOCKED_PROVIDER_KEY_NOT_SIMPLE_LITERAL");return;}
    const key = anchor[2];
    const uniqueName = "p231-browser-check-" + crypto.randomUUID();
    const app = appSdk.initializeApp(configModule.firebaseConfig,uniqueName);
    let check;
    try {
      check = checkSdk.initializeAppCheck(app, {
        provider:new checkSdk.ReCaptchaEnterpriseProvider(key),
        isTokenAutoRefreshEnabled:false
      });
      // Force a real exchange rather than accepting a cached App Check token.
      const result = await checkSdk.getToken(check, true);
      // getToken() returns AppCheckTokenResult { token }, not the provider-side
      // AppCheckToken { token, expireTimeMillis }. Never print the token value.
      const issued = typeof result?.token === "string" && result.token.length > 0;
      report("TOKEN_RESPONSE", issued ? "ISSUED_NONEMPTY" : "NO_NONEMPTY_TOKEN");
      report("REAL_BROWSER_ATTESTATION", issued ? "TOKEN_ISSUANCE_OBSERVED" : "NOT_VERIFIED");
    } catch (e) {
      const code = typeof e?.code === "string" && /^appCheck\/[a-z0-9-]+$/i.test(e.code)
        ? e.code : "ERROR_CLASS_REDACTED";
      report("SDK_ERROR_CODE", code);
      report("REAL_BROWSER_ATTESTATION", "FAILED_OR_INCONCLUSIVE");
    } finally {
      try {await appSdk.deleteApp(app);}catch {}
    }
  } catch {
    report("REAL_BROWSER_ATTESTATION", "BLOCKED_OR_UNEXPECTED");
  } finally {
    report("APP_CHECK_TOKEN_VALUE", "NOT_PRINTED");
    report("FIREBASE_AUTH_TEST_USER", "NOT_VERIFIED");
    report("CLOUD_RUN_FUNCTION_INVOKE", "NOT_PERFORMED");
    report("RUNTIME_APPCHECK_E2E", "NOT_PERFORMED");
    report("IAM_WRITES", "0");
    report("DEPLOY", "NOT_PERFORMED");
    report("CLEANUP", "NOT_PERFORMED");
    report("RELEASE", "NO_GO");
  }
})();
