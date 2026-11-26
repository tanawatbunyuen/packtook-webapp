// P231.148 — PASSIVE, time-limited browser observer for existing normal PACKTOOK requests.
// Paste into DevTools Console only at https://packtook-staging.web.app.
// NO requests are initiated. NO header VALUES, body, user info or URLs are printed.
(() => {
  const report=(k,v)=>console.log("P231_"+k+"="+v);
  report("CHECK","NORMAL_CLIENT_APPCHECK_HEADER_PASSIVE_OBSERVER");
  report("SCRIPT_VERSION","P231148_PASSIVE_OBSERVER_V1");
  if(location.origin!=="https://packtook-staging.web.app"){
    report("GATE","BLOCKED_WRONG_ORIGIN");return;
  }
  if(window.__p231148ObserverActive===true){
    report("GATE","BLOCKED_OBSERVER_ALREADY_ACTIVE");return;
  }
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  if(`${parts.year}-${parts.month}-${parts.day}`!=="2026-11-26"){
    report("GATE","BLOCKED_ACTIVE_TEST_DATE_EXPIRED");return;
  }
  const match=(url,method)=>{
    try{
      const u=new URL(url,location.href);
      const endpoint=u.pathname.split("/").filter(Boolean).at(-1);
      return method==="POST" &&
        u.protocol==="https:" &&
        u.hostname==="asia-southeast1-packtook-staging.cloudfunctions.net" &&
        (endpoint==="usageStatus"||endpoint==="recordingStatus")
        ?endpoint:null;
    }catch{return null;}
  };
  const headerHas=(source,key)=>{
    try{
      if(!source)return false;
      if(typeof source.get==="function")return !!source.get(key);
      if(Array.isArray(source))
        return source.some(pair=>Array.isArray(pair)&&String(pair[0]).toLowerCase()===key.toLowerCase()&&!!pair[1]);
      return Object.keys(source).some(k=>k.toLowerCase()===key.toLowerCase()&&!!source[k]);
    }catch{return false;}
  };
  const originalFetch=window.fetch;
  const xhr=XMLHttpRequest.prototype;
  const originalOpen=xhr.open;
  const originalSet=xhr.setRequestHeader;
  const originalSend=xhr.send;
  const xhrState=new WeakMap();
  const found=new Set();
  let total=0;
  const emit=(name,app,auth,transport)=>{
    total++;
    found.add(name);
    report("OBSERVED_CALL",name);
    report("TRANSPORT",transport);
    report("APPCHECK_HEADER_PRESENT",app?"YES":"NO");
    report("FIREBASE_AUTH_HEADER_PRESENT",auth?"YES":"NO");
    report("CREDENTIAL_VALUES","NOT_PRINTED");
  };
  let stopped=false;
  const stop=(reason)=>{
    if(stopped)return;
    stopped=true;
    if(window.fetch===wrappedFetch)window.fetch=originalFetch;
    if(xhr.open===wrappedOpen)xhr.open=originalOpen;
    if(xhr.setRequestHeader===wrappedSet)xhr.setRequestHeader=originalSet;
    if(xhr.send===wrappedSend)xhr.send=originalSend;
    window.__p231148ObserverActive=false;
    clearTimeout(timeout);
    report("OBSERVER_STOP",reason);
    report("MATCHED_REQUEST_COUNT",total);
    report("MATCHED_ENDPOINT_TYPES",found.size);
    report("NORMAL_CLIENT_APPCHECK_ATTACHMENT",total>0?"OBSERVED_HEADERS_ONLY":"NOT_VERIFIED_NO_MATCH");
    report("RUNTIME_REQUESTS_INITIATED_BY_SCRIPT","0");
    report("RELEASE","NO_GO");
  };
  const wrappedFetch=function(input,init){
    try{
      const url=typeof input==="string"||input instanceof URL ?String(input):input?.url;
      const method=String(init?.method||input?.method||"GET").toUpperCase();
      const endpoint=match(url,method);
      if(endpoint){
        const app=headerHas(init?.headers,"X-Firebase-AppCheck")||headerHas(input?.headers,"X-Firebase-AppCheck");
        const auth=headerHas(init?.headers,"Authorization")||headerHas(input?.headers,"Authorization");
        emit(endpoint,app,auth,"FETCH");
      }
    }catch{report("OBSERVATION_ERROR","REDACTED_FETCH");}
    return Reflect.apply(originalFetch,this,arguments);
  };
  const wrappedOpen=function(method,url){
    try{xhrState.set(this,{endpoint:match(url,String(method).toUpperCase()),app:false,auth:false});}catch{}
    return Reflect.apply(originalOpen,this,arguments);
  };
  const wrappedSet=function(name,value){
    try{
      const state=xhrState.get(this);
      if(state?.endpoint){
        if(String(name).toLowerCase()==="x-firebase-appcheck")state.app=!!value;
        if(String(name).toLowerCase()==="authorization")state.auth=!!value;
      }
    }catch{}
    return Reflect.apply(originalSet,this,arguments);
  };
  const wrappedSend=function(){
    try{
      const state=xhrState.get(this);
      if(state?.endpoint)emit(state.endpoint,state.app,state.auth,"XHR");
    }catch{report("OBSERVATION_ERROR","REDACTED_XHR");}
    return Reflect.apply(originalSend,this,arguments);
  };
  window.__p231148ObserverActive=true;
  window.fetch=wrappedFetch;
  xhr.open=wrappedOpen;
  xhr.setRequestHeader=wrappedSet;
  xhr.send=wrappedSend;
  const timeout=setTimeout(()=>stop("TIMEOUT_90_SECONDS"),90000);
  report("OBSERVER","ARMED_90_SECONDS");
  report("ACTION","OBSERVE_ONLY_EXISTING_READ_ONLY_STATUS_ACTIVITY");
  report("UNRELATED_REQUESTS","PASSTHROUGH_UNCHANGED");
  report("CALLABLE_INVOKE_BY_SCRIPT","NOT_PERFORMED");
  report("IAM_WRITES","0");
  report("DEPLOY","NOT_PERFORMED");
})();
