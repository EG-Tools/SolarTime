/* Package only public runtime files; never publish source tests, tools or helpers. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {releaseFiles}=require('./release-files.cjs'),{projectConfig,runtimeScripts}=require('./asset-pipeline.cjs');
function buildPages(root){
 require('./i18n.cjs').sync(root);
 require('./code-revisions.cjs').sync(root);
 const site=path.join(root,'.cloudflare/pages'),{deployment}=projectConfig(root),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const generated=runtimeScripts(root,manifest,deployment,{cdnBase:deployment.cdnBase});
 fs.rmSync(site,{recursive:true,force:true});fs.mkdirSync(site,{recursive:true});
 for(const file of releaseFiles(root)){
  const destination=path.resolve(site,file);if(!destination.startsWith(path.resolve(site)+path.sep))throw Error('Unsafe public file path.');
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  if(file==='src/assets.js')fs.writeFileSync(destination,generated.assets);
  else if(file==='src/sky-asset.js')fs.writeFileSync(destination,generated.sky);
  else fs.copyFileSync(path.join(root,file),destination);
 }
 fs.writeFileSync(path.join(site,'.nojekyll'),'');
 return site;
}
if(require.main===module)console.log('Prepared verified Pages site: '+buildPages(path.resolve(__dirname,'..')));
module.exports={buildPages};
