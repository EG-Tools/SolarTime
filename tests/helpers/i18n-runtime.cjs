'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'../..',p),'utf8');
function localization(context){
 const globals={URL,AbortSignal,location:{href:'https://test.invalid/',protocol:'https:'},document:{currentScript:{src:'https://test.invalid/src/language-data.js'}},...context};
 vm.runInNewContext(read('src/language-data.js'),globals);
 return vm.runInNewContext(read('src/localization.js'),globals);
}
module.exports={localization};
