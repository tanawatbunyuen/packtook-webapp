#!/usr/bin/env node
"use strict";
/*
 * P170 - independently authored offline JWT verifier test candidate.
 * Uses ONLY node:crypto, deterministic claim expectations and ephemeral RSA keys.
 * Not Firebase Admin SDK and not a production Firebase token verifier.
 * No network, no real credentials, no actual Firebase user/accounts.
 */
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const p166=require("./p166-owner-claim-negative.js");
const SOURCE=path.join(__dirname,"..","functions","index.js");
const EXPECTED_SOURCE="92262ea2fbbb941188937d72f0eea74a735d2bf3";
const PROJECT="demo-packtook-owner-jwt-p170";
const ISSUER="https://securetoken.google.com/"+PROJECT;
const KID="p170-ephemeral-rsa-only";
const NOW=1795500000; // fixed test clock, not real current time.
const b64=o=>Buffer.from(typeof o==="string"?o:JSON.stringify(o)).toString("base64url");
const pack=(h,p,sig)=>b64(h)+"."+b64(p)+"."+sig;

class JWTCheckError extends Error{
  constructor(kind){super(kind);this.kind=kind;}
}
function safeObject(base64){
  if(typeof base64!=="string"||!base64||base64.length>8192||
     !/^[A-Za-z0-9_-]+$/.test(base64))
    throw new JWTCheckError("MALFORMED");
  let bytes;
  try{bytes=Buffer.from(base64,"base64url");}
  catch{throw new JWTCheckError("MALFORMED");}
  if(bytes.length>6144||bytes.toString("base64url")!==base64)
    throw new JWTCheckError("MALFORMED");
  let out;
  try{out=JSON.parse(bytes.toString("utf8"));}
  catch{throw new JWTCheckError("MALFORMED");}
  if(!out||typeof out!=="object"||Array.isArray(out))
    throw new JWTCheckError("MALFORMED");
  return out;
}
function verifyJWT(jwt,publicKey,clock=NOW){
  if(typeof jwt!=="string"||jwt.length>16000)
    throw new JWTCheckError("MALFORMED");
  const parts=jwt.split(".");
  if(parts.length!==3||!parts[2]||!/^[A-Za-z0-9_-]+$/.test(parts[2]))
    throw new JWTCheckError("MALFORMED");
  const header=safeObject(parts[0]),claims=safeObject(parts[1]);
  if(header.alg!=="RS256"||header.kid!==KID||
     (header.typ!==undefined&&header.typ!=="JWT"))
    throw new JWTCheckError("UNTRUSTED_HEADER");
  const signature=Buffer.from(parts[2],"base64url");
  if(signature.toString("base64url")!==parts[2])
    throw new JWTCheckError("MALFORMED");
  const signedPart=parts[0]+"."+parts[1];
  let valid=false;
  try{valid=crypto.verify("RSA-SHA256",Buffer.from(signedPart),
        {key:publicKey,padding:crypto.constants.RSA_PKCS1_PADDING},signature);}
  catch{throw new JWTCheckError("INVALID_SIGNATURE");}
  if(!valid)throw new JWTCheckError("INVALID_SIGNATURE");
  if(claims.iss!==ISSUER||claims.aud!==PROJECT||
     typeof claims.sub!=="string"||claims.sub.length<1||claims.sub.length>128||
     typeof claims.iat!=="number"||!Number.isSafeInteger(claims.iat)||
     typeof claims.exp!=="number"||!Number.isSafeInteger(claims.exp)||
     claims.exp<=clock||claims.iat>clock||claims.iat>=claims.exp||
     (claims.nbf!==undefined&&
        (!Number.isSafeInteger(claims.nbf)||claims.nbf>clock)))
    throw new JWTCheckError("INVALID_REGISTERED_CLAIM");
  return claims;
}
function ownerDecision(jwt,publicKey,clock=NOW){
  let claims;
  try{claims=verifyJWT(jwt,publicKey,clock);}
  catch(err){
    // Authentication-layer failures are HTTP 401; never reclassify as 403.
    if(err instanceof JWTCheckError)return {http:401,status:"UNAUTHENTICATED",allowed:false};
    throw err;
  }
  if(claims.email_verified!==true||claims.packtookPlatformOwner!==true)
    return {http:403,status:"PERMISSION_DENIED",allowed:false};
  return {http:200,status:"ALLOW",allowed:true};
}
function signer(privateKey){
  return (claims,header={alg:"RS256",kid:KID,typ:"JWT"})=>{
    const head=b64(header),body=b64(claims);
    const signing=head+"."+body;
    return signing+"."+crypto.sign("RSA-SHA256",Buffer.from(signing),
       {key:privateKey,padding:crypto.constants.RSA_PKCS1_PADDING}).toString("base64url");
  };
}
function baseClaims(){
  return {iss:ISSUER,aud:PROJECT,sub:"synthetic-owner",iat:NOW-60,
    exp:NOW+900,email_verified:true,packtookPlatformOwner:true};
}
function run(){
  const source=fs.readFileSync(SOURCE);
  if(p166.gitBlob(source)!==EXPECTED_SOURCE)
    throw Error("P170_BLOCK=BACKEND_SOURCE_DRIFT");
  const pinned=p166.auditedFragments(source.toString("utf8"));
  if(!pinned.owner.includes("req.auth.token.packtookPlatformOwner!==true"))
    throw Error("P170_BLOCK=OWNER_CLAIM_SOURCE_DRIFT");
  console.log("P170_MODE=OFFLINE_EPHEMERAL_RSA_JWT_BOUNDARY_CANDIDATE");
  console.log("P170_PINNED_BACKEND_SOURCE=PASS");
  const kp=crypto.generateKeyPairSync("rsa",{modulusLength:2048,
    publicKeyEncoding:{type:"spki",format:"pem"},
    privateKeyEncoding:{type:"pkcs8",format:"pem"}});
  const sign=signer(kp.privateKey);
  const base=baseClaims();
  const alt=crypto.generateKeyPairSync("rsa",{modulusLength:2048,
    publicKeyEncoding:{type:"spki",format:"pem"},
    privateKeyEncoding:{type:"pkcs8",format:"pem"}});
  const cases=[
    ["VALID_SYNTHETIC_OWNER",sign(base),200,"ALLOW"],
    ["FALSE_OWNER_CLAIM",sign({...base,packtookPlatformOwner:false}),403,"PERMISSION_DENIED"],
    ["STRING_OWNER_CLAIM",sign({...base,packtookPlatformOwner:"true"}),403,"PERMISSION_DENIED"],
    ["MISSING_OWNER_CLAIM",sign((({packtookPlatformOwner,...r})=>r)(base)),403,"PERMISSION_DENIED"],
    ["UNVERIFIED_EMAIL",sign({...base,email_verified:false}),403,"PERMISSION_DENIED"],
    ["WRONG_AUDIENCE",sign({...base,aud:"demo-other-project"}),401,"UNAUTHENTICATED"],
    ["WRONG_ISSUER",sign({...base,iss:"https://example.invalid"}),401,"UNAUTHENTICATED"],
    ["EMPTY_SUBJECT",sign({...base,sub:""}),401,"UNAUTHENTICATED"],
    ["EXPIRED",sign({...base,exp:NOW-1}),401,"UNAUTHENTICATED"],
    ["FUTURE_IAT",sign({...base,iat:NOW+1}),401,"UNAUTHENTICATED"],
    ["FUTURE_NBF",sign({...base,nbf:NOW+1}),401,"UNAUTHENTICATED"],
    ["UNKNOWN_KEY_ID",sign(base,{alg:"RS256",kid:"unknown"}),401,"UNAUTHENTICATED"],
    ["NONE_ALGORITHM",pack({alg:"none",kid:KID},base,"not-a-signature"),401,"UNAUTHENTICATED"],
    ["HS256_ALGORITHM",pack({alg:"HS256",kid:KID},base,"not-a-signature"),401,"UNAUTHENTICATED"],
    ["WRONG_SIGNING_KEY",signer(alt.privateKey)(base),401,"UNAUTHENTICATED"],
    ["TAMPERED_CLAIM",(()=>{const v=sign(base).split(".");v[1]=b64({...base,packtookPlatformOwner:false});return v.join(".")})(),401,"UNAUTHENTICATED"],
    ["MALFORMED_TOKEN","invalid-p168-demo-token",401,"UNAUTHENTICATED"],
    ["MISSING_SIGNATURE",sign(base).split(".").slice(0,2).join(".")+".",401,"UNAUTHENTICATED"],
  ];
  let passed=0;
  for(const [name,token,http,status] of cases){
    const d=ownerDecision(token,kp.publicKey);
    const ok=d.http===http&&d.status===status&&d.allowed===(http===200);
    console.log("P170_"+name+"="+(ok?"PASS":"FAIL"));
    if(!ok)throw Error("P170_BLOCK=JWT_CASE_FAILED");
    passed++;
  }
  console.log("P170_SYNTHETIC_JWT_CASES="+passed+"/"+cases.length+"_PASS");
  console.log("P170_SIGNATURE_VERIFIER_TESTED=INDEPENDENT_OFFLINE_CANDIDATE_ONLY");
  console.log("P170_FIREBASE_ADMIN_VERIFY_ID_TOKEN_EXECUTED=FALSE");
  console.log("P170_PRIVATE_KEYS_SAVED=FALSE P170_REAL_CREDENTIALS=0");
  console.log("P170_FIREBASE_EMULATOR_CALLS=0 P170_CLOUD_CALLS=0 P170_DEPLOYS=0");
  console.log("P170_PRODUCTION_AUTHENTICATION_ATTESTED=FALSE");
  console.log("P170_DECISION=OFFLINE_JWT_BOUNDARY_CANDIDATE_PASS_PRODUCTION_NO_GO");
}
if(require.main===module){
  try{run();}
  catch(err){console.log(String(err.message).startsWith("P170_BLOCK=")?
    err.message:"P170_BLOCK=OFFLINE_CANDIDATE_FAILED");process.exitCode=1;}
}
module.exports={JWTCheckError,safeObject,verifyJWT,ownerDecision,signer,baseClaims,run,PROJECT,ISSUER,KID,NOW};
