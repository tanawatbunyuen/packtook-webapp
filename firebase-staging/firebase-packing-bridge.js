import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const api=name=>httpsCallable(functions,name);
const deviceKey="packtook-device-v4";
const deviceId=()=>{let id=localStorage.getItem(deviceKey);if(!id||!/^[a-zA-Z0-9_-]{16,100}$/.test(id)){id=crypto.randomUUID();localStorage.setItem(deviceKey,id)}return id};
let user=null;
const listeners=new Set();
onAuthStateChanged(auth,u=>{user=u?.emailVerified?u:null;for(const cb of listeners)cb(user)});
window.PACKTOOK_FIREBASE={
 ready:true,
 get deviceId(){return deviceId()},
 async registerDevice(name){return (await api("registerDevice")({deviceId:deviceId(),name})).data},
 async removeDevice(targetId){return (await api("removeDevice")({deviceId:deviceId(),targetId})).data},
 async deviceStatus(){return (await api("deviceStatus")({deviceId:deviceId()})).data},
 onUser(cb){listeners.add(cb);cb(user);return()=>listeners.delete(cb)},
 async login(email,password){const result=await signInWithEmailAndPassword(auth,email,password);if(!result.user.emailVerified){await signOut(auth);throw Error("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ")}return result.user},
 async logout(){await signOut(auth)},
 async usage(){return (await api("usageStatus")({})).data},
 async recordingStatus(operationId){return (await api("recordingStatus")({operationId})).data},
 async inviteOperator(email){return (await api("inviteOperator")({email})).data},
 async acceptOperatorInvite(){return (await api("acceptOperatorInvite")({})).data},
 async listOperators(){return (await api("listOperators")({})).data},
 async requestDuplicate(barcode,reason){return (await api("requestDuplicate")({barcode,reason})).data},
 async myDuplicateRequests(){return (await api("myDuplicateRequests")({})).data},
 async listDuplicateRequests(){return (await api("listDuplicateRequests")({})).data},
 async approveDuplicateRequest(requestId){return (await api("approveDuplicateRequest")({requestId})).data},
 async operatorApprovalStatus(requestId){return (await api("operatorApprovalStatus")({requestId})).data},
 async subscriptionOverview(){return (await api("subscriptionOverview")({})).data},
 async createPaymentCheckout(requestId){return (await api("createPaymentCheckout")({requestId})).data},
 async requestPlanChange(plan){return (await api("requestPlanChange")({plan})).data},
 async accountRole(){return (await api("accountRole")({})).data},
 async authorizeDuplicate(barcode,reason){return (await api("authorizeDuplicate")({barcode,reason})).data},
 async reserve(barcode,operationId,approvalId=null){return (await api("reserveCredit")({barcode,operationId,deviceId:deviceId(),approvalId})).data},
 async finalize(operationId,success,meta={}){return (await api("finalizeCredit")({operationId,success,...meta})).data}
};
window.dispatchEvent(new Event("packtook-firebase-ready"));
