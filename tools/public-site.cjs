/* Build either public origin from one canonical release graph. Host-specific
 * files are added explicitly so Worker and Pages cannot silently drift. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {atomicWrite,projectConfig,runtimeScripts}=require('./asset-pipeline.cjs');
const {releaseFiles}=require('./release-files.cjs');

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const WORKER_HEADERS='/styles.css\n  Cache-Control: public, max-age=3600, must-revalidate\n/version.json\n  Cache-Control: no-store\n/index.html\n  Cache-Control: no-cache\n/src/locales/*\n  Access-Control-Allow-Origin: *\n  Cross-Origin-Resource-Policy: cross-origin\n/src/*\n  Cache-Control: public, max-age=3600, must-revalidate\n';
function inside(parent,child){const relative=path.relative(parent,child);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);}
function packagePublicSite(root,{output,cdnBase,workerHeaders=false,noJekyll=false,manifest=null,deployment=null,synchronize=true}={}){
 if(!output)throw Error('Public site output is required.');
 if(synchronize){require('./i18n.cjs').sync(root);require('./code-revisions.cjs').sync(root);}
 const configured=projectConfig(root);manifest=manifest||readJson(path.join(root,'assets/manifest.json'));deployment=deployment||configured.deployment;
 if(manifest.revision!==configured.revision)throw Error('Asset manifest revision does not match assets/revision.json.');
 if(Object.values(manifest.materials).some(entry=>entry.localPreview))throw Error('Publish preview material tiers before preparing a release site.');
 const cloudflareRoot=path.resolve(root,'.cloudflare'),site=path.resolve(output);
 if(!inside(cloudflareRoot,site))throw Error('Site output escaped .cloudflare.');
 const files=releaseFiles(root),scripts=runtimeScripts(root,manifest,deployment,{cdnBase:cdnBase==null?deployment.cdnBase:cdnBase});
 fs.rmSync(site,{recursive:true,force:true});fs.mkdirSync(site,{recursive:true});
 for(const file of files){
  const destination=path.resolve(site,file);if(!inside(site,destination))throw Error('Unsafe public file path: '+file);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  if(file==='src/assets.js')atomicWrite(destination,scripts.assets);
  else if(file==='src/sky-asset.js')atomicWrite(destination,scripts.sky);
  else if(file==='src/local-effect-atlases.js')atomicWrite(destination,scripts.localEffects);
  else fs.copyFileSync(path.resolve(root,file),destination);
 }
 if(workerHeaders)atomicWrite(path.join(site,'_headers'),WORKER_HEADERS);
 if(noJekyll)atomicWrite(path.join(site,'.nojekyll'),'');
 return {site,manifest,deployment,files};
}
module.exports={WORKER_HEADERS,packagePublicSite};
