/* Shared deployment implementation for Actions and both local CLI aliases. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {uploadWindowsHelper}=require('./upload-windows-helper.cjs'),{verifyShutdown}=require('./verify-shutdown.cjs');
const ACCOUNT='4640527a19614f7b65a034f422704b64';
function options(args){
 const out={apply:false,ci:false,phase:'all'};
 for(const arg of args){if(arg==='--apply')out.apply=true;else if(arg==='--ci')out.ci=true;else if(/^--phase=(build|helper|worker|all)$/.test(arg))out.phase=arg.slice(8);else throw Error('Unknown deployment option: '+arg);}
 return out;
}
function validateTarget(root,env){
 if(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_ACCOUNT_ID!==ACCOUNT)throw Error('Wrong Cloudflare account.');
 const config=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
 if(config.name!=='solar-time'||config.r2_buckets?.find(b=>b.binding==='SOLAR_TIME_MEDIA')?.bucket_name!=='solar-time-media')throw Error('Unexpected Worker or R2 bucket.');
}
function run(root,file,args=[]){
 const result=spawnSync(process.execPath,[path.join(root,file),...args],{cwd:root,stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT}});
 if(result.error)throw result.error;if(result.status!==0)throw Error(file+' failed; deployment stopped.');
}
function localChecks(root){
 run(root,'tools/run-tests.cjs');
 const python=process.env.PYTHON||'python';
 for(const file of ['tests/browser/alarm-audio-regression.py','tests/browser/diagnostics-selftest.py','tests/browser/ui-regression.py','tests/browser/tiny-star-regression.py']){
  const result=spawnSync(python,[file],{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)throw Error('Local browser verification failed. Install Python + Playwright Chromium, or use the verified GitHub Actions deployment.');
 }
 if(process.platform==='win32'){
  const shell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const result=spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','tests/windows-shutdown.integration.ps1'],{cwd:root,stdio:'inherit'});
  if(result.error||result.status!==0)throw Error('Windows helper mock checks failed.');
 }
}
async function main(args=process.argv.slice(2)){
 const root=path.resolve(__dirname,'..'),opt=options(args);validateTarget(root,process.env);
 if(!opt.apply){console.log(JSON.stringify({account:ACCOUNT,worker:'solar-time',bucket:'solar-time-media',...opt,writes:false,steps:['verify','build','skip identical helper or upload and check','Worker publish','receipt round trip','public byte verification']},null,2));console.log('No changes made. Use --apply for an explicit deployment.');return;}
 if(opt.ci){if(process.env.GITHUB_ACTIONS!=='true')throw Error('--ci is restricted to verified GitHub Actions.');run(root,'tools/ci-gate.cjs');}
 else localChecks(root);
 if(['all','build'].includes(opt.phase)){run(root,'tools/build-cloudflare.cjs');run(root,'tools/build-pages.cjs');}
 if(['all','helper'].includes(opt.phase)){
  const report=await uploadWindowsHelper(root,{apply:true});console.log('Helper objects uploaded: '+report.uploaded.length+'; unchanged objects skipped: '+report.skipped.length);
  await verifyShutdown({health:false});
 }
 if(['all','worker'].includes(opt.phase)){
  if(!fs.existsSync(path.join(root,'.cloudflare/site/index.html')))throw Error('Build the verified site before publishing.');
  run(root,'node_modules/wrangler/bin/wrangler.js',['deploy']);
  run(root,'tools/verify-shutdown.cjs',['--roundtrip']);
  run(root,'tools/verify-public-release.cjs',['--worker','--attempts=6']);
 }
 if(opt.phase==='all')console.log('Cloudflare verified. Pages must publish the same commit. Reinstall the PC helper only when its installed hash differs; app-only updates do not require reinstalling.');
}
if(require.main===module)main().catch(e=>{console.error('DEPLOYMENT NOT COMPLETE: '+e.message);process.exitCode=1;});
module.exports={main,options,validateTarget};
