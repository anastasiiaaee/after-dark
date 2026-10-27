import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const COUNT=330,DECODED_LIMIT=12,ENCODED_LIMIT=16*1024*1024,CONNECTIONS=2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>x*x*(3-2*x);
const FRAME_BASE=import.meta.env.BASE_URL+'hero-canvas-frames/';
const url=i=>FRAME_BASE+`frame-${String(i+1).padStart(4,'0')}.webp`;
const ANCHORS=new Set([COUNT-1,...Array.from({length:11},(_,i)=>i*30)]);

export function initSequence(reduced){
  const section=document.querySelector('.first-contact'),stage=section.querySelector('.stage');
  const canvas=stage.querySelector('canvas'),poster=stage.querySelector('.hero-canvas-poster');
  const copy=stage.querySelector('.hero-copy'),shade=stage.querySelector('.hero-shade');
  const ctx=canvas.getContext('2d',{alpha:false});
  const bitmaps=new Map(),blobs=new Map(),pending=new Map(),failed=new Set();
  let target=0,direction=1,shown=-1,lastProgress=-1,encodedBytes=0;
  let visible=true,destroyed=false,decoding=false,drawRAF=0;
  let copyProgress=-1,trigger=null,posterPending=true;
  const stats={target:0,shown:-1,draws:0,requests:0,aborted:0,decoded:0,closed:0,peakBitmaps:0,encodedBytes:0,peakEncodedBytes:0,errors:[],firstPaintMs:null};
  window.heroCanvas={stats,limits:{decoded:DECODED_LIMIT,encoded:ENCODED_LIMIT,connections:CONNECTIONS},snapshot:()=>({...stats,bitmaps:bitmaps.size,pending:pending.size,decoding,active:active(),canvas:[canvas.width,canvas.height]})};
  const active=()=>visible&&!document.hidden&&!destroyed;
  function release(i){const b=bitmaps.get(i);if(b){b.close();bitmaps.delete(i);stats.closed++;}}
  function trimBitmaps(){
    while(bitmaps.size>DECODED_LIMIT){
      const candidates=[...bitmaps.keys()].filter(i=>i!==target&&i!==shown&&i!==0&&i!==COUNT-1);
      const victim=candidates.sort((a,b)=>Math.abs(b-target)-Math.abs(a-target))[0];
      if(victim===undefined)break;release(victim);
    }
    stats.peakBitmaps=Math.max(stats.peakBitmaps,bitmaps.size);
  }
  function remember(i,blob){
    if(blob.size>ENCODED_LIMIT)return;
    if(blobs.has(i)){encodedBytes-=blobs.get(i).size;blobs.delete(i);}
    while(encodedBytes+blob.size>ENCODED_LIMIT&&blobs.size){
      const first=[...blobs.keys()].find(key=>!ANCHORS.has(key)&&key!==target);
      if(first===undefined)return;encodedBytes-=blobs.get(first).size;blobs.delete(first);
    }
    blobs.set(i,blob);encodedBytes+=blob.size;stats.encodedBytes=encodedBytes;
    stats.peakEncodedBytes=Math.max(stats.peakEncodedBytes,encodedBytes);
  }
  function nearby(){
    const result=[target];
    // Keep a decoded neighbourhood, then a small compressed look-ahead.
    result.push(target+direction,target-direction,target+2*direction);
    return [...new Set(result)].filter(i=>i>=0&&i<COUNT);
  }
  function plan(){
    const near=nearby(),result=[target,COUNT-1,...near.slice(1)];
    for(let n=3;n<=8;n++)result.push(target+n*direction);
    result.push(target-2*direction,target-3*direction);
    // A few compressed anchors permit a cheap preview on large jumps. They are
    // never all decoded, and no background download of all 330 images is started.
    result.push(...ANCHORS);
    return [...new Set(result)].filter(i=>i>=0&&i<COUNT);
  }
  function resize(){
    if(!active())return;
    const {width,height}=stage.getBoundingClientRect();
    const scale=Math.min(devicePixelRatio||1,1920/width,1080/height);
    const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;shown=-1;stats.shown=-1;scheduleDraw();}
  }
  function scheduleDraw(){if(!drawRAF&&active())drawRAF=requestAnimationFrame(draw);}
  function draw(){
    drawRAF=0;if(!active()||!bitmaps.size)return;
    const closest=[...bitmaps.keys()].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
    if(shown<0&&target===0&&closest!==0)return;
    // A late decode must never move the picture farther away from the latest target.
    if(shown>=0&&Math.abs(closest-target)>Math.abs(shown-target))return;
    if(shown===closest)return;
    const bitmap=bitmaps.get(closest),scale=Math.max(canvas.width/bitmap.width,canvas.height/bitmap.height);
    const w=bitmap.width*scale,h=bitmap.height*scale;
    ctx.drawImage(bitmap,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    shown=closest;stats.shown=shown;stats.draws++;stats.firstPaintMs??=performance.now();
    canvas.style.visibility='visible';poster.style.visibility='hidden';
    stage.dataset.canvasFrame=String(shown);trimBitmaps();
  }
  async function decodeNext(){
    if(decoding||!active())return;
    let next=nearby().find(i=>blobs.has(i)&&!bitmaps.has(i)&&!failed.has(i));
    // Keep the true final frame ready for a fast exit or reverse entry.
    if(next===undefined&&blobs.has(COUNT-1)&&!bitmaps.has(COUNT-1)&&!failed.has(COUNT-1))next=COUNT-1;
    // If exact data is still in flight, show the nearest already downloaded anchor.
    if(next===undefined&&!bitmaps.has(target)){
      const nearest=[...blobs.keys()].filter(i=>!failed.has(i)).sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];
      if(nearest!==undefined&&!bitmaps.has(nearest)&&(shown<0||Math.abs(nearest-target)<Math.abs(shown-target)))next=nearest;
    }
    if(next===undefined)return;
    decoding=true;
    try{
      const bitmap=await createImageBitmap(blobs.get(next));stats.decoded++;
      if(!active()||destroyed){bitmap.close();stats.closed++;}
      else{
        // Close an old bitmap before admitting another, so even transient usage
        // cannot exceed the declared buffer (apart from this one decode in flight).
        if(bitmaps.size>=DECODED_LIMIT){
          const victim=[...bitmaps.keys()].filter(i=>i!==target&&i!==shown&&i!==0&&i!==COUNT-1).sort((a,b)=>Math.abs(b-target)-Math.abs(a-target))[0];
          if(victim!==undefined)release(victim);
        }
        bitmaps.set(next,bitmap);trimBitmaps();scheduleDraw();
      }
    }catch(e){failed.add(next);stats.errors.push({frame:next,message:String(e)});}
    finally{decoding=false;void decodeNext();}
  }
  function pump(){
    if(!active()||reduced)return;
    void decodeNext();
    for(const i of plan()){
      if(pending.size>=CONNECTIONS)break;
      if((i===0&&posterPending)||blobs.has(i)||bitmaps.has(i)||pending.has(i)||failed.has(i))continue;
      const controller=new AbortController();pending.set(i,{controller,direction,urgent:i===target});stats.requests++;
      fetch(url(i),{signal:controller.signal,priority:i===target?'high':'low',cache:'force-cache'})
        .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);if(!r.headers.get('content-type')?.startsWith('image/'))throw new Error('Invalid frame content type');return r.blob();})
        .then(blob=>{if(!controller.signal.aborted){remember(i,blob);void decodeNext();}})
        .catch(e=>{if(e.name!=='AbortError'){failed.add(i);stats.errors.push({frame:i,message:String(e)});}})
        .finally(()=>{if(pending.get(i)?.controller===controller)pending.delete(i);pump();});
    }
  }
  function cancelObsolete(turned=false){
    for(const [i,item] of pending){
      // Do not restart requests for every small wheel movement. Let nearby work
      // finish; only direction changes or truly distant jumps invalidate it.
      if(!active()||(turned&&Math.abs(i-target)>4)||Math.abs(i-target)>45){
        item.controller.abort();pending.delete(i);stats.aborted++;
      }
    }
  }
  function prioritizeTarget(){
    if(blobs.has(target)||bitmaps.has(target)||pending.has(target)||pending.size<CONNECTIONS)return;
    // Reserve capacity for the latest requested frame. Never cancel another
    // urgent request for every wheel tick: that would starve decoding on slow links.
    const victim=[...pending.entries()].filter(([i,item])=>!item.urgent&&Math.abs(i-target)>4)
      .sort((a,b)=>Math.abs(b[0]-target)-Math.abs(a[0]-target))[0];
    if(victim){victim[1].controller.abort();pending.delete(victim[0]);stats.aborted++;}
  }
  function setProgress(p){
    p=reduced?0:clamp(p);const next=Math.min(COUNT-1,Math.floor(p*COUNT));
    stage.dataset.progress=String(p);if(next===target&&lastProgress>=0)return;
    const previous=target;target=next;stats.target=target;lastProgress=p;
    const newDirection=Math.sign(target-previous)||direction,turned=direction!==newDirection;direction=newDirection;
    cancelObsolete(turned);prioritizeTarget();scheduleDraw();void decodeNext();pump();
  }
  async function firstFrame(){
    try{
      await poster.decode();if(destroyed)return;
      const bitmap=await createImageBitmap(poster);stats.decoded++;
      if(active()){bitmaps.set(0,bitmap);trimBitmaps();scheduleDraw();}
      else{bitmap.close();stats.closed++;}
    }catch(e){stats.errors.push({frame:0,message:String(e)});}
    // The image element already starts loading from HTML; no metadata or video
    // download has to finish before scrolling can select a frame.
    posterPending=false;pump();
  }
  const visibility=new IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;
    if(!active()){
      cancelObsolete();if(drawRAF)cancelAnimationFrame(drawRAF);drawRAF=0;
      for(const i of [...bitmaps.keys()])release(i);
      // Retain only the last painted canvas (about 8 MB), not the decoded cache.
      // Re-entering must not flash the first-frame poster over the final eye frame.
    }else{resize();scheduleDraw();void decodeNext();pump();}
  },{threshold:0,rootMargin:'200px 0px'});visibility.observe(section);
  function resume(){cancelObsolete();if(active()){resize();scheduleDraw();void decodeNext();pump();}}
  function online(){failed.clear();resume();}
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('online',online);
  window.addEventListener('resize',resize,{passive:true});resize();
  if(!reduced){trigger=ScrollTrigger.create({id:'hero-canvas-scroll',trigger:section,start:'top top',end:()=>`+=${Math.max(1,section.offsetHeight-innerHeight)}`,invalidateOnRefresh:true,onUpdate:self=>setProgress(self.progress),onRefresh:self=>setProgress(self.progress)});setProgress(trigger.progress);}
  void firstFrame();
  const render=y=>{
    const p=reduced?0:clamp(y/Math.max(1,section.offsetHeight-innerHeight));
    if(p!==copyProgress){copy.style.opacity=1-smooth(clamp(p/.09));shade.style.opacity=1-smooth(clamp(p/.12));copyProgress=p;}
  };
  render.destroy=()=>{destroyed=true;cancelObsolete();visibility.disconnect();trigger?.kill();document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',online);window.removeEventListener('resize',resize);if(drawRAF)cancelAnimationFrame(drawRAF);for(const i of [...bitmaps.keys()])release(i);blobs.clear();};
  return render;
}

export {clamp,smooth};
