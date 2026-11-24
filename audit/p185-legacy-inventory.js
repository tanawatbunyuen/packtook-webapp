"use strict";
// P185: strictly read-only inventory engine; usable only by explicitly supplied read adapters.
// No migration code, grants, changes, network, or Firebase Admin initialization in this module.
const crypto=require("node:crypto");
const {previewOwnerMigration}=require("./p175-owner-migration-preview");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
async function inventory({listAccounts,lookupUser,pageSize=3,maxDocs=1000}={}){
 if(typeof listAccounts!=="function"||typeof lookupUser!=="function"||
 !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500||
 !Number.isSafeInteger(maxDocs)||maxDocs<1||maxDocs>10000)
 throw Error("P185_INVALID_READ_ADAPTERS_OR_BOUNDS");
 const counts={scanned:0,ownerVerifiedShape:0,legacyMissingOwner:0,foreignOwner:0,
  malformedOwner:0,missingAuthUser:0,disabledAuthUser:0,unverifiedAuthEmail:0,
  legacyManualReview:0,authLookupError:0,invalidAccountId:0};
 const digest=crypto.createHash("sha256");
 let cursor=null, last=null,pages=0,exhausted=false;
 while(counts.scanned<maxDocs){
  const entries=await listAccounts(cursor,Math.min(pageSize,maxDocs-counts.scanned));
  if(!Array.isArray(entries)||entries.length>pageSize)throw Error("P185_UNTRUSTED_PAGE");
  if(!entries.length){exhausted=true;break;}
  pages++;
  for(const item of entries){
   if(!item||typeof item.id!=="string"||
     (last!==null&&item.id<=last)||typeof item.data!=="object"||
     !item.data||Array.isArray(item.data))throw Error("P185_PAGE_ORDER_OR_DATA_INVALID");
   last=item.id;
   counts.scanned++;
   let type=null;
   if(!UID.test(item.id)){type="invalidAccountId";}
   else if(item.data.ownerUid!==undefined&&item.data.ownerUid!==null&&item.data.ownerUid!==""){
    if(typeof item.data.ownerUid!=="string"||!UID.test(item.data.ownerUid))type="malformedOwner";
    else if(item.data.ownerUid!==item.id)type="foreignOwner";
    else type="ownerVerifiedShape";
   }else{
    type="legacyMissingOwner";
    // Read-only Auth verification is a classification, NEVER verified independent provenance.
    try{
     const a=await lookupUser(item.id);
     if(!a||a.exists!==true)counts.missingAuthUser++;
     else if(a.disabled===true)counts.disabledAuthUser++;
     else if(a.emailVerified!==true)counts.unverifiedAuthEmail++;
     else{
      const preview=previewOwnerMigration({
       accountId:item.id,ownerUid:item.data.ownerUid,authUid:item.id,
       accountExists:true,authUserExists:true,authEmailVerified:true,
       authUserDisabled:false,legacyFormatVerified:false,
       independentAccountProvenanceVerified:false,
       evidenceTicket:null,securityReviewerApproved:false,
       accountOwnerApproved:false,conflictingOwnershipEvidence:false});
      if(preview.state!=="MANUAL_REVIEW"||preview.authorizedToWrite===true)
       throw Error("P185_UNEXPECTED_MIGRATION_PREVIEW");
      counts.legacyManualReview++;
     }
    }catch(e){
     if(e.message==="P185_UNEXPECTED_MIGRATION_PREVIEW")throw e;
     counts.authLookupError++;
    }
   }
   counts[type]++;
   // Deterministic integrity checksum over classifications, but no raw identifiers in report.
   digest.update(item.id+"|"+type+"\n");
  }
  cursor=last;
  if(entries.length<pageSize){exhausted=true;break;}
 }
 return {schema:"packtook-p185-inventory-v1",mode:"READ_ONLY",
  scanned:counts.scanned,pages,complete:exhausted,
  truncated:!exhausted,cursorAvailable:!exhausted,
  counts,inventoryFingerprint:digest.digest("hex"),
  authorizedToWrite:false,releaseGate:"G02_NO_GO",
  provenanceVerified:false,productionAttested:false};
}
module.exports={inventory};
