'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../src/app.js'),'utf8');
const hydrate=app.slice(app.indexOf('  async function hydrateLanguage('),app.indexOf('  // NASA/NSSDCA'));
const boot=app.slice(app.indexOf('      try{await hydrateLanguage(language,activeCopyCode);}'),app.indexOf('      let languageRetry='));
for(const code of ['en','kor'])for(const failure of ['offline','invalid-json','invalid-shape'])test(code+' boot survives '+failure+' and later restores the selected language',async()=>{
 let fail=true;const context={window:{},URL,AbortSignal,location:{protocol:'https:',href:'https://test.invalid/'},document:{currentScript:{src:'https://test.invalid/src/language-data.js'}},fetch:async()=>{
  if(fail&&failure==='offline')throw Error('offline');
  return {ok:true,json:async()=>{if(fail&&failure==='invalid-json')throw SyntaxError('bad json');return fail?{copy:[]}:JSON.parse(fs.readFileSync(require.resolve('../src/locales/'+code+'.json'),'utf8'));}};
 }};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/language-data.js'),'utf8'),context);
 Object.assign(context,{LanguageData:context.window.SolarModules.LanguageData,language:code,activeCopyCode:code,COPY:{},BODY_COPY:{},PHASE_COPY:{}});
 await vm.runInNewContext('(async()=>{'+hydrate+boot+'})()',context);
 assert.equal(context.COPY[code].settings,context.LanguageData.fallback.copy.settings);assert.equal(context.activeCopyCode,code);assert.equal(context.LanguageData.loaded(code),false);
 fail=false;await vm.runInNewContext('(async()=>{'+hydrate+'await hydrateLanguage(language,activeCopyCode);})()',context);
 assert.equal(context.LanguageData.loaded(code),true);assert.equal(context.COPY[code].settings,JSON.parse(fs.readFileSync(require.resolve('../src/locales/'+code+'.json'),'utf8')).copy.settings);
});
