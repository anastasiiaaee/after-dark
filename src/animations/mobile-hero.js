// Mobile-only media readiness and native-scroll geometry; no scroll interception.
export function initMobileHero(section,stage,video,reduced){
 const query=matchMedia('(max-width: 480px) and (pointer: coarse)');
 if(!matchMedia('(pointer: coarse)').matches)return null;
 let priming=false,handoff='full',lastY=scrollY,exitArmed=true,holdSpace=0;
 let fullHeight=stage.offsetHeight,scrollDistance=Math.max(1,section.offsetHeight-stage.offsetHeight);
 function measure(){
  if(!query.matches)return;
  fullHeight=parseFloat(getComputedStyle(stage).maxHeight)||stage.offsetHeight;
  scrollDistance=Math.max(1,Math.round(fullHeight*3.5));
 }
 measure();
 window.addEventListener('resize',measure,{passive:true});
 const distance=()=>scrollDistance;
 function setHandoff(value){handoff=value;section.dataset.mobileHandoff=value;}
 setHandoff('full');
 const progress=()=>Math.max(0,Math.min(1,-section.getBoundingClientRect().top/distance()));
 const decoded=()=>{
  if(video.readyState>=2)stage.dataset.mobileFrame='true';
 };
 video.addEventListener('loadeddata',decoded);
 video.addEventListener('seeked',decoded);
 decoded();
 function prime(){
  if(reduced||priming||!query.matches||video.readyState>=2)return;
  // iOS may preload metadata only. A trusted gesture enables the media pipeline;
  // pause as soon as play resolves, before returning control to scroll seeking.
  priming=true;
  try{
   Promise.resolve(video.play()).then(()=>{video.pause();priming=false;decoded();},()=>{
    video.pause();priming=false;
   });
  }catch{video.pause();priming=false;}
 }
 section.addEventListener('touchstart',prime,{passive:true});
 section.addEventListener('touchend',prime,{passive:true});
 section.addEventListener('pointerdown',prime,{passive:true});
 return {
  get active(){return query.matches;},distance,progress,
  // On return, restore the full-screen stage before displaying earlier frames.
  canSeek:()=>!priming&&video.readyState>=2&&handoff!=='restoring',
  frame(value){
   // Follow the existing face turn within the narrow crop, then center the eye.
   const p=Math.max(0,Math.min(1,value/.55)),ease=p*p*(3-2*p);
   stage.style.setProperty('--hero-mobile-focus',`${30+20*ease}%`);
   const y=scrollY,raw=progress(),movingUp=y<lastY,movingDown=y>lastY;
   lastY=y;
   if(reduced)return;
   const finished=value>=1-1e-7&&Number.isFinite(video.duration)&&!video.seeking&&video.currentTime>=video.duration-.002;
   if(handoff==='exit'&&((movingUp&&section.getBoundingClientRect().bottom>0)||raw<1)){
    exitArmed=false;setHandoff('restoring');
   }
   if(raw<1||movingDown)exitArmed=true;
   if(handoff!=='exit'){
    // Reserve real flow space if a fast gesture passes the endpoint while the
    // existing 0.4s scrub is still finishing. Never move the page's scroll offset.
    const top=section.getBoundingClientRect().top+y;
    const nextHold=Math.max(0,y-top-distance());
    if(nextHold!==holdSpace){holdSpace=nextHold;section.style.setProperty('--hero-mobile-hold-space',`${holdSpace}px`);}
   }
   if(handoff==='restoring'&&stage.getBoundingClientRect().height>=fullHeight-.5)setHandoff('full');
   // Collapse only the already-black exit footprint after the final seek finishes.
   if(handoff==='full'&&raw>=1&&finished&&!movingUp&&exitArmed)setHandoff('exit');
  }
 };
}
