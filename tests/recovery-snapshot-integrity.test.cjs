'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {validateSnapshots}=require('../tools/deployment-recovery.cjs');
test('recovery rejects damaged bytes, size, hash and encoding before use',()=>{
 const bytes=Buffer.from([0,255,13,10,128]),file={url:'https://solartime.app/index.html',bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 const record=f=>({previousPair:{pages:{files:[f]}}});
 assert.doesNotThrow(()=>validateSnapshots(record(file)));
 for(const changes of [{bodyBase64:'AAAA'},{bytes:99},{sha256:'0'.repeat(64)},{bodyBase64:file.bodyBase64+'!'}])assert.throws(()=>validateSnapshots(record({...file,...changes})),/integrity/);
 assert.doesNotThrow(()=>validateSnapshots(record({url:file.url,bytes:file.bytes,sha256:file.sha256})));
});
