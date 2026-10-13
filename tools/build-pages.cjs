/* Package only public runtime files; never publish source tests, tools or helpers. */
'use strict';
const path=require('node:path'),{packagePublicSite}=require('./public-site.cjs');
function buildPages(root){
 return packagePublicSite(root,{output:path.join(root,'.cloudflare/pages'),noJekyll:true}).site;
}
if(require.main===module)console.log('Prepared verified Pages site: '+buildPages(path.resolve(__dirname,'..')));
module.exports={buildPages};
