'use strict';
const path=require('node:path'),{packagePublicSite}=require('./public-site.cjs');
function prepareSite(root,{manifest=null,deployment=null,cdnBase=null}={}){
 return packagePublicSite(root,{output:path.join(root,'.cloudflare/site'),cdnBase:cdnBase==null?'/media/':cdnBase,workerHeaders:true,manifest,deployment});
}
module.exports={prepareSite};
