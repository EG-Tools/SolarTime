/* One-time, reviewed card surface consolidation. Never used by the app. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),postcss=require('./deps/node_modules/postcss');
const root=path.resolve(__dirname,'..'),files=['styles.css','src/runtime-optimizations.css'];
const docs=files.map(f=>postcss.parse(fs.readFileSync(path.join(root,f),'utf8')));
const dead=/\.(?:date-modal|primary-button|error-text|speed-buttons|photo-status|material-actions|scale-note|settings-note|body-note)(?![\w-])/;
const shared=['.settings-panel','.body-panel','.modal','.preset-dialog','.toast','.language-menu'];
let removed=0;
for(const doc of docs){
 doc.walkRules(rule=>{if(rule.parent.type==='atrule'&&rule.parent.name.includes('keyframes'))return;const sels=rule.selectors;if(sels.length>1){for(const selector of sels)rule.cloneBefore({selector});rule.remove();}});
 doc.walkRules(rule=>{
  if(dead.test(rule.selector)){rule.remove();return;}
  if(rule.selector.includes('.body-panel>p'))rule.selector=rule.selector.replace('.body-panel>p','.body-scroll>p');
  if(rule.selector==='.body-panel'||rule.selector==='html[lang="ja"] .body-panel')rule.walkDecls(d=>{
   if(d.prop==='padding'){const v=d.value.split(/\s+/),values=[v[0],v[1]||v[0],v[2]||v[0],v[3]||v[1]||v[0]];for(const [i,side] of ['top','right','bottom','left'].entries())d.cloneBefore({prop:'--body-pad-'+side,value:values[i]});d.remove();}
   else if(d.prop.startsWith('padding-'))d.prop='--body-pad-'+d.prop.slice(8);
   if(d.prop==='overflow-y')d.value='hidden';
  });
  if(rule.selector==='.settings-scroll'){const max=rule.nodes.find(d=>d.prop==='max-height');if(max){const r=postcss.rule({selector:'.settings-panel'});r.append({prop:'--settings-height-limit',value:max.value});rule.before(r);max.remove();}}
  if(rule.selector==='.kakao-pay-dialog')rule.walkDecls('padding',d=>{d.prop='--card-padding';});
  if(rule.selector==='.modal-scroll')rule.walkDecls('padding',d=>{d.value=`var(--card-padding,${d.value})`;});
  if(shared.includes(rule.selector)||rule.selector==='.panel')rule.walkDecls(d=>{if(['background','background-color','box-shadow','backdrop-filter','-webkit-backdrop-filter','border-color'].includes(d.prop))d.remove();});
  if(rule.selector.startsWith('.solar-layout-actions')||rule.selector==='.solar-layout-diagnostics::backdrop')rule.remove();
  if(rule.selector==='.solar-layout-diagnostics'){rule.removeAll();rule.append({prop:'width',value:'min(430px,calc(100vw - 24px))'});}
  if(rule.selector==='html.solar-standalone .solar-layout-diagnostics')rule.remove();
 });
}
docs[0].append(postcss.parse(`
/* Common card surface and independent scrolling content. */
:root{--card-background:linear-gradient(145deg,hsla(215 37% 11.76%/.46),hsla(220 45% 7.84%/.46));--card-border:rgba(193,215,236,.12);--card-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 18px 54px rgba(0,0,0,.07);--card-filter:blur(6px) saturate(1.04)}
.card-surface{border-color:var(--card-border);background:var(--card-background);box-shadow:var(--card-shadow);backdrop-filter:var(--card-filter);-webkit-backdrop-filter:var(--card-filter)}
.card-scroll{min-height:0;overflow-x:hidden;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}
.card-scroll::-webkit-scrollbar{display:none}
.card-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.settings-panel.card-surface{display:flex;flex-direction:column;max-height:var(--settings-height-limit);overflow:hidden}
.settings-panel>.panel-heading{flex:none;margin:0;padding:23px 23px 17px}
.settings-scroll.card-scroll{padding-top:0}
.body-panel.card-surface{display:flex;flex-direction:column;padding:0;overflow:hidden}
.body-panel>.close-button{z-index:4}
.body-scroll{padding:var(--body-pad-top) var(--body-pad-right) var(--body-pad-bottom) var(--body-pad-left)}
.kakao-pay-scroll img{max-width:100%}
@media(max-width:680px){.settings-panel>.panel-heading{padding:21px 21px 17px}}
`));
const declarations=[];
function context(rule){let a=[],p=rule.parent;while(p&&p.type!=='root'){if(p.type==='atrule')a.unshift('@'+p.name+p.params.replace(/\s+/g,''));p=p.parent;}return a.join('/');}
for(const doc of docs)doc.walkRules(r=>{for(const d of r.nodes||[])if(d.type==='decl')declarations.push([context(r)+'|'+r.selector+'|'+d.prop,d]);});
const later=new Map();
for(const [key,d] of declarations.reverse()){
 const next=later.get(key);
 if(next&&(!d.important||next.important)&&d.parent!==next.parent&&!(/(?:dvh|svh|lvh|env\(|max\(|min\(|clamp\()/i.test(next.value)&&!/(?:dvh|svh|lvh|env\(|max\(|min\(|clamp\()/i.test(d.value))){d.remove();removed++;}
 if(!next||!next.important)later.set(key,d);
}
for(let i=0;i<docs.length;i++){docs[i].walkRules(r=>{if(!r.nodes.length)r.remove();});docs[i].walkAtRules(r=>{if(r.nodes&&!r.nodes.length)r.remove();});fs.writeFileSync(path.join(root,files[i]),docs[i].toString());}
console.log('Removed shadowed declarations: '+removed);
