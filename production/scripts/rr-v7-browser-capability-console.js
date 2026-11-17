/* PACKTOOK V7 device capability preflight. PASTE INTO CHROME DEVTOOLS
 * ONLY on https://packtook-staging.web.app or ...firebaseapp.com.
 * Does not request camera permissions, read device lists, open files,
 * sign in, call Firebase, or mutate any data. Reports no personal data.
 */
(() => {
  'use strict';
  const allowed = new Set(['packtook-staging.web.app','packtook-staging.firebaseapp.com']);
  const hostname = String(location.hostname || '').toLowerCase();
  const safeOrigin = location.protocol === 'https:' && allowed.has(hostname);
  const report = {
    STAGING_ORIGIN: safeOrigin ? 'PASS' : 'BLOCKED',
    SECURE_CONTEXT: window.isSecureContext === true ? 'PASS' : 'BLOCKED',
    CAMERA_API: typeof navigator.mediaDevices?.getUserMedia === 'function' ? 'PASS' : 'BLOCKED',
    MEDIA_RECORDER: typeof window.MediaRecorder === 'function' ? 'PASS' : 'BLOCKED',
    WEBM_SUPPORTED: typeof window.MediaRecorder?.isTypeSupported === 'function' &&
      ['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].some(
        t => window.MediaRecorder.isTypeSupported(t)) ? 'PASS' : 'BLOCKED',
    FILE_SYSTEM_ACCESS: typeof window.showDirectoryPicker === 'function' ? 'PASS' : 'BLOCKED',
    VIDEO_WRITER_BRIDGE: typeof window.PACKTOOK_VIDEO_WRITER?.open === 'function' ? 'PASS' : 'BLOCKED',
    VIDEO_HISTORY_BRIDGE: typeof window.PACKTOOK_VIDEO_HISTORY?.connect === 'function' ? 'PASS' : 'BLOCKED',
    FIREBASE_BRIDGE_PRESENT: window.PACKTOOK_FIREBASE?.ready === true ? 'PASS' : 'BLOCKED',
    INDEXED_DB_API: typeof window.indexedDB?.open === 'function' ? 'PASS' : 'BLOCKED',
  };
  const all = Object.values(report).every(v=>v==='PASS');
  console.table(report);
  console.log('V7_DEVICE_CAPABILITY_PREFLIGHT:', all ? 'PASS' : 'BLOCKED');
  console.log('CAMERA_PERMISSION_REQUESTS: 0');
  console.log('FIREBASE_MUTATIONS: 0');
  console.log('DEVICE_TEST_AUTHORIZED: NO');
  console.log('RELEASE: NO_GO_RELEASE');
  return report;
})();
