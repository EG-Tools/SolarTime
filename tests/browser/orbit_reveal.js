(() => {
  const canvas=document.createElement('canvas'),gpu=new SolarSurface.DirectRenderer(canvas);
  const preview=document.createElement('canvas');preview.width=896;preview.height=220;
  const ctx=preview.getContext('2d');ctx.fillStyle='#080e17';ctx.fillRect(0,0,896,220);
  const camera={ca:1,sa:0,ce:.6,se:.8,lens:1,travel:0,anchor:{x:0,y:0,z:0}};
  const points=new Float32Array(361*3);
  for(let i=0;i<=360;i++){points[i*3]=Math.cos(i/360*Math.PI*2)*88;points[i*3+1]=Math.sin(i/360*Math.PI*2)*88;}
  const render=(progress,ink=true,userAlpha=.7)=>{
    gpu.begin();gpu.orbit('test-ink',points,{x:0,y:0,z:0},camera,1,112,100,[.5,.65,.8],userAlpha,1,1,3,ink?{progress,phase:.13,direction:-1}:null);
    const pixels=new Uint8Array(224*200*4);gpu.gl.readPixels(0,0,224,200,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,pixels);
    let count=0,alphaSum=0;for(let i=3;i<pixels.length;i+=4){alphaSum+=pixels[i];if(pixels[i]>2)count++;}
    return {count,pixels,alphaSum,drawCalls:gpu.stats.drawCalls};
  };
  try{
    gpu.resize(224,200,1);const counts=[],drawCalls=[];
    for(const [i,p] of [0,.25,.6,.8,1].entries()){
      const row=render(p);counts.push(row.count);drawCalls.push(row.drawCalls);
      if(i>0){ctx.drawImage(canvas,(i-1)*224,0);ctx.fillStyle='#a6b5c6';ctx.font='13px sans-serif';ctx.fillText(Math.round(p*100)+'%',(i-1)*224+98,209);}
    }
    const end=render(1).pixels,normal=render(1,false).pixels;
    let difference=0;for(let i=0;i<end.length;i++)difference=Math.max(difference,Math.abs(end[i]-normal[i]));
    const brightness=[0,.25,.75].map(alpha=>render(.6,true,alpha).alphaSum);
    return {counts,drawCalls,brightness,difference,uploads:gpu.stats.orbitUploads,error:gpu.gl.getError(),image:preview.toDataURL()};
  }finally{gpu.dispose();}
})()
