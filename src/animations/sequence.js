import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initSequence(reduced){
  const section=document.querySelector('.first-contact'),stage=section.querySelector('.stage');
  const video=stage.querySelector('.hero-video'),copy=stage.querySelector('.hero-copy'),shade=stage.querySelector('.hero-shade');
  let trigger=null,duration=0,targetTime=0,progress=0,inFlight=false,initialized=false;
  let seeks=0,seekStarted=0,maxSeekMs=0,lastPresented=null;
  const EPSILON=.001;
  function updateTarget(value){
    progress=reduced?0:clamp(value);
    // Duration is read from the file, never assumed to be eleven seconds.
    targetTime=Math.min(progress*duration,Math.max(0,duration-EPSILON));
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
        end:()=>`+=${Math.max(1,section.offsetHeight-innerHeight)}`,
        invalidateOnRefresh:true,
        onUpdate:self=>updateTarget(self.progress),
        onRefresh:self=>updateTarget(self.progress)
      });
      updateTarget(trigger.progress);
    }else updateTarget(0);
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
    const copyProgress=reduced?0:clamp(y/Math.max(1,section.offsetHeight-innerHeight));
    copy.style.opacity=1-smooth(clamp(copyProgress/.09));
    shade.style.opacity=1-smooth(clamp(copyProgress/.12));
    if(!initialized||reduced)return;
    // At most one seek in flight. Scroll updates overwrite a scalar, never a queue.
    if(!inFlight&&!video.seeking&&(video.readyState>=1)&&Math.abs(targetTime-video.currentTime)>=EPSILON){
      inFlight=true;seekStarted=performance.now();seeks++;
      try{video.currentTime=targetTime;}
      catch{inFlight=false;stage.dataset.mediaError='seek-failed';}
    }
    Object.assign(stage.dataset,{currentTime:video.currentTime.toFixed(6),seeking:String(inFlight||video.seeking),seeks:String(seeks),scrollDistance:String(section.offsetHeight-innerHeight),triggers:String(ScrollTrigger.getAll().filter(t=>t.vars.id==='hero-video-scroll').length)});
  };
}
export const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=x=>x*x*(3-2*x);
