/* Read-only deployment verification. Never builds, deploys or writes remote data. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),expected=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
const args=process.argv.slice(2),worker=args.includes('--worker'),attemptArg=args.find(a=>a.startsWith('--attempts='));
for(const arg of args)if(arg!=='--worker'&&!/^--attempts=\d+$/.test(arg))throw Error('Unknown verification option: '+arg);
const attempts=Number(attemptArg?.split('=')[1]||1);if(!Number.isInteger(attempts)||attempts<1||attempts>30)throw Error('Attempts must be 1..30.');
const origin=worker?'https://solar-time.keg0320.workers.dev/':'https://solartime.app/';
const files=['index.html','styles.css','src/app.js','src/astronomy-engine.min.js','src/astro.js','src/ui-runtime.js','src/localization.js','src/language-data.js','src/release-notes.js','src/surface-style.js','src/surface.js','src/renderer.js','src/performance.js','src/visual-effects.js','src/sky.js','src/page-runtime.js','src/runtime-optimizations.css',...fs.readdirSync(path.join(root,'src/locales')).filter(f=>f.endsWith('.json')).map(f=>'src/locales/'+f)];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function request(relative){const url=new URL(relative,origin);url.searchParams.set('verify',expected.version+'-'+expected.revision+'-'+Date.now());const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(relative+' returned HTTP '+response.status);return {bytes:Buffer.from(await response.arrayBuffer()),response};}
async function verify(){
 const manifest=JSON.parse((await request('version.json')).bytes.toString('utf8'));if(manifest.version!==expected.version||manifest.revision!==expected.revision)throw Error('Public build is '+manifest.version+' '+manifest.revision+', expected '+expected.version+' '+expected.revision);
 const verified={};
 for(let start=0;start<files.length;start+=6)await Promise.all(files.slice(start,start+6).map(async file=>{const remote=await request(file),local=fs.readFileSync(path.join(root,file));if(!remote.bytes.equals(local))throw Error('Published bytes differ: '+file);verified[file]=digest(remote.bytes);}));
 const icon=await request('https://solar-time.keg0320.workers.dev/media/releases/content/ui/apple-touch-icon.png?v=0.46-r3');
 if(!(icon.response.headers.get('content-type')||'').startsWith('image/png')||!icon.bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))||icon.bytes.length<24||icon.bytes.readUInt32BE(16)!==180||icon.bytes.readUInt32BE(20)!==180)throw Error('Official Apple icon delivery is not a 180x180 PNG.');
 return {origin,build:manifest,checkedAt:new Date().toISOString(),files:verified,officialAppleIcon:{status:icon.response.status,contentType:icon.response.headers.get('content-type'),width:180,height:180,sha256:digest(icon.bytes)},limitations:'HTTP source/MIME verification, not a physical-device render test.'};
}
(async()=>{let report;for(let attempt=1;attempt<=attempts;attempt++){try{report=await verify();break;}catch(error){console.error('Verification '+attempt+'/'+attempts+': '+error.message);if(attempt===attempts)throw error;await new Promise(resolve=>setTimeout(resolve,10000));}}const file=path.join(root,'.cloudflare',worker?'worker-verification.json':'public-verification.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log('VERIFIED '+origin+' v'+expected.version+' '+expected.revision+'; '+Object.keys(report.files).length+' files byte-matched; official Apple PNG HTTP 200.');})().catch(error=>{console.error('PUBLIC VERIFICATION FAILED: '+error.message);process.exitCode=1;});
