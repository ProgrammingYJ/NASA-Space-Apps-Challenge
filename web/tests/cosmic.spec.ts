import {test,expect,type Page,type Route} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import type {CosmicObservationCatalog} from '../src/cosmicObservations';

const viewer=(page:Page)=>page.getByTestId('cosmic-observation-viewer');
const photo=(page:Page)=>page.getByTestId('cosmic-observation-image');
const play=(page:Page)=>page.getByTestId('cosmic-observation-play-toggle');
const preciseScene=(page:Page)=>page.getByTestId('universe-scene');
const ids=['cosmic_gems_clusters','firefly_sparkle_assembly','ceers_projected_shapes','rebels25_rotating_disc','zs7_ongoing_merger'];
const sourceAges:Record<string,number|null>={cosmic_gems_clusters:.46,firefly_sparkle_assembly:.6,ceers_projected_shapes:null,rebels25_rotating_disc:.7,zs7_ongoing_merger:.74};
async function catalog(page:Page):Promise<CosmicObservationCatalog>{const response=await page.request.get('/api/v1/cosmic-observations');expect(response.ok()).toBeTruthy();return response.json();}
async function readyPhoto(page:Page,id:string){
  await expect(viewer(page)).toHaveAttribute('data-selected-case',id);await expect(photo(page)).toHaveAttribute('data-case-id',id);await expect(photo(page)).toBeVisible();
  await expect.poll(()=>photo(page).evaluate((node:HTMLImageElement)=>node.complete&&node.naturalWidth>0)).toBe(true);
}
async function choose(page:Page,id:string){await page.getByTestId(`cosmic-observation-case-${id}`).click();await readyPhoto(page,id);}
async function enter(page:Page){await page.getByTestId('time-mode').selectOption('cosmic-history');await expect(viewer(page)).toBeVisible();await readyPhoto(page,ids[0]);}
async function begin(page:Page){await page.goto('/');await page.getByTestId('language').selectOption('en');await enter(page);}
async function exit(page:Page){await page.getByTestId('cosmic-observation-exit').click();await expect(viewer(page)).not.toBeVisible();await expect(photo(page)).not.toBeVisible();}
async function assertAge(page:Page,id:string){
  if(id==='ceers_projected_shapes'){
    await expect(page.getByTestId('cosmic-observation-age')).toHaveCount(0);await expect(page.getByTestId('cosmic-observation-age-range')).toHaveAttribute('data-age-min','0.6');await expect(page.getByTestId('cosmic-observation-age-range')).toHaveAttribute('data-age-max','6');
  }else{
    await expect(page.getByTestId('cosmic-observation-age-range')).toHaveCount(0);await expect(page.getByTestId('cosmic-observation-age')).toHaveAttribute('data-age-gyr',String(sourceAges[id]));
  }
}

test('only five unchanged observation products and published ages or ranges appear, with sources in five languages',async({page})=>{
  test.setTimeout(120000);const data=await catalog(page);const manifest=await fs.readFile('../data/manifests/cosmic_observations.json');
  expect(data.source_manifest_sha256).toBe(createHash('sha256').update(manifest).digest('hex'));expect(data.algorithm_version).toBe('cosmic-observation-viewer-v1');expect(data.age_interpolation_available).toBe(false);expect(data.objects.map(item=>item.id)).toEqual(ids);
  let bytesTotal=0;
  for(const item of data.objects){
    expect(item.approx_age_gyr).toBe(sourceAges[item.id]);if(item.id==='ceers_projected_shapes')expect(item.sample_age_range_gyr).toEqual([.6,6]);else expect(item.sample_age_range_gyr).toBeNull();
    expect(item.image.kind).toBe('published_observation_composite');expect(item.image.artist_concept).toBe(false);expect(item.image.bytes_modified_locally).toBe(false);
    expect(item.image.url).toMatch(/^\/observations\/cosmic\/[a-z0-9-]+\.(?:jpg|png)$/);expect(item.image.processing.length).toBeGreaterThan(0);expect(item.image.credit).toBeTruthy();
    const response=await page.request.get(item.image.url);expect(response.status(),item.id).toBe(200);const bytes=await response.body();expect(bytes.length,item.id).toBe(item.image.bytes);expect(createHash('sha256').update(bytes).digest('hex'),item.id).toBe(item.image.sha256);bytesTotal+=bytes.length;await response.dispose();
    expect(item.image.license.spdx_id).toBe(['firefly_sparkle_assembly','ceers_projected_shapes'].includes(item.id)?null:'CC-BY-4.0');
  }
  expect(bytesTotal).toBe(2034618);await begin(page);
  await expect(viewer(page).locator('canvas')).toHaveCount(0);await expect(page.getByTestId('history-canvas')).toHaveCount(0);await expect(page.getByTestId('cosmic-age-input')).toHaveCount(0);await expect(page.getByTestId('cosmic-time-range')).toHaveCount(0);await expect(page.getByTestId('cosmic-milestone-hot_big_bang')).toHaveCount(0);await expect(page.locator('[data-model-render-version="cosmic-diversity-v1"]')).toHaveCount(0);
  await expect(page.getByTestId('cosmic-observation-index-range')).toHaveAttribute('step','1');
  for(const item of data.objects){
    await choose(page,item.id);await assertAge(page,item.id);await expect(page.getByTestId('cosmic-observation-name')).toHaveText(item.name);await expect(photo(page)).toHaveAttribute('src',item.image.url);await expect(photo(page)).toHaveAttribute('data-image-sha256',item.image.sha256);await expect(photo(page)).toHaveCSS('object-fit','contain');
    expect(await photo(page).evaluate((node:HTMLImageElement)=>[node.naturalWidth,node.naturalHeight])).toEqual(item.image.pixel_dimensions);
    await expect(page.getByTestId('cosmic-observation-credit')).toContainText(item.image.credit);await expect(page.getByTestId('cosmic-observation-license')).toContainText(item.image.license.label);await expect(page.getByTestId('cosmic-observation-source')).toHaveAttribute('href',item.source.url);
    await page.screenshot({path:`../var/qa/dev007-observed-${item.id}.png`});
  }
  await choose(page,'ceers_projected_shapes');
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const words=JSON.parse(await fs.readFile(`src/locales/${locale}.json`,'utf8'));await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
    for(const key of ['cosmicObsTitle','cosmicObsIntro','cosmicObsAgeNote','cosmicObsSlideNote','cosmicObsPublished','cosmicObsAgeRange','cosmicObsCredit','cosmicObsLicense'])await expect(viewer(page)).toContainText(words[key]);
    await expect(page.getByTestId('cosmic-observation-note')).toContainText(words.cosmicObs_note_ceers_projected_shapes);await assertAge(page,'ceers_projected_shapes');
    expect(await viewer(page).innerText()).not.toMatch(/\b(?:NaN|undefined)\b|cosmicObs[A-Z_]/);
  }
  await page.getByTestId('language').selectOption('en');await choose(page,'rebels25_rotating_disc');await page.getByTestId('cosmic-observation-details').locator('summary').click();await expect(page.getByTestId('cosmic-observation-details')).toContainText('velocity map');await expect(page.getByTestId('cosmic-observation-details')).toContainText('not a visible-light photograph');
});

test('case selection rejects stale image loads and a slideshow pauses at its end and when hidden',async({page})=>{
  test.setTimeout(90000);const data=await catalog(page);await begin(page);const delayed=data.objects[1];let arrived!:()=>void,release!:()=>void,done!:()=>void;
  const reached=new Promise<void>(resolve=>arrived=resolve),gate=new Promise<void>(resolve=>release=resolve),finished=new Promise<void>(resolve=>done=resolve);
  const pattern=`**${delayed.image.url}`;const handler=async(route:Route)=>{arrived();await gate;try{await route.continue();}catch{/* The browser may cancel the deliberately superseded image. */}finally{done();}};
  await page.route(pattern,handler);
  try{
    await page.getByTestId(`cosmic-observation-case-${delayed.id}`).click();await reached;await expect(viewer(page)).toHaveAttribute('data-selected-case',delayed.id);await expect(photo(page)).toBeHidden();
    await choose(page,'ceers_projected_shapes');release();await finished;await page.waitForTimeout(100);await readyPhoto(page,'ceers_projected_shapes');await assertAge(page,'ceers_projected_shapes');
  }finally{release();await page.unroute(pattern,handler);}
  await page.getByTestId('cosmic-observation-case-ceers_projected_shapes').focus();await page.keyboard.press('ArrowRight');await readyPhoto(page,'rebels25_rotating_disc');await expect(page.getByTestId('cosmic-observation-case-rebels25_rotating_disc')).toBeFocused();
  await page.getByTestId('cosmic-observation-interval').selectOption('3');await play(page).click();await readyPhoto(page,'zs7_ongoing_merger');await expect(play(page)).toHaveAttribute('aria-pressed','false');
  await play(page).click();await readyPhoto(page,ids[0]);await expect(play(page)).toHaveAttribute('aria-pressed','true');
  // Headless Chrome keeps tabs visible; explicitly exercise the real listener.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(play(page)).toHaveAttribute('aria-pressed','false');const stopped=await viewer(page).getAttribute('data-selected-case');await page.waitForTimeout(3250);
  await page.evaluate(()=>{delete (document as unknown as Record<string,unknown>).hidden;delete (document as unknown as Record<string,unknown>).visibilityState;document.dispatchEvent(new Event('visibilitychange'));});expect(await viewer(page).getAttribute('data-selected-case')).toBe(stopped);
  await play(page).click();await choose(page,'ceers_projected_shapes');await expect(play(page)).toHaveAttribute('aria-pressed','false');await page.waitForTimeout(3250);await readyPhoto(page,'ceers_projected_shapes');
});

test('observed-case browsing preserves the solar camera and actual epsilon evidence through a fresh restore',async({page,browser})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.locator('#universe-search').fill('epsilon-indi-b');await page.getByTestId('search-epsilon-indi-b').click();await expect(preciseScene(page)).toHaveAttribute('data-camera-mode','focused');await page.getByTestId('open-object-observations').click();let panel=page.getByTestId('observation-panel');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();const result=await page.getByTestId('result-id').innerText();const original=await (await page.request.get(`/api/v1/comparisons/${result}/manifest`)).json();const quality=await panel.getByRole('table').innerText();
  const position=await preciseScene(page).getAttribute('data-camera-position'),target=await preciseScene(page).getAttribute('data-camera-target'),epoch=await preciseScene(page).getAttribute('data-model-epoch');
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();const judgment='These published cosmic observations are separate from the original SPHEREx exposures and do not validate source association.';await panel.locator('#assessment').fill(judgment);
  await enter(page);await choose(page,'rebels25_rotating_disc');await choose(page,'zs7_ongoing_merger');await exit(page);await expect(page.getByTestId('result-id')).toHaveText(result);expect(await preciseScene(page).getAttribute('data-camera-position')).toBe(position);expect(await preciseScene(page).getAttribute('data-camera-target')).toBe(target);expect(await preciseScene(page).getAttribute('data-model-epoch')).toBe(epoch);
  panel=page.getByTestId('observation-panel');await panel.getByRole('button',{name:'Quality',exact:true}).click();expect(await panel.getByRole('table').innerText()).toBe(quality);await expect(page.getByTestId('frame-A')).toContainText('2025-04-30T02:06:28.716');await expect(page.getByTestId('frame-B')).toContainText('2026-09-23T17:21:46.185');
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();await expect(panel.locator('#assessment')).toHaveValue(judgment);await panel.getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Export JSON',exact:true}).click();const bytes=await fs.readFile((await (await download).path())!);const evidence=JSON.parse(bytes.toString());expect(evidence.comparison).toEqual(original);expect(evidence.judgment).toBe(judgment);expect(evidence.session.universe_context.model_epoch).toBe(epoch);expect(evidence.session.universe_context.playback_paused).toBe(true);
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});
  try{const restored=await fresh.newPage();await restored.goto('/');await restored.getByTestId('global-import-file').setInputFiles({name:'observed-cases-epsilon-evidence.json',mimeType:'application/json',buffer:bytes});await expect(restored.getByTestId('result-id')).toHaveText(result);await expect(restored.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');await expect(viewer(restored)).not.toBeVisible();await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();await expect(restored.locator('#assessment')).toHaveValue(judgment);await restored.screenshot({path:'../var/qa/dev007-observed-epsilon-restored.png',fullPage:true});}finally{await fresh.close();}
  expect(errors).toEqual([]);
});

test('pending global imports pause image presentation and a new session removes stale cases and search results',async({page})=>{
  await begin(page);await page.getByTestId('cosmic-observation-interval').selectOption('3');await play(page).click();await expect(play(page)).toHaveAttribute('aria-pressed','true');
  let arrived!:()=>void,release!:()=>void;const reached=new Promise<void>(resolve=>arrived=resolve),gate=new Promise<void>(resolve=>release=resolve);
  const handler=async(route:Route)=>{arrived();await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'recalculation_required',reasons:['delayed_test_placeholder']})});};await page.route('**/api/v1/evidence/import',handler);
  try{await page.getByTestId('global-import-file').setInputFiles({name:'pending-observed-case.json',mimeType:'application/json',buffer:Buffer.from('{}')});await reached;await expect(play(page)).toHaveAttribute('aria-pressed','false');const stopped=await viewer(page).getAttribute('data-selected-case');await page.waitForTimeout(3250);expect(await viewer(page).getAttribute('data-selected-case')).toBe(stopped);const finished=page.waitForResponse(response=>response.url().endsWith('/api/v1/evidence/import'));release();await finished;}finally{release();await page.unroute('**/api/v1/evidence/import',handler);}
  await exit(page);await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');await page.locator('#universe-search').fill('pluto');await expect(page.getByRole('listbox')).toBeVisible();await page.getByRole('button',{name:'New session',exact:true}).click();await expect(page.locator('#universe-search')).toHaveValue('');await expect(page.getByRole('listbox')).toHaveCount(0);await expect(viewer(page)).not.toBeVisible();await enter(page);await readyPhoto(page,ids[0]);await expect(play(page)).toHaveAttribute('aria-pressed','false');
});
