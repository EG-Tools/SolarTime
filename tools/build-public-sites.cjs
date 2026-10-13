/* Production build owner: synchronize generated source once, then package
 * both public origins from the same manifest and release graph. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {projectConfig}=require('./asset-pipeline.cjs'),{packagePublicSite}=require('./public-site.cjs');
function buildPublicSites(root){
 require('./i18n.cjs').sync(root);require('./code-revisions.cjs').sync(root);
 const {deployment}=projectConfig(root),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'),'utf8'));
 const worker=packagePublicSite(root,{output:path.join(root,'.cloudflare/site'),cdnBase:'/media/',workerHeaders:true,manifest,deployment,synchronize:false});
 const pages=packagePublicSite(root,{output:path.join(root,'.cloudflare/pages'),noJekyll:true,manifest,deployment,synchronize:false});
 return {worker:worker.site,pages:pages.site,files:worker.files};
}
if(require.main===module){const result=buildPublicSites(path.resolve(__dirname,'..'));console.log(`Prepared Worker and Pages from one ${result.files.length}-file public graph.`);}
module.exports={buildPublicSites};
