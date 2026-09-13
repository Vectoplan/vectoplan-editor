// Run with the OpenLayer tests/browser_preview.py fixture on port 5191.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.MAP_3D_TEST_OUTPUT || path.join(root, '.tmp-tests/map-3d-browser');
fs.mkdirSync(output, {recursive:true});
const esbuild = require(path.join(root, 'node_modules/esbuild'));
(async () => {
  const { outputFiles } = await esbuild.build({ entryPoints: [path.join(root, 'tests/browser/terrain_map_bridge_audit.ts')],
    bundle: true, format: 'iife', platform: 'browser', write: false, tsconfig: path.join(root, 'tsconfig.json') });
  const boundary = await esbuild.build({ entryPoints: [path.join(root, 'tests/browser/parcel_boundary_render_audit.ts')],
    bundle: true, format: 'iife', platform: 'browser', write: false, tsconfig: path.join(root, 'tsconfig.json') });
  const server = http.createServer((req, res) => {
    if (req.url === '/boundary.js') {res.setHeader('Content-Type','text/javascript');res.end(boundary.outputFiles[0].contents);return;}
    if (req.url === '/boundary') {res.end('<body><script src="/boundary.js"></script></body>');return;}
    res.setHeader('Content-Type', req.url === '/audit.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/audit.js' ? outputFiles[0].contents : '<body><script src="/audit.js"></script></body>'); });
  await new Promise(resolve => server.listen(5192, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const gpu = await browser.newPage();
    await gpu.goto('http://127.0.0.1:5192/boundary'); await gpu.waitForFunction(()=>window.boundaryAudit);
    const pixels = await gpu.evaluate(()=>window.boundaryAudit);
    assert.equal(pixels.before,0);assert.ok(pixels.production>500);assert.equal(pixels.production,pixels.after);
    console.log('BOUNDARIES',JSON.stringify(pixels)); await gpu.close();
    const context = await browser.newContext();
    const page = await context.newPage(); page.on('pageerror', error => console.error('PAGE', String(error)));
    page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()); });
    await page.goto('http://127.0.0.1:5192', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelector('.terrain-map-attribution')?.dataset.state === 'ready', null, {timeout:90000});
    const light = await page.evaluate(() => window.terrainAudit.tile());
    console.log('LIGHT', JSON.stringify({...light,dataUrl:undefined})); assert.equal(light.provider, 'openfreemap'); assert.ok(light.colors > 100); assert.ok(light.mean > 150);
    await page.screenshot({path:path.join(output,'map-3d-light.png')});
    const designPage = await context.newPage();
    await designPage.goto('http://127.0.0.1:5191/', {waitUntil:'domcontentloaded'});
    await designPage.waitForFunction(()=>window.vectoMap, null, {timeout:60000});
    await designPage.locator('[data-map-design="dark"]').evaluate(button=>button.click());
    await page.waitForFunction(() => {const el=document.querySelector('.terrain-map-attribution');return el?.dataset.designId==='dark'&&el.dataset.state==='ready'},null,{timeout:90000});
    const dark = await page.evaluate(() => window.terrainAudit.tile());
    console.log('DARK',JSON.stringify({...dark,dataUrl:undefined})); assert.equal(dark.provider,'openfreemap'); assert.ok(dark.mean < light.mean-80);
    await page.screenshot({path:path.join(output,'map-3d-dark.png')});
    const count = await page.locator('.terrain-map-attribution a').count(); assert.equal(count,3);
    await designPage.locator('[data-map-design="light"]').evaluate(button=>button.click());
    await page.waitForFunction(() => {const el=document.querySelector('.terrain-map-attribution');return el?.dataset.designId==='light'&&el.dataset.state==='ready'},null,{timeout:90000});
    console.log('RESTORED',await page.locator('.terrain-map-attribution').evaluate(el=>({...el.dataset})));
    await page.evaluate(() => window.terrainAudit.destroy()); assert.equal(await page.locator('iframe').count(),0);
    await context.close();
    const png = Buffer.from(light.dataUrl.split(',')[1], 'base64');
    for (const scenario of ['mapbox', 'mapbox-failed', 'both-failed']) {
      const testContext = await browser.newContext();
      let mapboxRequests = 0, openfreemapRequests = 0, osmRequests = 0;
      await testContext.route('**/map/terrain', async route => {
        const response = await route.fetch();
        const body = (await response.text()).replace(/window.TERRAIN_BASEMAP_CONFIG = (.*);/, (_, json) =>
          'window.TERRAIN_BASEMAP_CONFIG = '+JSON.stringify({...JSON.parse(json),token:'pk.browser-fallback-test-public',tokenUsable:true,styleTokenMismatch:false})+';');
        await route.fulfill({response,body});
      });
      await testContext.route('https://api.mapbox.com/**', async route => {
        mapboxRequests++;
        if(scenario==='mapbox') await route.fulfill({status:200,contentType:'image/png',body:png});
        else await route.abort();
      });
      await testContext.route('https://tiles.openfreemap.org/**', async route => {
        openfreemapRequests++;
        if(scenario==='both-failed') await route.abort(); else await route.continue();
      });
      await testContext.route('https://tile.openstreetmap.org/**', async route => {osmRequests++;await route.fulfill({status:200,contentType:'image/png',body:png});});
      const testPage = await testContext.newPage();
      let dialogs=0; testPage.on('dialog',async dialog=>{dialogs++;await dialog.dismiss()});
      await testPage.goto('http://127.0.0.1:5192', {waitUntil:'domcontentloaded'});
      await testPage.waitForFunction(()=>document.querySelector('.terrain-map-attribution')?.dataset.state==='ready',null,{timeout:90000});
      const result=await testPage.evaluate(()=>({states:window.terrainAudit.states,status:{...document.querySelector('.terrain-map-attribution').dataset}}));
      assert.equal(result.status.provider,scenario==='mapbox'?'mapbox':scenario==='mapbox-failed'?'openfreemap':'osm');
      assert.equal(result.status.activeProviders,result.status.provider);
      assert.equal(dialogs,0); assert.ok(mapboxRequests>0);
      if(scenario==='mapbox'){assert.equal(openfreemapRequests,0);assert.equal(osmRequests,0)}
      if(scenario==='mapbox-failed')assert.equal(osmRequests,0);
      console.log(scenario,JSON.stringify({...result,mapboxRequests,openfreemapRequests,osmRequests}));
      await testPage.evaluate(()=>window.terrainAudit.destroy()); await testContext.close();
    }
  } finally { await browser.close(); server.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
