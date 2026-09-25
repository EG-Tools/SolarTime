'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{selectVerification,assertJobs,assertMain,REQUIRED}=require('../tools/ci-gate.cjs');
const sha='a'.repeat(40),base={id:1,head_sha:sha,head_branch:'main',head_repository:{full_name:'EG-Tools/SolarTime'},event:'push',path:'.github/workflows/verify.yml',status:'completed',conclusion:'success'};
test('production requires the latest successful exact-main verification, not a PR or an older pass',()=>{
 assert.equal(selectVerification([base],sha).id,1);
 for(const change of [{head_sha:'b'.repeat(40)},{head_branch:'other'},{event:'pull_request'},{head_repository:{full_name:'other/SolarTime'}},{status:'in_progress'},{conclusion:'failure'},{conclusion:'skipped'}])assert.throws(()=>selectVerification([{...base,...change}],sha));
 assert.throws(()=>selectVerification([base,{...base,id:2,conclusion:'failure'}],sha));
 assert.equal(selectVerification([{...base,event:'workflow_dispatch'}],sha).id,1);
});
test('all platform, browser and aggregate jobs must pass; a skipped browser never authorizes deployment',()=>{
 const jobs=REQUIRED.map(name=>({name,status:'completed',conclusion:'success'}));assertJobs(jobs);
 for(let i=0;i<jobs.length;i++)assert.throws(()=>assertJobs(jobs.filter((_,j)=>i!==j)));
 assert.throws(()=>assertJobs(jobs.map(j=>j.name==='browser (ui)'?{...j,conclusion:'skipped'}:j)));
 assertMain(sha,sha);assert.throws(()=>assertMain(sha,'b'.repeat(40)));
});
test('one candidate workflow owns the full matrix, independent browser suites and Windows native checks',()=>{
 const text=fs.readFileSync(path.join(root,'.github/workflows/verify.yml'),'utf8');
 assert.match(text,/os: \[ubuntu-latest, windows-latest\]/);assert.match(text,/node: \['22', '24'\]/);assert.match(text,/suite: \[ui, tiny-star\]/);assert.match(text,/windows-shutdown.integration.ps1/);assert.match(text,/if: always\(\)/);assert.doesNotMatch(text,/secrets\.|verify-public-release/);
 for(const file of ['alarm-music-verification.yml','shutdown-verification.yml'])assert.equal(fs.existsSync(path.join(root,'.github/workflows',file)),false);
});
test('manual and automatic production paths share the guard and never grant PRs cloud credentials',()=>{
 const text=fs.readFileSync(path.join(root,'.github/workflows/deploy-cloudflare.yml'),'utf8');
 assert.match(text,/run: node tools\/ci-gate.cjs/);assert.match(text,/actions\/deploy-pages@[a-f0-9]{40}/);assert.doesNotMatch(text,/pull_request_target|\n  pull_request:/);assert.match(text,/conclusion == 'success'/);
 const audit=fs.readFileSync(path.join(root,'.github/workflows/public-shutdown-delivery.yml'),'utf8');assert.doesNotMatch(audit,/\n  pull_request:|\n  push:/);
});
test('release browser checks read manifest and source items instead of fixed latest versions and click counts',()=>{
 const ui=fs.readFileSync(path.join(root,'tests/browser/ui-regression.py'),'utf8'),history=fs.readFileSync(path.join(root,'tests/browser/release_history.py'),'utf8');
 assert.doesNotMatch(ui,/inner_text\(\)==['"]v0\.56/);assert.match(ui,/verify_history/);assert.match(history,/version.json/);assert.match(history,/all_inner_texts/);assert.match(history,/historical content/);
});
test('Pages package preserves the public runtime graph and excludes maintenance files',()=>{
 const {buildPages}=require('../tools/build-pages.cjs'),{releaseFiles}=require('../tools/release-files.cjs');
 const site=buildPages(root);for(const name of releaseFiles(root))assert.ok(fs.existsSync(path.join(site,name)),name);
 for(const name of ['.github','tests','tools','windows','package-lock.json'])assert.equal(fs.existsSync(path.join(site,name)),false);
 assert.ok(fs.existsSync(path.join(site,'.nojekyll')));
 const publicAssets=fs.readFileSync(path.join(site,'src/assets.js'),'utf8');assert.match(publicAssets,/https:\/\/solar-time\.keg0320\.workers\.dev\/media\//);
});
