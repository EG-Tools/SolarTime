'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function metadata(){
 const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8'),start=app.indexOf('  const REGION_CATALOG='),end=app.indexOf('  function populateLanguageMenu',start);
 if(start<0||end<=start)throw Error('Canonical region catalog not found');
 return vm.runInNewContext(app.slice(start,end)+';({catalog:REGION_CATALOG,order:LANG_ORDER,meta:LANG_META,regions:REGIONS})');
}
module.exports={metadata};
