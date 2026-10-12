// Compare the real travel sphere shader with the foreground Canvas point pass.
// In particular, a close, off-axis sphere is not its centre's projected circle.
(()=>{
 const size=256,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const gl=canvas.getContext('webgl',{alpha:true,depth:true,antialias:false,preserveDrawingBuffer:true});
 const overlay=document.createElement('canvas');overlay.width=overlay.height=size;const c=overlay.getContext('2d');
 const frame={u:{x:1,y:0,z:0},pole:{x:0,y:1,z:0},v:{x:0,y:0,z:1}};
 const tour=new SolarRingTour({frame,radius:50,width:size,height:size,screen:{x:128,y:128},seed:123});
 tour.job={id:'saturn'};
 tour.atlasImage.src='';tour.atlasImage=null;
 tour.points=tour.fogPoints=tour.chipPoints=new Float32Array(0);tour.buildInstanceLayers();
 const textures=[];
 function texture(alpha){const tex=gl.createTexture();textures.push(tex);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,alpha]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return tex;}
 const planet=texture(255),ring=texture(0),quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
 const gpu={gl,quad,textures:new Map([['saturn',{texture:planet,width:1}],['saturn-ring',{texture:ring,width:1}]]),resetBindings(){},stats:{drawCalls:0}};
 const r=Object.assign(Object.create(SolarRenderer.prototype),{w:size,h:size,dpr:1,ringTour:tour});
 const rows=[];
 try{
  gl.viewport(0,0,size,size);tour.prepare(gpu);
  const poses=[
   {name:'off-axis cruise',eye:[1.25,0,-1.6],perspective:1,orthoScale:2},
   {name:'near-plane limb',eye:[1.1,0,-.25],perspective:1,orthoScale:2},
   {name:'entry blend',eye:[1.25,.2,-1.6],perspective:.6,orthoScale:2},
   {name:'orthographic entry',eye:[.5,0,-3],perspective:0,orthoScale:2}
  ];
  for(const config of poses){
   const pose={...config,right:[1,0,0],up:[0,1,0],forward:[0,0,1],basis:new Float32Array([1,0,0,0,1,0,0,0,1]),offset:[0,0],fov:72};tour.pose=pose;
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);tour.draw(gpu,size,size);
   const pixels=new Uint8Array(size*size*4);gl.readPixels(0,0,size,size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const f=size/(2*Math.tan(pose.fov*Math.PI/360)),depth=-pose.eye[2],den=(1-pose.perspective)*pose.orthoScale+pose.perspective*depth;
   const blocker={body:{id:'saturn'},r:f/den,screen:{x:128-f*pose.eye[0]/den,y:128+f*pose.eye[1]/den,occlusionDepth:-depth,behind:den<=0}};
   const solid=(x,y)=>x>=0&&x<size&&y>=0&&y<size&&pixels[((size-1-y)*size+x)*4+3]===255;
   const points=[];
   for(let y=6;y<size-6;y+=9)for(let x=6;x<size-6;x+=9){
    if(![[0,0],[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>solid(x+dx,y+dy)))continue;
    points.push({body:{id:points.length%2?'sun':'earth',color:'#ffffff'},r:.15,screen:{x:x+.5,y:y+.5,occlusionDepth:-1000,z:-1000,behind:false}});
   }
   c.clearRect(0,0,size,size);for(const point of points)r.drawBodyPoint(c,point,[blocker]);
   const behind=c.getImageData(0,0,size,size).data;let leaked=0;
   for(const point of points){const {x,y}=point.screen;if(behind[(Math.floor(y)*size+Math.floor(x))*4+3]>0)leaked++;}
   c.clearRect(0,0,size,size);for(const point of points){point.screen.occlusionDepth=1;r.drawBodyPoint(c,point,[blocker]);}
   const front=c.getImageData(0,0,size,size).data;let foreground=0;
   for(const point of points){const {x,y}=point.screen;if(front[(Math.floor(y)*size+Math.floor(x))*4+3]>0)foreground++;}
   rows.push({name:config.name,samples:points.length,leaked,foreground});
  }
  return {rows,error:gl.getError()};
 }finally{tour.dispose();textures.forEach(tex=>gl.deleteTexture(tex));gl.deleteBuffer(quad);gl.getExtension('WEBGL_lose_context')?.loseContext();}
})()
