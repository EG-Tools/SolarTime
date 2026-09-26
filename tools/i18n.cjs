/* Canonical translation sources -> deterministic public bundles and bootstrap.
   No dependencies and no network calls. --write is the only output mutation. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const fingerprint=value=>hash(JSON.stringify(stable(value)));
const json=value=>JSON.stringify(value,null,2)+'\n';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const placeholders=text=>[...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map(m=>m[1]))].sort();
function parse(text,label){
 const result=JSON.parse(text);
 // JSON.parse alone silently accepts duplicate keys. Scan validated JSON tokens
 // as well so a duplicate in a translation cannot overwrite another unnoticed.
 const tokens=text.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)||[];let at=0;
 function value(trail){const token=tokens[at++];if(token==='{'){
  const seen=new Set();if(tokens[at]==='}'){at++;return;}
  do{const key=JSON.parse(tokens[at++]);if(seen.has(key))throw Error(label+': duplicate key '+trail+key);if(['__proto__','constructor','prototype'].includes(key))throw Error(label+': unsafe key '+key);seen.add(key);at++;value(trail+key+'.');}while(tokens[at++ ]===',');
 }else if(token==='['){if(tokens[at]===']'){at++;return;}let n=0;do{value(trail+(n++)+'.');}while(tokens[at++ ]===',');}}
 value('');return result;
}
function read(root,file){return parse(fs.readFileSync(path.join(root,file),'utf8'),file);}
function flatten(source){const out={};for(const ns of ['ui','timer','bodies','phases']){
 if(!object(source[ns]))throw Error('Missing object namespace '+ns);
 for(const [key,value] of Object.entries(source[ns])){
  if(Array.isArray(value)){if(ns!=='bodies'||value.length!==2)throw Error('Invalid array '+ns+'.'+key);value.forEach((v,i)=>out[ns+'.'+key+'.'+i]=v);}
  else out[ns+'.'+key]=value;
 }}return out;}
function compile(root){
 const config=read(root,'i18n/config.json'),exceptions=read(root,'i18n/legacy-allowlist.json');
 if(config.schemaVersion!==1||config.baseLanguage!=='en'||!object(config.languages))throw Error('Invalid translation config');
 const codes=Object.keys(config.languages);if(!codes.includes('en')||codes.some(c=>!/^[a-z]{2,3}$/.test(c)))throw Error('Invalid language code');
 for(const [code,related] of Object.entries(config.missingBundleFallback||{})){
  const seen=new Set([code]);let next=related;while(next){if(!codes.includes(next)||seen.has(next))throw Error('Invalid bundle fallback chain '+code);seen.add(next);next=config.missingBundleFallback[next];}
 }
 if(!Array.isArray(config.browserLanguageRules)||config.browserLanguageRules.some(r=>!Array.isArray(r)||r.length!==2||!codes.includes(r[1])))throw Error('Invalid browser language rules');
 config.browserLanguageRules.forEach(([pattern])=>new RegExp(pattern));
 const sources=Object.fromEntries(codes.map(code=>[code,read(root,'i18n/locales/'+code+'.json')]));
 const disk=fs.readdirSync(path.join(root,'i18n/locales')).filter(f=>f.endsWith('.json')).map(f=>f.slice(0,-5)).sort();
 if(JSON.stringify(disk)!==JSON.stringify([...codes].sort()))throw Error('Language files and config differ');
 const base=sources.en,fields=flatten(base),keys=Object.keys(fields),errors=[],warnings=[],fallbacks=[],used=new Set(),bundles={};
 const contexts=read(root,'i18n/context.json');for(const [key,note] of Object.entries(contexts))if(!Object.hasOwn(fields,key)||typeof note!=='string'||!note.trim())errors.push('Invalid context '+key);
 const inherited=exceptions.inherited||{},variants=exceptions.placeholderVariants||{},invariants=new Set(config.invariantKeys||[]),allowEmpty=new Set(config.allowEmptyKeys||[]);
 const metadata={},automaticLabels={};
 for(const code of codes){
  const source=sources[code],entries=flatten(source),meta=config.languages[code];
  if(Object.keys(source).some(k=>!['ui','timer','bodies','phases','local'].includes(k))||!object(source.local))errors.push(code+': invalid namespace');
  if(!meta.locale||!meta.html||!Array.isArray(meta.automaticLabel)||meta.automaticLabel.length!==2||meta.automaticLabel.some(s=>typeof s!=='string'||!s.trim()))errors.push(code+': invalid language metadata');
  metadata[code]={locale:meta.locale,html:meta.html};automaticLabels[code]=meta.automaticLabel;
  for(const key of Object.keys(source.ui))if(Object.hasOwn(source.timer,key))errors.push(code+': duplicate UI/timer key '+key);
  for(const key of Object.keys(entries))if(!Object.hasOwn(fields,key))errors.push(code+': unknown key '+key);
  for(const key of keys){
   const id=code+':'+key,target=entries[key],original=fields[key];
   if(typeof original!=='string'||(!original.trim()&&!allowEmpty.has(key)))errors.push('en: empty/invalid '+key);
   if(target===undefined){
    if(invariants.has(key))continue;
    const permission=inherited[id];fallbacks.push({language:code,key,sourceHash:hash(original),reason:permission?.reason||'Unapproved missing translation'});
    if(permission?.sourceHash===hash(original)&&permission.reason)used.add('inherited:'+id);else errors.push(id+': missing translation (not approved legacy fallback)');
   }else if(typeof target!=='string'||(!target.trim()&&!allowEmpty.has(key)))errors.push(id+': empty/invalid translation');
   else if(JSON.stringify(placeholders(target))!==JSON.stringify(placeholders(original))){
    const exception=variants[id];if(exception?.sourceHash===hash(original)&&exception.translationHash===hash(target)&&exception.reason){used.add('variant:'+id);warnings.push({language:code,key,reason:exception.reason});}
    else errors.push(id+': placeholders differ: '+placeholders(target)+' vs '+placeholders(original));
   }
  }
  const copy={...base.ui,...base.timer,...source.ui,...source.timer};
  const bodies=Object.fromEntries(Object.entries(base.bodies).map(([id,value])=>[id,source.bodies[id]||value]));
  const phases={...base.phases,...source.phases};
  for(const [key,text] of Object.entries(source.local||{})){
   if(!Object.hasOwn(copy,key)||typeof text!=='string'||!text.trim()||JSON.stringify(placeholders(text))!==JSON.stringify(placeholders(copy[key])))errors.push(code+': invalid local variant '+key);
  }
  bundles[code]={copy,bodies,phases};
 }
 for(const key of invariants)if(!Object.hasOwn(fields,key))errors.push('Unknown invariant '+key);
 const legacyFileCopy=Object.fromEntries(codes.map(code=>[code,{...Object.fromEntries(config.legacyFileKeys.map(k=>[k,bundles[code].copy[k]])),...sources[code].local}]));
 for(const key of config.legacyFileKeys)if(!Object.hasOwn(bundles.en.copy,key))errors.push('Unknown local compatibility key '+key);
 const releases=read(root,'i18n/releases.json'),versions=new Set();
 if(!Array.isArray(releases)||!releases.length)errors.push('No release history');
 for(const release of releases){
  if(!/^0\.\d{1,2}$/.test(release.version)||versions.has(release.version)||!/^\d{4}\.\d{2}\.\d{2}$/.test(release.date)||!object(release.localized))throw Error('Invalid release '+release.version);
  versions.add(release.version);
  if(!Array.isArray(release.localized.en)||!release.localized.en.length||!Array.isArray(release.localized.kor))throw Error('Missing release base text '+release.version);
  for(const code of Object.keys(release.localized))if(!codes.includes(code))errors.push('Unknown release language '+code);
  for(const code of codes){
   const items=release.localized[code],id=code+':release.'+release.version;
   if(!items){const permission=inherited[id];fallbacks.push({language:code,key:'release.'+release.version,sourceHash:fingerprint(release.localized.en),reason:permission?.reason||'Unapproved missing release translation'});if(permission?.sourceHash===fingerprint(release.localized.en)&&permission.reason)used.add('inherited:'+id);else errors.push(id+': missing release translation');}
   else if(!Array.isArray(items)||items.length!==release.localized.en.length||items.some(v=>typeof v!=='string'||!v.trim()))errors.push(id+': invalid release items');
  }
 }
 for(const id of Object.keys(inherited))if(!used.has('inherited:'+id))errors.push('Obsolete or changed fallback allowance '+id);
 for(const id of Object.keys(variants))if(!used.has('variant:'+id))errors.push('Obsolete or changed placeholder allowance '+id);
 if(errors.length)throw Error('Translation validation failed:\n'+errors.join('\n'));
 return {config,codes,sources,fields,bundles,metadata,automaticLabels,legacyFileCopy,releases,report:{languages:codes.length,sourceMessages:keys.length,legacyFallbackCount:fallbacks.length,placeholderVariantCount:warnings.length,fallbacks,warnings,fullyTranslated:fallbacks.length===0}};
}
function replaceBlock(text,start,end,value,file){
 if(text.split(start).length!==2||text.split(end).length!==2)throw Error('Invalid generated block markers: '+file);
 const a=text.indexOf(start)+start.length,b=text.indexOf(end,a);return text.slice(0,a)+'\n'+value+'\n  '+text.slice(b);
}
function outputs(root,data=compile(root)){
 const out=new Map();for(const code of data.codes)out.set('src/locales/'+code+'.json',json(data.bundles[code]));
 const d=data,block=[
  '  const supported=Object.freeze('+JSON.stringify(d.codes)+');',
  '  const metadata=deepFreeze('+JSON.stringify(d.metadata)+');',
  '  const browserLanguagePatterns=deepFreeze('+JSON.stringify(d.config.browserLanguageRules)+'.map(([pattern,code])=>[new RegExp(pattern),code]));',
  '  const automaticLabels=deepFreeze('+JSON.stringify(d.automaticLabels)+');',
  '  const emptyCopyKeys=Object.freeze('+JSON.stringify(d.config.allowEmptyKeys.filter(k=>k.startsWith('ui.')||k.startsWith('timer.')).map(k=>k.slice(k.indexOf('.')+1)))+');',
  '  const fallback=deepFreeze('+JSON.stringify(d.bundles.en)+');',
  '  const legacyFileCopy=deepFreeze('+JSON.stringify(d.legacyFileCopy)+');',
  '  const missingFallback=Object.freeze('+JSON.stringify(d.config.missingBundleFallback||{})+');'
 ].join('\n');
 const loader='src/language-data.js';out.set(loader,replaceBlock(fs.readFileSync(path.join(root,loader),'utf8'),'// BEGIN GENERATED I18N DATA','// END GENERATED I18N DATA',block,loader));
 const notes='src/release-notes.js';out.set(notes,replaceBlock(fs.readFileSync(path.join(root,notes),'utf8'),'// BEGIN GENERATED RELEASE DATA','// END GENERATED RELEASE DATA',' const DATA='+JSON.stringify(d.releases)+';',notes));
 return {out,data};
}
function sync(root,{write=false,strict=false}={}){
 const {out,data}=outputs(root);if(strict&&data.report.legacyFallbackCount)throw Error(data.report.legacyFallbackCount+' legacy fallbacks remain; they are not completed translations.');
 const changed=[];for(const [file,text] of out)if(!fs.existsSync(path.join(root,file))||fs.readFileSync(path.join(root,file),'utf8')!==text){changed.push(file);if(write)fs.writeFileSync(path.join(root,file),text);}
 if(changed.length&&!write)throw Error('Generated translation files differ: '+changed.join(', ')+'. Edit i18n/ and run npm run build:i18n.');
 return {changed,report:data.report};
}
function diff(root,ref='HEAD'){
 if(!/^[a-zA-Z0-9_][a-zA-Z0-9_./~-]*$/.test(ref))throw Error('Invalid base ref');
 const validRef=cp.spawnSync('git',['rev-parse','--verify',ref+'^{commit}'],{cwd:root,encoding:'utf8'});if(validRef.status!==0)throw Error('Unknown base ref '+ref);
 const config=read(root,'i18n/config.json'),codes=Object.keys(config.languages),sources=Object.fromEntries(codes.map(c=>[c,read(root,'i18n/locales/'+c+'.json')])),current={codes,sources,fields:flatten(sources.en)},oldText=file=>{const r=cp.spawnSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});return r.status===0?parse(r.stdout,file):null;};
 function messages(source,config,history,code){
  const out=source?flatten(source):{};
  (config?.languages?.[code]?.automaticLabel||[]).forEach((v,i)=>out['automaticLabel.'+i]=v);
  for(const release of history||[])for(const [i,v] of (release.localized[code]||[]).entries())out['release.'+release.version+'.'+i]=v;
  for(const [key,v] of Object.entries(source?.local||{}))out['local.'+key]=v;
  return out;
 }
 const oldConfig=oldText('i18n/config.json'),oldHistory=oldText('i18n/releases.json'),history=read(root,'i18n/releases.json');
 const before=oldText('i18n/locales/en.json'),old=messages(before,oldConfig,oldHistory,'en'),now=messages(current.sources.en,config,history,'en');
 const changed=Object.keys({...old,...now}).filter(k=>old[k]!==now[k]);
 const prior=Object.fromEntries(current.codes.map(c=>[c,messages(oldText('i18n/locales/'+c+'.json'),oldConfig,oldHistory,c)]));
 const after=Object.fromEntries(current.codes.map(c=>[c,messages(current.sources[c],config,history,c)]));
 return {base:ref,newCatalog:!before,metadataChanged:fingerprint(oldConfig)!==fingerprint(config),messages:changed.map(key=>({key,change:!(key in old)?'added':!(key in now)?'removed':'changed',before:old[key]??null,after:now[key]??null,reviewLanguages:current.codes.filter(c=>c!=='en'&&prior[c][key]===after[c][key])})),targetChanges:Object.fromEntries(current.codes.filter(c=>c!=='en').map(c=>[c,Object.keys({...prior[c],...after[c]}).filter(k=>prior[c][k]!==after[c][k])]))};
}
if(require.main===module){try{
 const args=process.argv.slice(2),root=path.resolve(__dirname,'..');if(args.some(a=>!['--write','--report','--strict','--diff'].includes(a)&&!a.startsWith('--base=')))throw Error('Unknown i18n option');
 if(args.includes('--diff'))console.log(json(diff(root,args.find(a=>a.startsWith('--base='))?.slice(7)||'HEAD')));
 else if(args.includes('--report'))console.log(json(compile(root).report));
 else{const result=sync(root,{write:args.includes('--write'),strict:args.includes('--strict')});console.log('Translations checked: '+result.report.languages+' languages; '+result.changed.length+' generated files updated; '+result.report.legacyFallbackCount+' explicitly tracked legacy fallbacks.');}
 }catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={parse,flatten,placeholders,hash,fingerprint,stable,compile,outputs,sync,diff};
