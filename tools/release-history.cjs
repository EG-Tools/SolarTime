/* Release-only rolling retention. Dry-run by default; no version bump/upload. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{atomicWrite}=require('./asset-pipeline.cjs'),i18n=require('./i18n.cjs');
const json=v=>JSON.stringify(v,null,2)+'\n';
function plan(releases,archive,codes){
 const seen=new Set();let previous=Infinity;
 for(const row of [...releases,...archive]){
  if(!/^0\.\d{1,2}$/.test(row.version)||seen.has(row.version)||Number(row.version)>=previous)throw Error('Duplicate/unsorted release '+row.version);
  const items=row.localized?.kor||row.items;
  if(!Array.isArray(items)||!items.length||items.some(s=>typeof s!=='string'||!s.trim()))throw Error('Missing Korean archive text '+row.version);
  seen.add(row.version);previous=Number(row.version);
 }
 const recent=releases.slice(0,10),removed=releases.slice(10),missingTranslations=[];
 for(const r of recent)for(const code of codes){const items=r.localized[code];if(!Array.isArray(items)||items.length!==r.localized.kor.length||items.some(s=>typeof s!=='string'||!s.trim()))missingTranslations.push(r.version+':'+code);}
 const archived=[...removed.map(r=>({version:r.version,date:r.date,items:[...r.localized.kor]})),...archive];
 return {recent,archived,removed:removed.map(r=>r.version),missingTranslations};
}
function run(root,{write=false}={}){
 const data=i18n.compile(root),p=plan(data.releases,data.archive,data.codes);
 const report={kept:p.recent.map(r=>r.version),archived:p.removed,missingTranslations:p.missingTranslations,writes:write};
 if(!write)return report;
 if(p.missingTranslations.length)throw Error('Translate only these remaining release entries before writing: '+p.missingTranslations.join(', '));
 const legacyFile='i18n/legacy-allowlist.json',legacy=JSON.parse(fs.readFileSync(path.join(root,legacyFile),'utf8'));
 const removed=new Set(p.removed);
 for(const key of Object.keys(legacy.inherited)){const version=key.match(/:release\.(.+)$/)?.[1];if(removed.has(version))delete legacy.inherited[key];}
 const planned={...data,releases:p.recent,archive:p.archived};
 const outputs=i18n.outputs(root,planned).out;
 const changes=new Map([
  // Archive FIRST: never delete translated records before Korean text is saved.
  ['i18n/releases-archive-ko.json',json(p.archived)],
  ['i18n/releases.json',json(p.recent)],[legacyFile,json(legacy)],...outputs
 ]);
 const changed=[...changes].filter(([file,text])=>fs.readFileSync(path.join(root,file),'utf8')!==text);
 if(changed.length){
  const dir=path.join(root,'.cloudflare/release-history-backups');fs.mkdirSync(dir,{recursive:true});
  const backup=path.join(dir,Date.now()+'.json');
  atomicWrite(backup,json(Object.fromEntries(changed.map(([file])=>[file,fs.readFileSync(path.join(root,file),'utf8')]))));
  try{for(const [file,text] of changed)atomicWrite(path.join(root,file),text);i18n.sync(root);}
  catch(error){for(const [file,text] of Object.entries(JSON.parse(fs.readFileSync(backup,'utf8'))))atomicWrite(path.join(root,file),text);throw error;}
  report.backup=backup;
 }
 require('./code-revisions.cjs').sync(root,{write:true});
 report.changed=changed.map(([file])=>file);return report;
}
if(require.main===module){try{const args=process.argv.slice(2);if(args.some(a=>a!=='--write'))throw Error('Unknown release-history option');console.log(json(run(path.resolve(__dirname,'..'),{write:args.includes('--write')})));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={plan,run};
