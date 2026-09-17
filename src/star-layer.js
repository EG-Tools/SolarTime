/* Solar Time v0.45 r9 — split high-resolution star layer from the lower-resolution panorama. */
(function(root){
  'use strict';
  const Sky=root.SolarSky;
  if(!Sky?.prototype||Sky.prototype.__solarSplitStarLayerInstalled)return;

  const BACKGROUND_PIXEL_BUDGET=3145728;
  const STAR_PIXEL_BUDGET=8388608;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function compile(g,type,source){
    const shader=g.createShader(type);
    if(!shader)throw Error('Cannot allocate split-star shader');
    g.shaderSource(shader,source);g.compileShader(shader);
    if(!g.getShaderParameter(shader,g.COMPILE_STATUS)){
      const message=g.getShaderInfoLog(shader)||'Split-star shader compilation failed';
      g.deleteShader(shader);throw Error(message);
    }
    return shader;
  }

  function dataForStars(){
    const direct=root.SolarAssets?.starData;
    if(direct instanceof Float32Array&&direct.length>=6)return direct;
    const stars=root.SolarAssets?.stars;
    if(!Array.isArray(stars)||!stars.length)return new Float32Array(0);
    const data=new Float32Array(stars.length*6);
    for(let i=0;i<stars.length;i++)data.set(stars[i],i*6);
    return data;
  }

  function createCanvas(sky){
    if(sky.__solarStarCanvas?.isConnected)return sky.__solarStarCanvas;
    const canvas=document.createElement('canvas');
    canvas.id='star-particles';canvas.setAttribute('aria-hidden','true');
    sky.canvas.insertAdjacentElement('afterend',canvas);
    sky.__solarStarCanvas=canvas;
    return canvas;
  }

  function starRatio(sky){
    const w=Math.max(1,sky.w||1),h=Math.max(1,sky.h||1),dpr=Math.max(.1,sky.__solarRequestedDpr||1);
    return Math.min(dpr,1.5,Math.sqrt(STAR_PIXEL_BUDGET/(w*h)));
  }

  function resizeStarLayer(sky){
    const canvas=sky.__solarStarCanvas;
    if(!canvas||!sky.w||!sky.h)return;
    const ratio=starRatio(sky),width=Math.max(1,Math.round(sky.w*ratio)),height=Math.max(1,Math.round(sky.h*ratio));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;sky.__solarStarPose=null;}
    if(sky.stats){sky.stats.starBufferPixels=width*height;sky.stats.backgroundBufferPixels=sky.canvas.width*sky.canvas.height;}
  }

  function setupStarLayer(sky){
    if(sky.__solarStarLayer?.gl&&!sky.__solarStarLayer.lost)return sky.__solarStarLayer;
    const canvas=createCanvas(sky);
    let g;
    try{g=canvas.getContext('webgl',{alpha:true,depth:false,stencil:false,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false});}
    catch(_){return null;}
    if(!g)return null;
    const precision=g.getShaderPrecisionFormat(g.FRAGMENT_SHADER,g.HIGH_FLOAT)?.precision?'highp':'mediump';
    const vertex=compile(g,g.VERTEX_SHADER,`precision ${precision} float;
      attribute vec3 position,appearance;uniform vec3 right,down,forward;uniform vec2 size;uniform float fov,pointScale,seconds;
      varying float intensity;
      void main(){
       float z=dot(position,forward),phase=appearance.z;
       float pulse=pow(max(0.,sin((seconds+phase)/(6.+phase)*6.28318530718)),16.);
       intensity=appearance.y*(.55+pulse*.65);
       if(z>=-.08){gl_Position=vec4(2.,2.,1.,1.);gl_PointSize=1.;return;}
       vec2 ndc=vec2(dot(position,right)/(-z*fov*size.x/size.y),-dot(position,down)/(-z*fov));
       gl_Position=vec4(ndc,0.,1.);gl_PointSize=clamp(appearance.x*10.*pointScale,1.,30.);
      }`);
    const fragment=compile(g,g.FRAGMENT_SHADER,`precision ${precision} float;varying float intensity;
      void main(){
       vec2 q=gl_PointCoord-.5;float d=length(q);
       float halo=1.-smoothstep(.08,.5,d),core=1.-smoothstep(.015,.21,d);
       float cross=(1.-smoothstep(.012,.042,min(abs(q.x),abs(q.y))))*(1.-smoothstep(.12,.5,max(abs(q.x),abs(q.y))));
       float alpha=(halo*.24+core*.94+cross*.14)*intensity;if(alpha<.002)discard;
       vec3 color=mix(vec3(.45,.66,.94),vec3(1.,.99,.96),core);
       gl_FragColor=vec4(color,alpha);
      }`);
    const program=g.createProgram();g.attachShader(program,vertex);g.attachShader(program,fragment);g.linkProgram(program);g.deleteShader(vertex);g.deleteShader(fragment);
    if(!g.getProgramParameter(program,g.LINK_STATUS)){const message=g.getProgramInfoLog(program)||'Split-star program link failed';g.deleteProgram(program);return null;}
    const buffer=g.createBuffer(),a={position:g.getAttribLocation(program,'position'),appearance:g.getAttribLocation(program,'appearance')};
    const u=Object.fromEntries(['right','down','forward','size','fov','pointScale','seconds'].map(name=>[name,g.getUniformLocation(program,name)]));
    const layer={canvas,g,program,buffer,a,u,count:0,lost:false,lastVisible:false};
    sky.__solarStarLayer=layer;
    const upload=data=>{
      if(!(data instanceof Float32Array)||!data.length)return;
      g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,data,g.STATIC_DRAW);
      layer.count=Math.floor(data.length/6);sky.__solarStarPose=null;
    };
    sky.__uploadStarLayer=upload;
    upload(dataForStars());
    g.clearColor(0,0,0,0);
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();layer.lost=true;sky.__solarStarPose=null;},{once:true});
    canvas.addEventListener('webglcontextrestored',()=>{sky.__solarStarLayer=null;sky.__uploadStarLayer=null;setupStarLayer(sky);resizeStarLayer(sky);},{once:true});
    resizeStarLayer(sky);
    return layer;
  }

  function clearStars(layer){
    if(!layer?.gl||layer.lost)return;
    layer.gl.viewport(0,0,layer.canvas.width,layer.canvas.height);
    layer.gl.clear(layer.gl.COLOR_BUFFER_BIT);layer.lastVisible=false;
  }

  function drawStars(sky,seconds,camera,options){
    const layer=setupStarLayer(sky);
    if(!layer||layer.lost||!sky.panAxes)return false;
    resizeStarLayer(sky);
    const count=Math.min(layer.count,Math.max(0,Number(sky.stats?.visibleStarCount??layer.count)));
    if(!options.twinkle||!count){if(layer.lastVisible)clearStars(layer);return true;}
    const tick=Math.floor(seconds*30),pose=sky.__solarStarPose;
    if(pose&&pose.a===camera.azimuth&&pose.e===camera.elevation&&pose.offset===sky.offset&&pose.count===count&&pose.tick===tick&&pose.w===layer.canvas.width&&pose.h===layer.canvas.height)return true;
    const g=layer.g;if(g.isContextLost()){layer.lost=true;return false;}
    g.viewport(0,0,layer.canvas.width,layer.canvas.height);g.clear(g.COLOR_BUFFER_BIT);
    g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE);g.useProgram(layer.program);g.bindBuffer(g.ARRAY_BUFFER,layer.buffer);
    g.enableVertexAttribArray(layer.a.position);g.vertexAttribPointer(layer.a.position,3,g.FLOAT,false,24,0);
    g.enableVertexAttribArray(layer.a.appearance);g.vertexAttribPointer(layer.a.appearance,3,g.FLOAT,false,24,12);
    for(const key of ['right','down','forward'])g.uniform3fv(layer.u[key],sky.panAxes[key]);
    g.uniform2f(layer.u.size,sky.w,sky.h);g.uniform1f(layer.u.fov,sky.tanFov);
    g.uniform1f(layer.u.pointScale,layer.canvas.width/sky.w);g.uniform1f(layer.u.seconds,seconds);
    g.drawArrays(g.POINTS,0,count);g.disable(g.BLEND);
    layer.lastVisible=true;sky.__solarStarPose={a:camera.azimuth,e:camera.elevation,offset:sky.offset,count,tick,w:layer.canvas.width,h:layer.canvas.height};
    return true;
  }

  const originalResize=Sky.prototype.resize;
  Sky.prototype.resize=function(w,h,dpr){
    this.__solarRequestedDpr=Math.max(.1,dpr||1);
    const backgroundRatio=Math.min(this.__solarRequestedDpr,1,Math.sqrt(BACKGROUND_PIXEL_BUDGET/Math.max(1,w*h)));
    const result=originalResize.call(this,w,h,backgroundRatio);
    createCanvas(this);resizeStarLayer(this);return result;
  };

  const originalDraw=Sky.prototype.draw;
  Sky.prototype.draw=function(seconds,camera,options={}){
    const layer=setupStarLayer(this),splitReady=!!(this.gl&&!this.gl.isContextLost?.()&&layer&&!layer.lost);
    const backgroundOptions=splitReady&&options.twinkle?{...options,twinkle:false}:options;
    const result=originalDraw.call(this,seconds,camera,backgroundOptions);
    if(splitReady&&!this.paused&&!this.disposed)drawStars(this,seconds,camera,options);else if(layer?.lastVisible)clearStars(layer);
    return result;
  };

  const originalInvalidate=Sky.prototype.invalidate;
  Sky.prototype.invalidate=function(){const result=originalInvalidate.call(this);this.__solarStarPose=null;return result;};

  const originalDispose=Sky.prototype.dispose;
  Sky.prototype.dispose=function(){
    const layer=this.__solarStarLayer;
    if(layer?.g){
      try{layer.g.deleteBuffer(layer.buffer);layer.g.deleteProgram(layer.program);layer.g.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){}
    }
    this.__solarStarCanvas?.remove();this.__solarStarCanvas=null;this.__solarStarLayer=null;this.__uploadStarLayer=null;this.__solarStarPose=null;
    return originalDispose.call(this);
  };

  Object.defineProperty(Sky.prototype,'__solarSplitStarLayerInstalled',{value:true});
  root.SolarStarLayer=Object.freeze({BACKGROUND_PIXEL_BUDGET,STAR_PIXEL_BUDGET});
})(window);
