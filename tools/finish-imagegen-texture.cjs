'use strict';
const path=require('node:path'),sharp=require('sharp');

async function main(){
 const [, , sourceArg,targetArg,widthArg='4096']=process.argv;
 if(!sourceArg||!targetArg)throw Error('Usage: node tools/finish-imagegen-texture.cjs <source> <target> [width]');
 const source=path.resolve(sourceArg),target=path.resolve(targetArg),width=Number(widthArg),height=width/2;
 if(!Number.isInteger(width)||width<512||!Number.isInteger(height))throw Error('Width must be an even integer of at least 512.');
 const metadata=await sharp(source).metadata();
 if(!metadata.width||!metadata.height||metadata.width!==metadata.height*2)throw Error(`ImageGen texture must be exactly 2:1, got ${metadata.width}x${metadata.height}.`);
 const result=await sharp(source).resize(width,height,{fit:'fill',kernel:sharp.kernel.lanczos3}).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const pixels=Buffer.from(result.data),channels=result.info.channels,index=(x,y,c)=>(y*width+x)*channels+c;
 const seamBand=Math.max(2,Math.min(64,Math.round(width*.015)));
 for(let y=0;y<height;y++)for(let i=0;i<seamBand;i++){
  const t=i/Math.max(1,seamBand-1),weight=(1-t)*(1-t)*(1+2*t);
  for(let c=0;c<channels;c++){
   const li=index(i,y,c),ri=index(width-1-i,y,c),left=pixels[li],right=pixels[ri],shared=(left+right)*.5;
   pixels[li]=Math.round(left*(1-weight)+shared*weight);pixels[ri]=Math.round(right*(1-weight)+shared*weight);
  }
 }
 const poleRows=Math.max(2,Math.min(24,Math.floor(height/64)));
 for(const top of [true,false])for(let i=0;i<poleRows;i++){
  const y=top?i:height-1-i,weight=((poleRows-i)/poleRows)**2,mean=new Array(channels).fill(0);
  for(let x=0;x<width;x++)for(let c=0;c<channels;c++)mean[c]+=pixels[index(x,y,c)];
  for(let c=0;c<channels;c++)mean[c]/=width;
  for(let x=0;x<width;x++)for(let c=0;c<channels;c++){const at=index(x,y,c);pixels[at]=Math.round(pixels[at]*(1-weight)+mean[c]*weight);}
 }
 for(let y=0;y<height;y++)for(let c=0;c<channels;c++){
  const left=index(0,y,c),right=index(width-1,y,c),shared=Math.round((pixels[left]+pixels[right])*.5);pixels[left]=shared;pixels[right]=shared;
 }
 await sharp(pixels,{raw:{width,height,channels}}).webp({quality:94,effort:6,smartSubsample:true}).toFile(target);
 console.log(`Finished ${path.relative(process.cwd(),target)} (${width}x${height}).`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
