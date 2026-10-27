// Mobile-only media readiness and native-scroll geometry; no scroll interception.
export function initMobileHero(section,stage,video,reduced){
 const query=matchMedia('(max-width: 430px) and (pointer: coarse)');
 if(!matchMedia('(pointer: coarse)').matches)return null;
 let priming=false;
 const distance=()=>Math.max(1,section.offsetHeight-stage.offsetHeight);
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
  canSeek:()=>!priming&&video.readyState>=2,
  frame(value){
   // Follow the existing face turn within the narrow crop, then center the eye.
   const p=Math.max(0,Math.min(1,value/.55)),ease=p*p*(3-2*p);
   stage.style.setProperty('--hero-mobile-focus',`${30+20*ease}%`);
  }
 };
}
