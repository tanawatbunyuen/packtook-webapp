import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const api=name=>httpsCallable(functions,name);
const deviceKey="packtook-device-v4";
let deviceId=localStorage.getItem(deviceKey);if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(deviceKey,deviceId)}
let user=null;
const listeners=new Set();
onAuthStateChanged(auth,u=>{user=u?.emailVerified?u:null;for(const cb of listeners)cb(user)});
window.PACKTOOK_FIREBASE={
 ready:true,
 deviceId,
 async registerDevice(name){return (await api("registerDevice")({deviceId,name})).data},
 async deviceStatus(){return (await api("deviceStatus")({deviceId})).data},
 onUser(cb){listeners.add(cb);cb(user);return()=>listeners.delete(cb)},
 async login(email,password){const result=await signInWithEmailAndPassword(auth,email,password);if(!result.user.emailVerified){await signOut(auth);throw Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ")}return result.user},
 async logout(){await signOut(auth)},
 async usage(){return (await api("usageStatus")({})).data},
 async recordingStatus(operationId){return (await api("recordingStatus")({operationId})).data},
 async reserve(barcode,operationId){return (await api("reserveCredit")({barcode,operationId,deviceId})).data},
 async finalize(operationId,success,meta={}){return (await api("finalizeCredit")({operationId,success,...meta})).data}
};
window.dispatchEvent(new Event("packtook-firebase-ready"));
