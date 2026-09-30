'use strict';
const path=require('node:path'),sharp=require('sharp');

async function main(){
 const [, , sourceArg='.cloudflare/source/cloud_combined_8192.tif',targetArg='assets/clouds.webp',widthArg='4096']=process.argv;
 const source=path.resolve(sourceArg),target=path.resolve(targetArg),width=Number(widthArg),height=width/2;
 if(!Number.isInteger(width)||width<512||!Number.isInteger(height))throw Error('Width must be an even integer of at least 512.');
 const metadata=await sharp(source).metadata();
 if(!metadata.width||!metadata.height||Math.abs(metadata.width/metadata.height-2)>.001)throw Error(`NASA cloud source must be exactly 2:1, got ${metadata.width}x${metadata.height}.`);
 await sharp(source)
  .resize(width,height,{fit:'fill',kernel:sharp.kernel.lanczos3})
  .greyscale()
  .removeAlpha()
  .webp({quality:96,effort:6,smartSubsample:true})
  .toFile(target);
 console.log(`Prepared NASA Earth clouds ${path.relative(process.cwd(),target)} (${width}x${height}).`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
