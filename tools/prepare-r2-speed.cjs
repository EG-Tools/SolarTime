'use strict';
// One-time, checksum-guarded application of the locally tested source edits.
// No network calls, subprocesses, deployment or media operations.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');
const names=['CHANGELOG.md','index.html','src/app.js','src/release-notes.js','src/renderer.js','src/runtime-optimizations.css','tests/browser/ui-regression.py','tests/camera-motion.test.cjs','tests/cleanup-contracts.test.cjs','tests/modules.test.cjs','tests/v046-release.test.cjs','version.json'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const payload=[0,1,2,3].map(n=>fs.readFileSync(path.join(__dirname,'r2-speed.part'+n),'utf8')).join('');
const changes=JSON.parse(zlib.gunzipSync(Buffer.from(payload,'base64')).toString('utf8'));
if(changes.length!==names.length||new Set(changes.map(x=>x.path)).size!==names.length)throw Error('Unexpected edit manifest.');
const staged=[];
for(const item of changes){
 if(!names.includes(item.path))throw Error('Unexpected path: '+item.path);
 const file=path.join(root,item.path);if(!fs.lstatSync(file).isFile())throw Error('Expected regular source file.');
 let data=fs.readFileSync(file);if(sha(data)!==item.before)throw Error('Baseline mismatch: '+item.path);
 let previousEnd=0;
 for(const [start,length,text] of item.edits){if(!Number.isInteger(start)||!Number.isInteger(length)||start<previousEnd||length<0||start+length>data.length||typeof text!=='string')throw Error('Invalid edit: '+item.path);previousEnd=start+length;}
 for(const [start,length,text] of [...item.edits].reverse())data=Buffer.concat([data.subarray(0,start),Buffer.from(text,'utf8'),data.subarray(start+length)]);
 if(sha(data)!==item.after)throw Error('Tested result mismatch: '+item.path);
 staged.push({file,data,path:item.path,sha256:item.after});
}
// Validate all output bytes before touching any source.
for(const item of staged){fs.writeFileSync(item.file,item.data);console.log('VERIFIED '+item.path+' '+item.sha256);}
fs.mkdirSync(path.join(root,'.cloudflare'),{recursive:true});
fs.writeFileSync(path.join(root,'.cloudflare/r2-preparation.json'),JSON.stringify(staged.map(({path,sha256})=>({path,sha256})),null,2)+'\n');
