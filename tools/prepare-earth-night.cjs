'use strict';

// Resize NASA's official grayscale Black Marble radiance map directly.
// The source already contains only measured night lights on black, so this
// pipeline deliberately performs no colour-key extraction, thresholding,
// sharpening, blur or synthetic bloom. Per-pixel toning changes hue only;
// the source map remains the sole authority for light shape and falloff.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');

async function main(){
 const [, , sourceArg='.cloudflare/source/BlackMarble_2016_3km_gray.jpg',targetArg='assets/earth-night.webp',widthArg='4096']=process.argv;
 const source=path.resolve(sourceArg),target=path.resolve(targetArg),width=Number(widthArg),height=width/2;
 if(!fs.existsSync(source))throw Error('NASA Black Marble grayscale source is missing: '+source);
 if(!Number.isInteger(width)||width<1024||width%2)throw Error('Width must be an even integer of at least 1024.');

 const {data,info}=await sharp(source)
  .resize(width,height,{fit:'fill',kernel:sharp.kernel.lanczos3})
  .greyscale()
  .raw()
  .toBuffer({resolveWithObject:true});
 const output=Buffer.alloc(width*height*3);
 for(let pixel=0,at=0;pixel<width*height;pixel++,at+=3){
  const light=data[pixel*info.channels]/255;
  // Bright city cores approach warm ivory while dim roads stay muted amber.
  // This monotonic mapping preserves every original radiance contour.
  const hot=Math.pow(light,1.25);
  output[at]=Math.round(light*255);
  output[at+1]=Math.round(light*(.72+.25*hot)*255);
  output[at+2]=Math.round(light*(.38+.47*hot)*255);
 }
 fs.mkdirSync(path.dirname(target),{recursive:true});
 await sharp(output,{raw:{width,height,channels:3}}).webp({lossless:true,effort:6}).toFile(target);
 console.log(`Prepared ${path.relative(process.cwd(),target)} (${width}x${height}) directly from NASA Black Marble 2016 grayscale radiance.`);
}

main().catch(error=>{console.error(error.message);process.exitCode=1;});
