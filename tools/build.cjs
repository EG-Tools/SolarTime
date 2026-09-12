/* Bundle the offline website into a double-clickable HTML file. No npm install. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
require('./pack_assets.cjs');
let html=read('index.html').replace('<link rel="stylesheet" href="styles.css">',()=>'<style>\n'+read('styles.css')+'\n</style>');
for(const name of ['assets','materials','astro','surface','sky','renderer','app']) {
  const code=read('src/'+name+'.js').replace(/<\/script/gi,'<\\/script');
  const id=name==='assets'?' id="solar-assets"':'';
  html=html.replace(`<script${id} src="src/${name}.js"></script>`,()=>`<script${id}>\n`+code+'\n</script>');
}
const out=path.join(root,'dist');fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'Solar-Time_v0.12.html');fs.writeFileSync(file,html);
console.log('Built '+file+' ('+Buffer.byteLength(html)+' bytes)');
