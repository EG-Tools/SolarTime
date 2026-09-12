/* v0.14 build: existing local assets -> dependency-free, double-clickable HTML.
   Run in the existing v0.13 repository after copying this changed-files package.
   Only release labels are normalized; settings/preset storage keys are untouched. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const names=['assets','materials','astro','surface','sky','renderer','app'];
function atomicWrite(file,text){const temp=file+'.tmp';try{fs.writeFileSync(temp,text,'utf8');fs.renameSync(temp,file);}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
function stamp(text){return text.replace(/v0\.13(?!\d)/g,'v0.14');}
try{
 const pkg=JSON.parse(read('package.json'));if(pkg.version!=='0.0.14')throw Error('This builder requires package version 0.0.14.');
 for(const file of ['index.html','styles.css','tools/pack_assets.cjs','assets/universe.webp','assets/stars.json',...names.filter(x=>x!=='assets').map(x=>'src/'+x+'.js')]){
  if(!fs.existsSync(path.join(root,file)))throw Error('Missing '+file+'. Copy the update into the existing SolarTime v0.13 project, not an empty directory.');
 }
 let source=read('index.html');
 const styleTag='<link rel="stylesheet" href="styles.css">';
 if(source.split(styleTag).length!==2)throw Error('Expected one stylesheet placeholder in index.html.');
 for(const name of names){const id=name==='assets'?' id="solar-assets"':'',tag=`<script${id} src="src/${name}.js"></script>`;if(source.split(tag).length!==2)throw Error('Missing or duplicated script placeholder: '+name);}
 // Repack the new panorama together with the user's existing planet images.
 require('./pack_assets.cjs');
 let html=stamp(source).replace(styleTag,()=>'<style>\n'+read('styles.css')+'\n</style>');
 for(const name of names){const code=stamp(read('src/'+name+'.js')).replace(/<\/script/gi,'<\\/script'),id=name==='assets'?' id="solar-assets"':'';
  html=html.replace(`<script${id} src="src/${name}.js"></script>`,()=>`<script${id}>\n`+code+'\n</script>');
 }
 if(/<script\b[^>]*\bsrc\s*=/i.test(html))throw Error('Unbundled script remains; no output was written.');
 const out=path.join(root,'dist');fs.mkdirSync(out,{recursive:true});
 const file=path.join(out,'Solar-Time_v0.14.html');atomicWrite(file,html);
 // Keep development entrypoint and its offline-photo export labelled correctly.
 const versioned=stamp(source);if(versioned!==source)atomicWrite(path.join(root,'index.html'),versioned);
 const material=read('src/materials.js'),versionedMaterial=stamp(material);
 if(material!==versionedMaterial)atomicWrite(path.join(root,'src/materials.js'),versionedMaterial);
 console.log('Built '+file+' ('+Buffer.byteLength(html)+' bytes)');
 console.log('Previous dist/Solar-Time_v0.13.html was not changed.');
}catch(error){console.error('Build failed: '+error.message);process.exitCode=1;}
