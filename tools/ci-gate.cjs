/* Read-only authorization: deploy only the latest fully verified main commit. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const REPO='EG-Tools/SolarTime';
const REQUIRED=['unit (ubuntu-latest, 22)','unit (ubuntu-latest, 24)','unit (windows-latest, 22)','unit (windows-latest, 24)','browser (ui)','browser (tiny-star)','verified'];
function selectVerification(runs,sha){
 const candidates=runs.filter(r=>r.head_sha===sha&&r.head_branch==='main'&&r.head_repository?.full_name===REPO&&['push','workflow_dispatch'].includes(r.event)&&r.path==='.github/workflows/verify.yml').sort((a,b)=>b.id-a.id);
 const run=candidates[0];
 if(!run||run.status!=='completed'||run.conclusion!=='success')throw Error('The latest Verify Solar Time run for this exact main commit must finish successfully. Run Verify Solar Time on main first.');
 return run;
}
function assertJobs(jobs){
 for(const name of REQUIRED){const job=jobs.find(j=>j.name===name);if(!job||job.status!=='completed'||job.conclusion!=='success')throw Error('Required verification did not pass: '+name);}
}
function assertMain(sha,current){if(!/^[a-f0-9]{40}$/.test(sha)||sha!==current)throw Error('Refusing to deploy a superseded or invalid main commit.');}
async function main(){
 if(process.env.GITHUB_REPOSITORY!==REPO)throw Error('Unexpected repository.');
 const token=process.env.GH_TOKEN;if(!token)throw Error('GitHub verification token is missing.');
 const sha=process.env.TARGET_SHA||process.env.GITHUB_SHA;
 const get=async endpoint=>{const response=await fetch('https://api.github.com/repos/'+REPO+endpoint,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('GitHub verification request failed: HTTP '+response.status+' at '+endpoint.split('?')[0]);return response.json();};
 assertMain(sha,(await get('/git/ref/heads/main')).object.sha);
 if(process.argv.includes('--current-only'))return;
 const run=selectVerification((await get('/actions/workflows/verify.yml/runs?head_sha='+sha+'&per_page=100')).workflow_runs,sha);
 const jobs=[];for(let page=1;page<=10;page++){const batch=await get('/actions/runs/'+run.id+'/jobs?filter=latest&per_page=100&page='+page);jobs.push(...batch.jobs);if(jobs.length>=batch.total_count)break;}
 assertJobs(jobs);
 const pages=await get('/pages');
 const report={sha,run:run.id,required:REQUIRED,pagesMode:pages.build_type,checkedAt:new Date().toISOString()};
 const file=path.join(__dirname,'../.cloudflare/ci-gate.json');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
 if(pages.build_type!=='workflow')throw Error('PAGES_SETTING_REQUIRED: Settings > Pages > Build and deployment > Source must be GitHub Actions. The connected editor cannot change administration settings. Do not change the custom domain. No deployment was performed.');
 if(!process.env.CLOUDFLARE_API_TOKEN)throw Error('Cloudflare token is missing. No deployment was performed.');
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'sha='+sha+'\nverification_run='+run.id+'\n');
 console.log('Verified main commit '+sha+' using required checks from run '+run.id+'. Pages source is GitHub Actions.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'Deployment blocked: '+e.message+'\n');process.exitCode=1;});
module.exports={selectVerification,assertJobs,assertMain,REQUIRED};
