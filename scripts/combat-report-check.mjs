import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const url=process.argv[2] || 'http://127.0.0.1:8080';
const browser=await chromium.launch({channel:'msedge',args:['--no-proxy-server']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(180000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('screenshots',{recursive:true});
try {
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__controlsTest);
 await page.locator('#deploy-btn').click();
 await page.waitForFunction(()=>!!window.__controlsTest.getWorld());
 // Controlled battle fixture: a visible front-plate target with one HP.
 await page.evaluate(()=>{
  const w=window.__controlsTest.getWorld();
  w.cover=[]; w.player.x=0;w.player.y=0;w.player.yawDeg=0;
  w.player.turrets.forEach(t=>t.facingDeg=0);
  w.dummy.x=0;w.dummy.y=8;w.dummy.yawDeg=180;w.dummy.hp=1;w.dummy.tracked=true;
  w.dummyReload=999;w.dummy.turrets.forEach(t=>t.state='destroyed');

  window.__controlsTest.setKeys(['Space']);
 });
 await page.waitForFunction(()=>window.__controlsTest.getWorld().battle.player?.shots>0);
 await page.evaluate(()=>window.__controlsTest.setKeys([]));
 // Completion fixtures exercise both end screens independent of armor RNG.
 await page.evaluate(()=>{const w=window.__controlsTest.getWorld(); w.complete=true; w.outcome='win';});
 await page.getByRole('region',{name:'After-action report'}).waitFor();
 assert.match(await page.getByRole('region',{name:'After-action report'}).innerText(),/Main-gun shots/);
 await page.screenshot({path:'screenshots/combat-report-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'screenshots/combat-report-mobile.png'});
 await page.getByRole('button',{name:'Run again',exact:true}).click();
 await page.waitForFunction(()=>window.__controlsTest.getWorld()?.complete===false);
 assert.equal(await page.evaluate(()=>window.__controlsTest.getWorld().battle.player?.shots ?? 0),0);
 await page.evaluate(()=>{const w=window.__controlsTest.getWorld();w.complete=true;w.outcome='loss';});
 await page.getByText('HULL LOST',{exact:true}).waitFor();
 await page.getByRole('region',{name:'After-action report'}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,url,checks:['shot capture','win/loss report fixtures','fresh-match reset','desktop/mobile layout'],errors}));
} finally {await browser.close();}

