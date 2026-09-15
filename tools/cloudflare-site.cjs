'use strict';
const fs=require('node:fs'),path=require('node:path'),{atomicWrite,projectConfig,runtimeScripts}=require('./asset-pipeline.cjs');

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function manifestFiles(manifest){
 const files=[];
 for(const entry of Object.values(manifest.materials||{}))for(const tier of entry.tiers||[])files.push(tier.path);
 for(const tier of manifest.sky?.tiers||[])files.push(tier.path);
 for(const entry of Object.values(manifest.music||{}))files.push(entry.path);
 files.push(`releases/manifests/${manifest.revision}.json`);
 return files;
}
function prepareSite(root,media,{manifest=null,deployment=null}={}){
 const configured=projectConfig(root);manifest=manifest||readJson(path.join(root,'assets/manifest.json'));deployment=deployment||configured.deployment;
 if(manifest.revision!==configured.revision)throw Error('Asset manifest revision does not match assets/revision.json.');
 for(const relative of manifestFiles(manifest))if(!fs.existsSync(path.join(media,...relative.split('/'))))throw Error('Media bundle is missing '+relative);
 const site=path.join(root,'.cloudflare/site'),resolved=path.resolve(site),cloudflareRoot=path.resolve(root,'.cloudflare');
 if(!resolved.startsWith(cloudflareRoot+path.sep))throw Error('Site output escaped .cloudflare.');
 const scripts=runtimeScripts(root,manifest,deployment,{cdnBase:deployment.cdnBase||'/media/'});
 fs.rmSync(site,{recursive:true,force:true});fs.mkdirSync(site,{recursive:true});
 const copy=file=>{const destination=path.join(site,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);};
 for(const file of ['index.html','styles.css','version.json'])copy(file);
 for(const file of fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.js')))copy('src/'+file);
 atomicWrite(path.join(site,'src/assets.js'),scripts.assets);atomicWrite(path.join(site,'src/sky-asset.js'),scripts.sky);
 fs.cpSync(media,path.join(site,'media'),{recursive:true});
 atomicWrite(path.join(site,'_headers'),'/version.json\n  Cache-Control: no-store\n/index.html\n  Cache-Control: no-cache\n/src/*\n  Cache-Control: public, max-age=3600, must-revalidate\n/media/*\n  Cache-Control: public, max-age=31536000, immutable\n  Access-Control-Allow-Origin: *\n  Cross-Origin-Resource-Policy: cross-origin\n');
 return {site,manifest,deployment};
}
module.exports={manifestFiles,prepareSite};
