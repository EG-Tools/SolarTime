/* Restore checksum-verified originals, never the published render tiers. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{downloadMediaBundle}=require('./r2-media-bundle.cjs'),{validatePackage}=require('./source-guard.cjs');
const root=path.resolve(__dirname,'..'),source=path.join(root,'.cloudflare/source-originals');
(async()=>{
 await downloadMediaBundle(root,source,{kind:'originals'});
 const entries=validatePackage(source,JSON.parse(fs.readFileSync(path.join(source,'source-manifest.json'),'utf8')));
 for(const {entry,bytes} of entries){const target=path.join(root,'assets',entry.path);if(fs.existsSync(target)&&!fs.readFileSync(target).equals(bytes))throw Error('Local original differs: '+entry.path+'. Back it up before restoring.');}
 for(const {entry,bytes} of entries){const target=path.join(root,'assets',entry.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 console.log('Verified original sources restored: '+entries.length);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
