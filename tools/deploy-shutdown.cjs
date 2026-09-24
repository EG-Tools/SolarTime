/* Explicit coordinated deployment: tests -> helper upload -> byte check -> Worker -> verification. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{verifyShutdown}=require('./verify-shutdown.cjs');
const root=path.resolve(__dirname,'..'),account='4640527a19614f7b65a034f422704b64',args=process.argv.slice(2);
for(const arg of args)if(arg!=='--apply')throw Error('Unknown option: '+arg);
if(process.env.CLOUDFLARE_ACCOUNT_ID&&process.env.CLOUDFLARE_ACCOUNT_ID!==account)throw Error('Wrong Cloudflare account.');
const config=JSON.parse(fs.readFileSync(path.join(root,'wrangler.jsonc'),'utf8'));
if(config.name!=='solar-time'||config.r2_buckets?.find(b=>b.binding==='SOLAR_TIME_MEDIA')?.bucket_name!=='solar-time-media')throw Error('Unexpected Worker or R2 bucket.');
if(!args.includes('--apply')){
 console.log(JSON.stringify({account,worker:'solar-time',bucket:'solar-time-media',steps:['run tests','build site','upload versioned CMD and source','verify remote SHA-256','deploy Worker and site assets','verify receipt API and published Worker files'],writes:false},null,2));
 console.log('No changes made. Use --apply after reviewing the target account and scope.');process.exit(0);
}
function run(file,extra=[]){const result=spawnSync(process.execPath,[path.join(root,file),...extra],{cwd:root,stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:account}});if(result.error)throw result.error;if(result.status!==0)throw Error(file+' failed; deployment stopped.');}
(async()=>{
 run('tools/run-tests.cjs');run('tools/build-cloudflare.cjs');
 run('tools/upload-windows-helper.cjs',['--apply']);
 await verifyShutdown({health:false});
 run('node_modules/wrangler/bin/wrangler.js',['deploy']);
 const report=await verifyShutdown();
 run('tools/verify-public-release.cjs',['--worker','--attempts=6']);
 fs.writeFileSync(path.join(root,'.cloudflare/shutdown-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Cloudflare deployment verified. GitHub Pages must serve this same commit before rollout is complete. Reinstall the PC helper.');
})().catch(error=>{console.error('DEPLOYMENT NOT COMPLETE: '+error.message);process.exitCode=1;});
