'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'p140-firebase-emulator.json'),'utf8'));
for (const key of ['auth','firestore','hub']) {
 assert.equal(config.emulators[key].host,'127.0.0.1',key+' must never use localhost/IPv6');
}
assert.equal(config.emulators.hub.port,14400);
assert.equal(config.emulators.auth.port,19099);
assert.equal(config.emulators.firestore.port,18080);
assert.equal(config.emulators.ui.enabled,false);
assert(!Object.hasOwn(config.emulators,'functions'));
assert.equal(config.firestore.rules,'p140-firestore-deny-all.rules');
const rules=path.join(__dirname,config.firestore.rules);
assert(fs.existsSync(rules));
assert.match(fs.readFileSync(rules,'utf8'),/allow read,\s*write:\s*if false\s*;/);
console.log('P150_HUB_IPV4_EXPLICIT=PASS');
console.log('P150_AUTH_FIRESTORE_IPV4=PASS');
console.log('P150_DENY_ALL_RULES_AND_NO_FUNCTIONS=PASS');
const starter=fs.readFileSync(path.join(__dirname,'p141-demo-emulator-start.sh'),'utf8');
assert(starter.includes('for port in 18080 19099 14400; do'));
assert(starter.includes('p=[18080,19099,14400]'));
console.log('P150_STARTER_CHECKS_ALL_THREE_PORTS=PASS');
console.log('P150_OFFLINE_CHECKS=4/4_PASS');
console.log('P150_EMULATOR_STARTS=0 P150_CLOUD_WRITES=0 P150_DEPLOYS=0');
