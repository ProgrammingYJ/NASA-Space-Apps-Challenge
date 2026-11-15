import {test,expect,type Page,type Locator} from '@playwright/test';
import {distanceViewCopy} from '../src/DistanceViewCopy';

const languages=['ko','en','ja','zh-Hant','fr'] as const;
const common='solar-overview-common-v2',local='parent-linear-distance-v1';
const scene=(page:Page)=>page.getByTestId('universe-scene');
const label=(page:Page,id:string)=>page.getByTestId('object-label-'+id);
const norm=(a:number[],b:number[])=>Math.hypot(...a.map((value,i)=>value-b[i]));
async function vec(element:Locator,attribute:string){
  const text=await element.getAttribute(attribute);expect(text,attribute).toBeTruthy();
  const values=text!.split(',').map(Number);expect(values).toHaveLength(3);expect(values.every(Number.isFinite)).toBe(true);return values;
}
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}
async function init(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm',common);
  await page.getByTestId('settings-toggle').click();await page.getByTestId('outer-tno-toggle').uncheck();
  await expect(page.getByTestId('settings-appearance-lighting')).toHaveValue('solar');await page.getByTestId('settings-toggle').click();
}
async function assertLinearEarthDistances(page:Page){
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm',local);
  await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','earth');
  await expect(scene(page)).toHaveAttribute('data-distance-scale-per-au','10000');
  await expect(label(page,'moon-301')).toHaveAttribute('data-source-position-au',/.+/);
  const source=await Promise.all(['earth','moon-301','venus'].map(id=>vec(label(page,id),'data-source-position-au')));
  const world=await Promise.all(['earth','moon-301','venus'].map(id=>vec(label(page,id),'data-world-position')));
  const sourceMoon=norm(source[0],source[1]),sourceVenus=norm(source[0],source[2]);
  const worldMoon=norm(world[0],world[1]),worldVenus=norm(world[0],world[2]);
  expect(sourceMoon).toBeGreaterThan(0);expect(sourceVenus).toBeGreaterThan(0);
  expect(world[0].every(value=>Math.abs(value)<1e-7)).toBe(true);
  expect(worldMoon/sourceMoon).toBeCloseTo(10000,3);expect(worldVenus/sourceVenus).toBeCloseTo(10000,3);
  expect((worldVenus/worldMoon)/(sourceVenus/sourceMoon)).toBeCloseTo(1,7);
  for(const index of [1,2]){
    const delta=source[index].map((value,i)=>value-source[0][i]);
    const expected=[delta[0]*10000,delta[2]*10000,-delta[1]*10000];
    expected.forEach((value,i)=>expect(Math.abs(world[index][i]-value)).toBeLessThan(2e-7));
  }
  const info=page.getByTestId('distance-view-info');await expect(info).toBeVisible();
  const moonValue=Number(await page.getByTestId('earth-moon-distance-au').getAttribute('data-value-au'));
  const venusValue=Number(await page.getByTestId('earth-venus-distance-au').getAttribute('data-value-au'));
  const ratio=Number(await page.getByTestId('distance-ratio').getAttribute('data-value'));
  expect(moonValue).toBeGreaterThan(0);expect(venusValue).toBeGreaterThan(0);
  expect(Math.abs(moonValue-sourceMoon)).toBeLessThan(2e-11);expect(Math.abs(venusValue-sourceVenus)).toBeLessThan(2e-11);
  expect(ratio/(sourceVenus/sourceMoon)).toBeCloseTo(1,7);
  return {epoch:await scene(page).getAttribute('data-model-epoch'),source,world,sourceMoon,sourceVenus,worldMoon,worldVenus,ratio};
}

test('DEV-024: one local scale preserves real source distance ratios without resizing Earth, Moon or Venus',async({page},testInfo)=>{
  test.setTimeout(150000);await init(page);
  await expect(label(page,'moon-301')).toHaveAttribute('data-mesh-world-radius',/.+/,{timeout:60000});
  const initial=new Map<string,{physical:number;mesh:number}>();
  for(const id of ['earth','moon-301','venus']){
    const physical=Number(await label(page,id).getAttribute('data-physical-reference-radius-km')),mesh=Number(await label(page,id).getAttribute('data-mesh-world-radius'));
    expect(physical).toBeGreaterThan(0);expect(mesh).toBeGreaterThan(0);initial.set(id,{physical,mesh});
  }
  await choose(page,'earth');await expect(page.getByTestId('earth-moon-distance-au')).toHaveAttribute('data-value-au',/[0-9]/);
  const captures=[await assertLinearEarthDistances(page)];
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);const copy=distanceViewCopy(language),info=page.getByTestId('distance-view-info');
    await expect(info).toContainText(copy.title);await expect(info).toContainText(copy.localNotice);await expect(info).toContainText(copy.approximationNotice);
    await expect(info).toContainText(copy.earthMoon);await expect(info).toContainText(copy.earthVenus);await expect(info).not.toContainText(/undefined|NaN/);
  }
  await page.getByTestId('language').selectOption('en');
  await expect(label(page,'earth')).toHaveAttribute('data-appearance-lighting','solar');
  // Existing DEV-023 lighting QA independently tests the night side. This image
  // records that the linear coordinate view retains the same solar-mode render.
  await page.screenshot({path:testInfo.outputPath('earth-local-linear-solar.png')});
  for(const year of [1371,2035,3000]){
    const date=`${year}-01-01T00:00:00`,input=page.locator('#model-epoch');
    await input.fill(date);await input.press('Enter');
    await expect(input).toHaveAttribute('aria-invalid','false');
    await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source','simulation');
    await expect(scene(page)).toHaveAttribute('data-model-epoch',new Date(date+'Z').toISOString());
    captures.push(await assertLinearEarthDistances(page));
    await expect(label(page,'moon-301')).toHaveAttribute('data-position-kind','osculating_kepler_extrapolation');
    for(const id of ['earth','moon-301','venus']){
      expect(Number(await label(page,id).getAttribute('data-physical-reference-radius-km'))).toBe(initial.get(id)!.physical);
      expect(Number(await label(page,id).getAttribute('data-mesh-world-radius'))).toBeCloseTo(initial.get(id)!.mesh,7);
      await expect(label(page,id)).toHaveAttribute('data-body-group-scale','1,1,1');
    }
  }
  await choose(page,'moon-301');await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','earth');
  captures.push(await assertLinearEarthDistances(page));
  await expect(label(page,'moon-301')).toHaveAttribute('data-appearance-lighting','solar');
  await expect(label(page,'moon-301')).toHaveAttribute('data-surface-mesh-scale','1,1,1');
  await page.getByTestId('return-distance-overview').click();
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm',common);await expect(scene(page)).toHaveAttribute('data-camera-mode','overview');
  await expect(scene(page)).toHaveAttribute('data-selected-object','');
  for(const id of ['earth','moon-301','venus']){
    expect(Number(await label(page,id).getAttribute('data-physical-reference-radius-km'))).toBe(initial.get(id)!.physical);
    expect(Number(await label(page,id).getAttribute('data-mesh-world-radius'))).toBeCloseTo(initial.get(id)!.mesh,7);
  }
  await choose(page,'earth');captures.push(await assertLinearEarthDistances(page));
  expect(new Set(captures.map(value=>value.sourceMoon.toPrecision(12))).size).toBeGreaterThan(1);
  await testInfo.attach('dev024-source-and-world-distances.json',{body:JSON.stringify({scale_display_per_au:10000,distances_are:'3D source norms, not projected pixel lengths',initial:Object.fromEntries(initial),captures}),contentType:'application/json'});
});

test('DEV-024: a Pluto selection before universe coordinates arrive keeps local intent through real evidence export and fresh-session restoration',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});
  // Delay only delivery of the real universe response. Identity-based selection
  // must not depend on whether this coordinate request has finished yet.
  const original=await page.request.get('/api/v1/universe',{timeout:15000});expect(original.ok()).toBe(true);const body=await original.body();
  let release!:()=>void,received=false,delivered=false,routeError:unknown;const gate=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/v1/universe',async route=>{received=true;try{await gate;await route.fulfill({status:original.status(),contentType:original.headers()['content-type']??'application/json',body});}catch(error){routeError=error;}finally{delivered=true;}});
  try{
    await page.goto('/',{waitUntil:'domcontentloaded'});await expect.poll(()=>received).toBe(true);await page.getByTestId('language').selectOption('en');
    await expect(scene(page)).toHaveAttribute('data-distance-algorithm',common);
    await page.locator('#universe-search').fill('pluto');await page.getByTestId('search-pluto').click();
    await expect(scene(page)).toHaveAttribute('data-selected-object','pluto');await expect(scene(page)).toHaveAttribute('data-distance-algorithm',local);await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','pluto');
    expect(delivered).toBe(false);await expect(label(page,'pluto')).toHaveCount(0);
    release();await expect.poll(()=>delivered).toBe(true);if(routeError)throw routeError;
    await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');await expect(label(page,'pluto')).toHaveAttribute('data-source-position-au',/.+/);
  }finally{release();try{await page.unroute('**/api/v1/universe');}finally{await original.dispose();}}
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm',local);
  await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','pluto');
  await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();
  const result=await page.getByTestId('result-id').innerText();
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='DEV-024 QA: source-linked observation evidence; local linear display is navigation, not a new measurement.';
  await panel.locator('#assessment').fill(judgment);await panel.getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  const downloadPromise=page.waitForEvent('download');await panel.getByRole('button',{name:'Export JSON',exact:true}).click();
  const download=await downloadPromise,stream=await download.createReadStream();expect(stream).toBeTruthy();
  const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const bytes=Buffer.concat(chunks),evidence=JSON.parse(bytes.toString());
  expect(evidence.session.universe_context.distance_view).toEqual({algorithm_version:local,origin_object_id:'pluto'});
  expect(evidence.judgment).toBe(judgment);
  const fresh=await browser.newContext({baseURL:baseURL??new URL(page.url()).origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage();await restored.goto('/');
    await restored.getByTestId('global-import-file').setInputFiles({name:'dev024-local-distance-evidence.json',mimeType:'application/json',buffer:bytes});
    await expect(restored.getByTestId('result-id')).toHaveText(result);
    await expect(scene(restored)).toHaveAttribute('data-distance-algorithm',local);
    await expect(scene(restored)).toHaveAttribute('data-distance-origin-object-id','pluto');
    await expect(scene(restored)).toHaveAttribute('data-distance-scale-per-au','10000');
    await expect(scene(restored)).toHaveAttribute('data-selected-object','pluto');
    await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();await expect(restored.locator('#assessment')).toHaveValue(judgment);
    await testInfo.attach('dev024-distance-context-restore.json',{body:JSON.stringify({result_id:result,distance_view:evidence.session.universe_context.distance_view,selected_before_universe_response:true,judgment_preserved:true}),contentType:'application/json'});
  }finally{await fresh.close();}
  // Legacy missing-mode restoration is covered separately; stripping the mode
  // from a new linear-view camera would not create a genuine legacy camera.
});
