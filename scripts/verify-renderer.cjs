const { chromium } = require('/Users/corizza/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { webkit }=require('../work/qa/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const results=[];for(const [name,engine] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.QA_BROWSER||process.env.QA_BROWSER===name)){
 const browser=await engine.launch({headless:true,executablePath:name==='chromium'?'/Users/corizza/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell':'/Users/corizza/Library/Caches/ms-playwright/webkit_mac14_arm64_special-2251/pw_run.sh'});let page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});page.setDefaultTimeout(20000);console.log(name,'launched');const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('.stage').dataset.display==='1');
 await page.screenshot({path:`work/${name}-hero.png`});
 const scroll=async(p)=>{await page.evaluate(p=>{document.documentElement.style.scrollBehavior='auto';scrollTo(0,(document.querySelector('.first-contact').offsetHeight-innerHeight)*p);},p);};
 const state=()=>page.locator('.stage').evaluate(e=>({...e.dataset}));
 await scroll(.35);await page.waitForFunction(()=>{const d=document.querySelector('.stage').dataset;return +d.frame>80&&d.frame===d.display;});const middle=await state();assert(+middle.frame>80);
 await scroll(.725);await page.waitForFunction(()=>{const d=document.querySelector('.stage').dataset;return d.frame==='180'&&d.finalReady==='true';});await page.screenshot({path:`work/${name}-final.png`});
 await scroll(.87);await page.waitForFunction(()=>+document.querySelector('.stage').dataset.zoom>7);await page.screenshot({path:`work/${name}-eye.png`});
 await scroll(.998);await page.waitForFunction(()=>+document.querySelector('.stage').dataset.fade>.999);console.log(name,'end checked');const end=await state();assert(+end.zoom>13.9);assert(+end.cache<=20);
 await scroll(.35);await page.waitForFunction(()=>{const d=document.querySelector('.stage').dataset;return +d.frame<100&&d.frame===d.display&&+d.fade===0;});
 await scroll(0);await page.waitForFunction(()=>{const d=document.querySelector('.stage').dataset;return d.frame==='1'&&d.display==='1'&&+d.zoom===1&&+d.fade===0;});
 await page.evaluate(()=>{const e=document.querySelector('.manifest');scrollTo(0,e.offsetTop+innerHeight*.55);});await page.waitForTimeout(400);await page.screenshot({path:`work/${name}-manifest.png`});
 await page.evaluate(()=>{const e=document.querySelector('.digital-form');scrollTo(0,e.offsetTop+(e.offsetHeight-innerHeight)*.8);});await page.waitForFunction(()=>+document.querySelector('.digital-form').dataset.reveal===1);await page.waitForFunction(()=>{const i=document.querySelector('.form-image img');return i.complete&&i.naturalWidth>0;});await page.screenshot({path:`work/${name}-form.png`});
 await page.evaluate(()=>{const e=document.querySelector('.digital-form');scrollTo(0,e.offsetTop);});await page.waitForFunction(()=>+document.querySelector('.digital-form').dataset.reveal<.001);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#projects').scrollIntoViewIfNeeded();await page.locator('.project-row summary').first().click();assert(await page.locator('.project-row').first().getAttribute('open')!==null);await page.waitForTimeout(900);await page.screenshot({path:`work/${name}-projects.png`});
 console.log(name,'scenes done');await page.locator('#discuss').click();assert(await page.locator('dialog').evaluate(e=>e.open));await page.locator('#copy-idea').click();assert(await page.locator('#copy-status').textContent());await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);results.push({browser:name,middle,end,errors});
 console.log(name,'interactions done');await page.close();page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});assert(await page.locator('.first-contact').evaluate(e=>e.offsetHeight===innerHeight));await page.evaluate(()=>document.querySelector('.digital-form').scrollIntoView());assert(await page.locator('.form-copy').evaluate(e=>getComputedStyle(e).opacity==='1'));
 console.log(name,'reduced done');await browser.close();}
 fs.writeFileSync(`work/qa-results-${process.env.QA_BROWSER||'all'}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exit(1)});
