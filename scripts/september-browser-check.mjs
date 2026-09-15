import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const url = process.argv[2] || 'http://127.0.0.1:8080';
const label = process.argv[3] || 'dev';
mkdirSync('screenshots', {recursive:true});
const browser = await chromium.launch({channel:'msedge',args:['--no-proxy-server']});
const page = await browser.newPage({viewport:{width:1280,height:800}});
page.setDefaultTimeout(180000);
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
try {
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__controlsTest);
 await page.getByRole('tab',{name:'Info',exact:true}).click();
 assert.equal(await page.locator('#vehicle-info-picker option').count(),33);
 for(const id of ['m7-priest','su-76','wespe']) {
  await page.locator('#vehicle-info-picker').selectOption(id);
  assert.ok((await page.locator('.vehicle-sheet-subtitle').innerText()).includes('SPG'));
 }
 await page.screenshot({path:`screenshots/september-${label}-desktop.png`});
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:`screenshots/september-${label}-mobile.png`});
 await page.goto(`${url}/editor`,{waitUntil:'domcontentloaded'});
 await page.locator('canvas[data-ready="true"]').waitFor();
 await page.getByRole('button',{name:'JSON',exact:true}).click();
 await page.getByLabel('Level JSON',{exact:true}).fill(readFileSync('public/levels/logging-village.json','utf8'));
 await page.getByRole('button',{name:'Import pasted JSON',exact:true}).click();
 await page.getByTestId('test-drive').click();
 await page.waitForFunction(()=>!!window.__controlsTest);
 await page.locator('#deploy-btn').click();
 await page.waitForFunction(()=>window.__controlsTest?.getPosition().y===-86);
 assert.deepEqual(errors,[]);
 const result={ok:true,url,checks:['33 vehicle sheets','three SPG sheets','desktop/mobile without overflow','Logging Village import and deployment'],errors};
 writeFileSync(`screenshots/september-${label}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
