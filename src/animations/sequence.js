import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {initMobileHero} from './mobile-hero.js';

gsap.registerPlugin(ScrollTrigger);

export function initSequence(reduced){
  const section=document.querySelector('.first-contact'),stage=section.querySelector('.stage');
  const video=stage.querySelector('.hero-video'),copy=stage.querySelector('.hero-copy'),shade=stage.querySelector('.hero-shade');
  const mobileHero=initMobileHero(section,stage,video,reduced);
  let trigger=null,duration=0,targetTime=0,progress=0,inFlight=false,initialized=false;
  let seeks=0,seekStarted=0,maxSeekMs=0,lastPresented=null;
  const EPSILON=.001;
  const scrub={progress:0};
  let scrubTo=null;
  function updateTarget(value,immediate=false){
    const next=reduced?0:clamp(value),changed=next!==progress;
    progress=next;
    // Duration is read from the file, never assumed to be eleven seconds.
    targetTime=Math.min(progress*duration,Math.max(0,duration-EPSILON));
    // One video-only smoothing layer. Retarget the same tween, never currentTime.
    // The existing main-loop interpolation affects text only, not this progress.
    if(immediate||reduced){
      scrubTo?.tween.kill();scrubTo=null;scrub.progress=progress;
    }else if(changed){
      if(!scrubTo)scrubTo=gsap.quickTo(scrub,'progress',{duration:.4,ease:'power2.out'});
      scrubTo(progress);
    }
    Object.assign(stage.dataset,{progress:progress.toFixed(6),targetTime:targetTime.toFixed(6),duration:String(duration)});
  }
  function metadata(){
    if(initialized||!Number.isFinite(video.duration)||video.duration<=0)return;
    initialized=true;duration=video.duration;
    if(!reduced){
      // Preserve the original CSS sticky range: 450vh section minus its 100vh stage.
      // This trigger only measures progress; it adds no pin, spacer or timeline.
      trigger=ScrollTrigger.create({
        id:'hero-video-scroll',trigger:section,start:'top top',
        end:()=>`+=${mobileHero?.active?mobileHero.distance():Math.max(1,section.offsetHeight-innerHeight)}`,
        invalidateOnRefresh:true,
        onUpdate:self=>{if(!mobileHero?.active)updateTarget(self.progress);},
        onRefresh:self=>{if(!mobileHero?.active)updateTarget(self.progress);}
      });
      updateTarget(mobileHero?.active?mobileHero.progress():trigger.progress,true);
    }else updateTarget(0,true);
    stage.dataset.ready='true';
  }
  video.addEventListener('loadedmetadata',metadata);
  video.addEventListener('durationchange',()=>{
    if(!initialized){metadata();return;}
    if(Number.isFinite(video.duration)&&video.duration>0){duration=video.duration;updateTarget(progress);}
  });
  video.addEventListener('seeked',()=>{
    inFlight=false;
    if(seekStarted)maxSeekMs=Math.max(maxSeekMs,performance.now()-seekStarted);
    Object.assign(stage.dataset,{seeking:'false',currentTime:video.currentTime.toFixed(6),maxSeekMs:maxSeekMs.toFixed(2)});
    // The next existing animation frame reads only the newest targetTime.
  });
  video.addEventListener('error',()=>{stage.dataset.mediaError=String(video.error?.code||'unknown');});
  if('requestVideoFrameCallback' in video){
    const presented=(_,metadata)=>{
      lastPresented=metadata.mediaTime;stage.dataset.presentedTime=String(lastPresented);
      video.requestVideoFrameCallback(presented);
    };
    video.requestVideoFrameCallback(presented);
  }
  if(video.readyState>=1)metadata();
  return function render(y){
    // Keep the existing title/shade choreography; it does not modify video pixels.
    const mobile=mobileHero?.active;
    const copyProgress=reduced?0:mobile?mobileHero.progress():clamp(y/Math.max(1,section.offsetHeight-innerHeight));
    if(mobile){
      if(initialized)updateTarget(copyProgress);
      mobileHero.frame(reduced?0:scrub.progress);
      // Some mobile media pipelines finish a seek without a useful seeked event.
      // Trust the native flag, retaining the same single latest-target controller.
      if(inFlight&&!video.seeking)inFlight=false;
    }
    copy.style.opacity=1-smooth(clamp(copyProgress/.09));
    shade.style.opacity=1-smooth(clamp(copyProgress/.12));
    if(!initialized||reduced)return;
    const seekTargetTime=Math.min(clamp(scrub.progress)*duration,Math.max(0,duration-EPSILON));
    // At most one seek in flight. Recompute from the newest smoothed scalar after
    // each seek; no intermediate requests are retained while the decoder is busy.
    if(!inFlight&&!video.seeking&&(mobile?mobileHero.canSeek():video.readyState>=1)&&Math.abs(seekTargetTime-video.currentTime)>=EPSILON){
      inFlight=true;seekStarted=performance.now();seeks++;
      try{video.currentTime=seekTargetTime;}
      catch{inFlight=false;stage.dataset.mediaError='seek-failed';}
    }
    Object.assign(stage.dataset,{currentTime:video.currentTime.toFixed(6),smoothedProgress:scrub.progress.toFixed(6),smoothedTime:seekTargetTime.toFixed(6),seeking:String(inFlight||video.seeking),seeks:String(seeks),scrollDistance:String(mobile?mobileHero.distance():section.offsetHeight-innerHeight),triggers:String(ScrollTrigger.getAll().filter(t=>t.vars.id==='hero-video-scroll').length)});
  };
}
export const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>x*x*(3-2*x);
