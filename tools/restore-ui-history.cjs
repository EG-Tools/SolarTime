/* Explicit isolated recovery. Never uploads or replaces current UI files. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ref=process.argv[2],allowed=['apple-touch-icon.png','app-icon-192.png','app-icon-512.png','life-user-watermark.webp'];
(async()=>{
 if(!/^[a-f0-9]{40}$/.test(ref||''))throw Error('Usage: node tools/restore-ui-history.cjs <exact commit> [filename ...]');
 const files=process.argv.slice(3);if(!files.length)files.push(...allowed.slice(0,3));
 const output=path.join(root,'.cloudflare/ui-history',ref);fs.mkdirSync(output,{recursive:true});
 for(const name of files){if(!allowed.includes(name))throw Error('Unsupported historical UI filename.');const target=path.join(output,name);if(fs.existsSync(target))throw Error('Recovery destination already exists: '+target);const response=await fetch('https://raw.githubusercontent.com/EG-Tools/SolarTime/'+ref+'/'+name,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('History download failed: HTTP '+response.status);fs.writeFileSync(target,Buffer.from(await response.arrayBuffer()));}
 console.log('Recovered for inspection only: '+output+'\nNo current file replacement or R2 upload was performed.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
