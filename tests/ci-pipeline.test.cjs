'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{selectVerification,assertJobs,assertMain,REQUIRED}=require('../tools/ci-gate.cjs');
const sha='a'.repeat(40),base={id:1,head_sha:sha,head_branch:'main',head_repository:{full_name:'LyriKey/SolarTime'},event:'push',path:'.github/workflows/verify.yml',status:'completed',conclusion:'success'};
function tree(dir,prefix=''){return fs.readdirSync(path.join(dir,prefix),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?tree(dir,path.join(prefix,entry.name)):[path.join(prefix,entry.name).split(path.sep).join('/')]).sort();}
test('production requires the latest successful exact-main verification, not a PR or an older pass',()=>{
 assert.equal(selectVerification([base],sha).id,1);
 for(const change of [{head_sha:'b'.repeat(40)},{head_branch:'other'},{event:'pull_request'},{head_repository:{full_name:'other/SolarTime'}},{head_repository:{full_name:'EG-Tools/SolarTime'}},{status:'in_progress'},{conclusion:'failure'},{conclusion:'skipped'}])assert.throws(()=>selectVerification([{...base,...change}],sha));
 assert.throws(()=>selectVerification([base,{...base,id:2,conclusion:'failure'}],sha));
 assert.equal(selectVerification([{...base,event:'workflow_dispatch'}],sha).id,1);
});
test('all platform, browser and aggregate jobs must pass; a skipped browser never authorizes deployment',()=>{
 const jobs=REQUIRED.map(name=>({name,status:'completed',conclusion:'success'}));assertJobs(jobs);
 for(let i=0;i<jobs.length;i++)assert.throws(()=>assertJobs(jobs.filter((_,j)=>i!==j)));
 for(const name of REQUIRED.filter(name=>name.startsWith('browser ')))assert.throws(()=>assertJobs(jobs.map(j=>j.name===name?{...j,conclusion:'skipped'}:j)));
 assertMain(sha,sha);assert.throws(()=>assertMain(sha,'b'.repeat(40)));
});
test('one candidate workflow owns the full matrix, independent browser suites and Windows native checks',()=>{
 const text=fs.readFileSync(path.join(root,'.github/workflows/verify.yml'),'utf8');
 assert.match(text,/name: unit \(ubuntu-latest, 24\)/);assert.match(text,/compatibility:/);assert.match(text,/- os: ubuntu-latest\s+node: '22'/);assert.equal((text.match(/- os: windows-latest/g)||[]).length,2);assert.match(text,/needs: \[unit, compatibility, browser, recovery\]/);
 assert.equal((text.match(/npm audit --audit-level=high/g)||[]).length,1,'the canonical unit job owns one vulnerability gate');
 assert.match(text,/suite: \[opening, features, desktop, mobile, installed, tiny-star\]/);assert.match(text,/windows-shutdown.integration.ps1/);assert.match(text,/if: always\(\)/);assert.doesNotMatch(text,/secrets\.|verify-public-release/);
 for(const file of ['alarm-music-verification.yml','shutdown-verification.yml'])assert.equal(fs.existsSync(path.join(root,'.github/workflows',file)),false);
});
test('manual and automatic production paths share the guard and never grant PRs cloud credentials',()=>{
 const text=fs.readFileSync(path.join(root,'.github/workflows/deploy-cloudflare.yml'),'utf8');
 assert.ok(text.includes("github.repository == '"+base.head_repository.full_name+"'"),'workflow and verification guard must use the same renamed repository');
 assert.match(text,/run: node tools\/ci-gate.cjs/);assert.match(text,/actions\/deploy-pages@[a-f0-9]{40}/);assert.doesNotMatch(text,/pull_request_target|\n  pull_request:/);assert.match(text,/conclusion == 'success'/);
 assert.match(text,/deployment-recovery\.cjs capture/);assert.match(text,/deployment-recovery\.cjs report/);assert.doesNotMatch(text,/deployment-recovery\.cjs restore/);
 const audit=fs.readFileSync(path.join(root,'.github/workflows/public-shutdown-delivery.yml'),'utf8');assert.doesNotMatch(audit,/\n  pull_request:|\n  push:/);
});
test('release browser checks read manifest and source items instead of fixed latest versions and click counts',()=>{
 const ui=fs.readFileSync(path.join(root,'tests/browser/ui-regression.py'),'utf8'),history=fs.readFileSync(path.join(root,'tests/browser/release_history.py'),'utf8');
 assert.doesNotMatch(ui,/inner_text\(\)==['"]v0\.56/);assert.doesNotMatch(ui,/navigate_to_release\(page,['"]0\./);assert.match(ui,/verify_history/);assert.match(history,/version.json/);assert.match(history,/all_inner_texts/);assert.match(history,/historical content/);
});
test('Pages package preserves the public runtime graph and excludes maintenance files',()=>{
 const {buildPages}=require('../tools/build-pages.cjs'),{releaseFiles}=require('../tools/release-files.cjs');
 const site=buildPages(root);for(const name of releaseFiles(root))assert.ok(fs.existsSync(path.join(site,name)),name);
 for(const name of ['.github','tests','tools','windows','package-lock.json'])assert.equal(fs.existsSync(path.join(site,name)),false);
 assert.ok(fs.existsSync(path.join(site,'.nojekyll')));
 const publicAssets=fs.readFileSync(path.join(site,'src/assets.js'),'utf8');assert.match(publicAssets,/https:\/\/solar-time\.keg0320\.workers\.dev\/media\//);
});
test('Cloudflare package preserves the same public runtime graph as Pages',()=>{
 const {prepareSite}=require('../tools/cloudflare-site.cjs'),{releaseFiles}=require('../tools/release-files.cjs');
 const {site}=prepareSite(root,{cdnBase:'/media/'});for(const name of releaseFiles(root))assert.ok(fs.existsSync(path.join(site,name)),name);
});
test('Worker and Pages are packaged once from the identical canonical release graph',()=>{
 const {buildPublicSites}=require('../tools/build-public-sites.cjs'),{releaseFiles}=require('../tools/release-files.cjs'),{worker,pages}=buildPublicSites(root),expected=releaseFiles(root);
 assert.deepEqual(tree(worker).filter(file=>file!=='_headers'),expected);
 assert.deepEqual(tree(pages).filter(file=>file!=='.nojekyll'),expected);
 for(const file of expected.filter(file=>!['src/assets.js','src/sky-asset.js'].includes(file)))assert.deepEqual(fs.readFileSync(path.join(worker,file)),fs.readFileSync(path.join(pages,file)),file);
 assert.match(fs.readFileSync(path.join(worker,'src/assets.js'),'utf8'),/configuredBase="\/media\/"/);
 assert.match(fs.readFileSync(path.join(pages,'src/assets.js'),'utf8'),/configuredBase="https:\/\/solar-time\.keg0320\.workers\.dev\/media\/"/);
 assert.match(fs.readFileSync(path.join(root,'tools/deployment.cjs'),'utf8'),/run\(root,'tools\/build-public-sites\.cjs'\)/);
});
