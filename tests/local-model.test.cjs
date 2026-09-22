'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const A=require('../src/astro.js'),all=[A.SUN,...A.BODIES,A.MOON],signed=n=>A.wrap(n+Math.PI)-Math.PI;
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

// Static application code stays local. Remote markup is limited to the exact
// Cloudflare analytics, Google AdSense ownership code, canonical URL and icon.
function assertStaticAssetLinks(html,deployment){
 const prefix=String(deployment.prefix||'releases').replace(/^\/+|\/+$/g,'');
 const expected=new URL(prefix+'/content/ui/apple-touch-icon.png',deployment.cdnBase);
 for(const match of html.matchAll(/<(script|img|link)\b[^>]*>/gi)){
  const kind=match[1].toLowerCase(),attrs={};
  for(const attr of match[0].matchAll(/\s([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g))
   attrs[attr[1].toLowerCase()]=attr[2]??attr[3]??attr[4];
  const address=String(attrs[kind==='link'?'href':'src']||'').trim();
  if(!/^(?:https?:|\/\/)/i.test(address))continue;
  if(kind==='script'){
   if(address==='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5773171100052324'){
    assert.match(match[0],/\sasync(?:\s|>)/i,'AdSense must load asynchronously');
    assert.equal(String(attrs.crossorigin||'').toLowerCase(),'anonymous','AdSense must omit credentials');
    continue;
   }
   assert.equal(address,'https://static.cloudflareinsights.com/beacon.min.js','Only the Cloudflare analytics beacon may be remote');
   assert.equal(String(attrs.type||'').toLowerCase(),'module','The analytics beacon must use the dashboard snippet type');
   assert.equal(attrs['data-cf-beacon'],'{"token":"fb63a7b11f6c409f8cdc1f703e68c5d9"}','Unexpected Cloudflare analytics site token');
   continue;
  }
  assert.equal(kind,'link','Static scripts and images must stay local: '+address);
  if(String(attrs.rel||'').trim().toLowerCase()==='canonical'){
   assert.equal(address,'https://solartime.app/','The canonical URL must be the production root');
   continue;
  }
  assert.equal(String(attrs.rel||'').trim().toLowerCase(),'apple-touch-icon','Only the install icon may use a remote link: '+address);
  assert.match(address,/^https:\/\//i,'The install icon must use explicit HTTPS');
  const url=new URL(address);
  assert.equal(url.origin,expected.origin,'Unexpected install-icon CDN');
  assert.equal(url.pathname,expected.pathname,'Unexpected install-icon object path');
  assert.equal(url.username+url.password+url.hash,'','Icon URLs must not contain credentials or fragments');
  assert.deepEqual([...url.searchParams.keys()],['v'],'The install icon must have exactly one version cache key');
  assert.match(url.searchParams.get('v'),/^\d+(?:\.\d+)+-r\d+(?:-[a-z0-9-]+)?$/i,'The install-icon cache key must be versioned');
 }
}

test('Offline boot calibrates every body at current device time in under five seconds',()=>{
 const t=Date.UTC(2026,8,11,7,45,12),start=performance.now();const status=A.calibrateAt(t);
 for(const b of A.BODIES){const p=A.positionAt(b,t,true);assert.ok(Number.isFinite(p.x+p.y+p.z));}
 assert.ok(performance.now()-start<5000);assert.equal(status.epoch,t);assert.equal(status.source,'jpl-1800-2050');assert.equal(status.networkRequired,false);
});
test('Stored axial tilts preserve NASA precision and periods use seconds, not degrees per frame',()=>{
 for(const b of all){close(b.spinSeconds*100,Math.round(b.spinSeconds*100),1e-4);assert.notEqual(b.spinSeconds,0);close(b.tilt*1000,Math.round(b.tilt*1000),1e-9);
 if(b.periodSeconds)close(b.periodSeconds*100,Math.round(b.periodSeconds*100),1e-4);}
 close(A.BODIES[2].spinSeconds,86164.10,1e-9);
});
test('Planet obliquities and rendered J2000 pole vectors match NASA/NSSDCA data',()=>{
 assert.deepEqual(A.BODIES.map(b=>b.tilt),[.034,177.36,23.439,25.19,3.13,26.73,97.77,28.32,119.51]);
 for(const b of A.BODIES){
  const p=A.bodyAxes(b).pole,I=b.base[2]*A.DEG,O=b.base[5]*A.DEG;
  const orbitPole={x:Math.sin(O)*Math.sin(I),y:-Math.cos(O)*Math.sin(I),z:Math.cos(I)};
  const cosine=Math.sign(b.spin)*(p.x*orbitPole.x+p.y*orbitPole.y+p.z*orbitPole.z);
  const rendered=Math.acos(Math.max(-1,Math.min(1,cosine)))/A.DEG;
  assert.ok(Math.abs(rendered-b.tilt)<.11,`${b.id}: ${rendered} != ${b.tilt}`);
 }
});
test('References are reused throughout playback; no orbital-element rebuild on each frame',()=>{
 const t=Date.UTC(2026,8,11);A.calibrateAt(t);const before=A.modelStatus();
 for(let i=0;i<1200;i++)for(const b of A.BODIES){A.positionAt(b,t+i*16);A.rotationAt(b,t+i*16);}
 assert.equal(A.modelStatus().referenceEvaluations,before.referenceEvaluations);assert.equal(A.modelStatus().calibrations,before.calibrations);
});
test('The UTC year changes one cached reference, while elapsed-time loops continue',()=>{
 A.calibrateAt(Date.UTC(2026,11,31,23,59,59));const before=A.modelStatus();
 A.positionAt(A.BODIES[2],Date.UTC(2027,0,1));assert.equal(A.modelStatus().calibrations,before.calibrations+1);
 for(const b of all){const t=Date.UTC(2027,0,1,12);close(signed(A.rotationAt(b,t+1000)-A.rotationAt(b,t)),A.TAU/b.spinSeconds);}
});
test('Identical restart time produces identical positions and rotations without any saved cache',()=>{
 const t=Date.UTC(2026,8,11,12);A.calibrateAt(t);const first=all.map(b=>A.rotationAt(b,t));const p=A.BODIES.map(b=>A.positionAt(b,t));
 A.calibrateAt(Date.UTC(2029,4,5));A.calibrateAt(t);
 assert.deepEqual(all.map(b=>A.rotationAt(b,t)),first);assert.deepEqual(A.BODIES.map(b=>A.positionAt(b,t)),p);
});
test('Korean solar side is day near local noon and night near local midnight throughout the year',()=>{
 for(const month of [0,2,5,8,11]){const noon=Date.UTC(2026,month,15,3),midnight=Date.UTC(2026,month,15,15);
 A.calibrateAt(noon);assert.ok(A.siteSun(noon).altitude>10);assert.ok(A.siteSun(midnight).altitude< -10);}
});
test('Astronomy stays local while network access is limited to approved analytics and versioned visual assets',()=>{
 const root=path.resolve(__dirname,'..');
 for(const name of ['astro','app','renderer']){const s=fs.readFileSync(path.join(root,'src',name+'.js'),'utf8');assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|navigator\.onLine/);}
 const materials=fs.readFileSync(path.join(root,'src/materials.js'),'utf8');assert.doesNotMatch(materials,/\bfetch\s*\(|indexedDB|solarsystemscope|jsdelivr/);
 const surface=fs.readFileSync(path.join(root,'src/surface.js'),'utf8');assert.match(surface,/fetch\(url,\{mode:'cors',credentials:'omit',cache:'force-cache',signal:controller\.signal\}\)/);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),deployment=JSON.parse(fs.readFileSync(path.join(root,'assets/deployment.json'),'utf8'));
 assertStaticAssetLinks(html,deployment);
});

test('Static asset policy allows only the versioned official HTTPS install icon',()=>{
 const deployment={cdnBase:'https://media.example.test/media/',prefix:'releases'};
 const icon=new URL('releases/content/ui/apple-touch-icon.png',deployment.cdnBase).href;
 const valid=`<link rel="icon" href="data:image/svg+xml,test"><link rel="stylesheet" href="styles.css?v=0.45-r15"><script src="src/app.js?v=0.46-r3"></script><link sizes="180x180" href="${icon}?v=0.46-r3" rel="apple-touch-icon">`;
 assert.doesNotThrow(()=>assertStaticAssetLinks(valid,deployment));
 // A new cache revision must not require another hard-coded test edit.
 assert.doesNotThrow(()=>assertStaticAssetLinks(valid.replace('v=0.46-r3" rel','v=0.46-r4" rel'),deployment));
 const forbidden=[
  `<link rel="stylesheet" href="${icon}?v=0.46-r3">`,
  `<link rel="apple-touch-icon stylesheet" href="${icon}?v=0.46-r3">`,
  `<link rel="apple-touch-icon" href="${icon.replace('media.example.test','other.example.test')}?v=0.46-r3">`,
  `<link rel="apple-touch-icon" href="${icon.replace('apple-touch-icon.png','other.png')}?v=0.46-r3">`,
  `<link rel="apple-touch-icon" href="${icon.replace('https:','http:')}?v=0.46-r3">`,
  `<link rel="apple-touch-icon" href="${icon.replace('https:','')}?v=0.46-r3">`,
  `<link rel="apple-touch-icon" href="${icon}">`,
  `<link rel="apple-touch-icon" href="${icon}?v=">`,
  `<link rel="apple-touch-icon" href="${icon}?v=latest">`,
  `<link rel="apple-touch-icon" href="${icon}?v=0.46-r3&v=0.46-r4">`,
  `<link rel="apple-touch-icon" href="${icon}?v=0.46-r3#fragment">`,
  `<link rel="apple-touch-icon" href="${icon.replace('https://','https://user@')}?v=0.46-r3">`,
  '<script src="https://other.example.test/app.js"></script>',
  '<script src="//other.example.test/app.js"></script>',
  '<img src="https://other.example.test/image.png">',
  "<LINK HREF = 'https://other.example.test/style.css' REL = 'stylesheet'>"
 ];
 for(const html of forbidden)assert.throws(()=>assertStaticAssetLinks(html,deployment),{code:'ERR_ASSERTION'},html);
});
