import {clamp,smooth} from './sequence.js';

const FIRST=import.meta.env.BASE_URL+'silver-frames/frame-0001.webp',LAST=import.meta.env.BASE_URL+'silver-frames/frame-0150.webp';
export function initLastSilverThread(form,reduced){
  const image=form.querySelector('.form-image'),poster=image.querySelector('img');
  const video=document.createElement('video');
  video.className='form-video';video.muted=true;video.defaultMuted=true;
  video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('muted','');
  video.preload='auto';video.loop=false;video.controls=false;video.playbackRate=1;
  video.setAttribute('aria-label','Девушка в хромированном платье погружается в зеркальный пол');
  image.append(video);
  const final=document.createElement('img');final.className='form-final';final.alt='Пустой зеркальный зал';image.append(final);
  const fade=document.createElement('div');fade.className='form-blackout';form.querySelector('.form-stage').append(fade);
  const retry=document.createElement('button');retry.type='button';retry.className='form-play-retry discuss';retry.textContent='ПРОДОЛЖИТЬ ↗';retry.hidden=true;form.querySelector('.form-stage').append(retry);
  let phase='idle',elapsed=0,lastNow=null,active=false,prepared=false,requested=false,blocked=false,run=0,playStarted=null,entryOpacity=0;
  function change(next){phase=next;elapsed=0;form.dataset.phase=phase;}
  function reset(){
    // Invalidate pending play promises before seeking. No delayed work survives a visit.
    run++;active=false;requested=false;blocked=false;playStarted=null;lastNow=null;entryOpacity=0;
    video.pause();if(video.readyState>=1)video.currentTime=0;
    image.style.opacity='0';video.style.opacity='0';final.style.opacity='0';fade.style.opacity='0';retry.hidden=true;
    change('idle');form.dataset.active='false';form.dataset.playback='paused';
  }
  function present(){
    if(!active||phase!=='play'||document.hidden){video.pause();return;}
    video.style.opacity='1';if(playStarted===null)playStarted=performance.now();
    form.dataset.playback='playing';
  }
  function play(){
    if(!active||phase!=='play'||requested||blocked||!video.paused||document.hidden)return;
    const token=run;requested=true;
    const rejected=error=>{
      if(token!==run)return;requested=false;
      if(!active||error?.name==='AbortError')return;
      blocked=true;retry.hidden=false;form.dataset.playback='needs-gesture';
    };
    try{
      Promise.resolve(video.play()).then(()=>{
        if(token!==run){if(!active||phase!=='play')video.pause();return;}
        requested=false;present();
      }).catch(rejected);
    }catch(error){rejected(error);}
  }
  retry.addEventListener('click',()=>{blocked=false;retry.hidden=true;play();});
  video.addEventListener('playing',present);
  video.addEventListener('pause',()=>{form.dataset.playback='paused';});
  video.addEventListener('ended',()=>{
    if(!active||phase!=='play')return;
    video.pause();final.style.opacity='1';change('end-hold');lastNow=performance.now();
  });
  video.addEventListener('error',()=>{if(!active)return;blocked=true;form.dataset.playback='media-error';retry.hidden=false;});
  function prepare(){
    if(prepared)return;prepared=true;
    poster.src=FIRST;video.poster=FIRST;final.src=LAST;
    // Fetch/decode while approaching, without starting the media clock.
    if(!reduced){video.src=import.meta.env.BASE_URL+'video/last-silver-thread.mp4';video.load();}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)reset();});
  image.style.clipPath='none';reset();
  return ()=>{
    const now=performance.now(),rect=form.getBoundingClientRect();
    // One visibility/state owner: the project's existing animation loop. No observers,
    // GSAP callbacks or independent timers can schedule a second start.
    if(rect.top<innerHeight*2.5&&rect.bottom>-innerHeight*1.5)prepare();
    if(reduced){image.style.opacity='1';fade.style.opacity='0';form.dataset.phase='reduced';return;}
    const ratio=clamp((Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0))/rect.height);
    form.dataset.visibility=ratio.toFixed(4);
    if(document.hidden||ratio===0){if(active||entryOpacity>0)reset();return;}
    // Latch a visit at 40%; do not reset on small threshold oscillations. A complete
    // exit above or below cancels it, so either direction starts fresh next time.
    if(!active){
      // Reveal the poster as soon as the next section enters normal page flow.
      // This does not start the media clock or change its 40% activation threshold.
      entryOpacity=smooth(clamp(ratio/.4));image.style.opacity=entryOpacity;
      if(ratio<.4||!poster.complete||!poster.naturalWidth)return;
      active=true;run++;lastNow=now;change('intro');form.dataset.active='true';
    }
    const delta=lastNow===null?0:Math.max(0,(now-lastNow)/1000);lastNow=now;elapsed+=delta;
    if(phase==='intro'){
      // Reveal and the 0.5-second first-frame hold share one clock, not serial delays.
      const opacity=smooth(clamp(elapsed/.25));image.style.opacity=Math.max(entryOpacity,opacity);
      if(elapsed>=.5){image.style.opacity='1';change('play');play();}
    }else if(phase==='play'){
      play();
    }else if(phase==='end-hold'){
      if(elapsed>=.5)change('fade');
    }else if(phase==='fade'){
      fade.style.opacity=smooth(clamp(elapsed/.8));
      if(elapsed>=.8){fade.style.opacity='1';change('complete');}
    }
    Object.assign(form.dataset,{phase,elapsed:elapsed.toFixed(3),active:String(active),run:String(run)});
  };
}
