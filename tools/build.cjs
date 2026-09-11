/* Bundle the offline website into a double-clickable HTML file. No npm install. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
let html=read('index.html').replace('<link rel="stylesheet" href="styles.css">',()=>'<style>\n'+read('styles.css')+'\n</style>');
for(const name of ['astro','renderer','app']) {
  const code=read('src/'+name+'.js').replace(/<\/script/gi,'<\\/script');
  html=html.replace(`<script src="src/${name}.js"></script>`,()=>'<script>\n'+code+'\n</script>');
}
const out=path.join(root,'dist');fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'Solar-Time_v0.04.html');fs.writeFileSync(file,html);
console.log('Built '+file+' ('+Buffer.byteLength(html)+' bytes)');
