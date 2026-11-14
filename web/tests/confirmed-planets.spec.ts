import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const externalGalaxies=['galaxy-m31','galaxy-m33','galaxy-m81','galaxy-m87','galaxy-lmc','galaxy-smc','galaxy-m51','galaxy-m104','galaxy-centaurus-a'];
const explorer=(page:Page)=>page.getByTestId('universe-catalog-explorer');
const words=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
interface PlanetIndex {planet_count:number;host_count:number;url:string;raw_sha256:string;objects:{object_id:string;name:string;hostname:string;ra_deg:number|null;dec_deg:number|null}[]}
interface Evidence {object_id:string;name:string;confirmed:false;individually_identified_planets:number;orbit:null;resolved_surface:null;appearance:null;image:null;galaxy_relative_position_pc:null}
interface ExternalReview {objects:unknown[];confirmed_objects:unknown[];reviewed_unconfirmed_evidence:Evidence[];sources:Record<string,{url:string}>;summary_counts:{confirmed:number;candidates:number;population_studies:number};catalog_audit:{rows:number}}
async function json<T>(request:APIRequestContext,path:string):Promise<T>{const response=await request.get(path);expect(response.ok(),path).toBeTruthy();return await response.json() as T;}
async function openPlanets(page:Page,galaxy='galaxy-milky-way'){
  await page.getByTestId('open-universe-catalog').click();await expect(explorer(page)).toBeVisible();
  await page.getByTestId('universe-parent-galaxy').selectOption(galaxy);
  await page.getByTestId('catalog-mode-planets').click();
}
async function noFictionalRuntime(page:Page){
  await expect(page.locator('[data-testid^="synthetic-"]')).toHaveCount(0);
  await expect(page.locator('[data-object-id^="synthetic-"]')).toHaveCount(0);
  await expect(page.locator('canvas[data-testid^="synthetic-"]')).toHaveCount(0);
}

test('the adopted 6470-row archive and actual galaxy-member maps never promote unconfirmed external evidence to real planets',async({request})=>{
  const catalog=await json<PlanetIndex>(request,'/api/v1/catalog/exoplanets');
  expect(catalog.planet_count).toBe(6470);expect(catalog.host_count).toBe(4862);expect(catalog.objects).toHaveLength(6470);
  expect(new Set(catalog.objects.map(row=>row.object_id)).size).toBe(6470);
  expect(new Set(catalog.objects.map(row=>row.name)).size).toBe(6470);
  expect(new Set(catalog.objects.map(row=>row.hostname)).size).toBe(4862);
  const review=await json<ExternalReview>(request,'/api/v1/catalog/extragalactic-planets');
  expect(review.objects).toEqual([]);expect(review.confirmed_objects).toEqual([]);
  expect(review.summary_counts).toEqual({confirmed:0,candidates:2,population_studies:3});expect(review.catalog_audit.rows).toBe(6470);
  expect(review.reviewed_unconfirmed_evidence).toHaveLength(5);
  const observedIds=new Set(catalog.objects.map(row=>row.object_id)),observedNames=new Set(catalog.objects.map(row=>row.name.toLocaleLowerCase()));
  for(const evidence of review.reviewed_unconfirmed_evidence){
    expect(evidence.confirmed).toBe(false);expect(evidence.individually_identified_planets).toBe(0);
    expect(evidence.orbit).toBeNull();expect(evidence.resolved_surface).toBeNull();expect(evidence.appearance).toBeNull();expect(evidence.image).toBeNull();expect(evidence.galaxy_relative_position_pc).toBeNull();
    expect(observedIds.has(evidence.object_id)).toBe(false);expect(observedNames.has(evidence.name.toLocaleLowerCase())).toBe(false);
  }
  for(const galaxy of externalGalaxies){
    const members=await json<{objects:{object_id:string;kind:string}[]}>(request,'/api/v1/catalog/universe?galaxy_id='+galaxy);
    const filteredReview=await json<ExternalReview>(request,'/api/v1/catalog/extragalactic-planets?galaxy_id='+galaxy);
    expect(filteredReview.objects).toEqual([]);expect(filteredReview.confirmed_objects).toEqual([]);
    expect(members.objects.every(row=>!['planet','exoplanet','extragalactic_planet_candidate','planet_mass_population_evidence'].includes(row.kind))).toBe(true);
    for(const evidence of review.reviewed_unconfirmed_evidence)expect(members.objects.some(row=>row.object_id===evidence.object_id)).toBe(false);
  }
});

test('Milky Way confirmed-planet search forwards the exact catalog planet into its actual host system and auto-focuses it',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await openPlanets(page);
  await expect(page.getByTestId('catalog-mode-planets')).toHaveAttribute('aria-pressed','true');
  const catalog=await json<PlanetIndex>(page.request,'/api/v1/catalog/exoplanets');const target=catalog.objects.find(row=>row.name==='TRAPPIST-1 f');expect(target).toBeDefined();
  await expect(page.getByTestId('confirmed-catalog-count')).toContainText('6470');
  await page.getByTestId('universe-catalog-search').fill('TRAPPIST-1');await expect(explorer(page).locator('[data-testid^="universe-entry-"]')).toHaveCount(7);
  await page.getByTestId('universe-entry-'+target!.object_id).click();await expect(explorer(page)).not.toBeVisible();
  await expect(page.getByTestId('exoplanet-explorer')).toBeVisible();await expect(page.getByTestId('exoplanet-detail').getByRole('heading',{level:2})).toHaveText('TRAPPIST-1 f');
  const scene=page.getByTestId('exoplanet-scene');await expect(scene).toHaveAttribute('data-selected-object',target!.object_id);await expect(scene).toHaveAttribute('data-camera-mode','focused');await expect(scene).toHaveAttribute('data-focused-object',target!.object_id);
  await expect(scene).toHaveAttribute('data-surface-status','unresolved_illustration');await expect(page.locator('[data-testid^="exo-label-"]')).toHaveCount(7);
  await expect(page.getByTestId('exoplanet-detail')).toContainText(words('en').exoSurfaceNote);await noFictionalRuntime(page);
  await page.screenshot({path:'../var/qa/dev009-confirmed-trappist-f.png'});expect(errors).toEqual([]);
});

test('external galaxy planet views disclose missing confirmed records and sources in five locales without candidate maps or generated systems',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await openPlanets(page,'galaxy-m31');
  const review=await json<ExternalReview>(page.request,'/api/v1/catalog/extragalactic-planets');
  for(const galaxy of ['galaxy-m31','galaxy-m51']){
    await page.getByTestId('universe-parent-galaxy').selectOption(galaxy);
    await expect(page.getByTestId('confirmed-extragalactic-empty')).toBeVisible();await expect(explorer(page).locator('[data-testid^="universe-entry-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="universe-marker-"]')).toHaveCount(0);await expect(page.getByTestId('universe-catalog-detail')).toHaveCount(0);
    const sources=page.getByTestId('confirmed-extragalactic-empty');const details=sources.locator('details');if(await details.getAttribute('open')===null)await details.locator('summary').click();expect(await sources.locator('a[href^="https://"]').count()).toBeGreaterThan(0);
    for(const evidence of review.reviewed_unconfirmed_evidence){await expect(page.getByTestId('universe-entry-'+evidence.object_id)).toHaveCount(0);await expect(page.getByTestId('universe-marker-'+evidence.object_id)).toHaveCount(0);}
    await noFictionalRuntime(page);await page.screenshot({path:'../var/qa/dev009-confirmed-empty-'+galaxy+'.png'});
  }
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    await page.getByTestId('language').selectOption(locale);
    await expect(page.getByTestId('confirmed-extragalactic-empty')).toBeVisible();await expect(page.getByTestId('catalog-mode-planets')).toHaveAttribute('aria-pressed','true');
    const copy=words(locale);await expect(page.getByTestId('catalog-mode-planets')).toHaveText(copy.confirmedPlanets);for(const key of ['confirmedExtragalacticEmpty','confirmedExtragalacticNote','confirmedSurfaceNote'])await expect(page.getByTestId('confirmed-extragalactic-empty')).toContainText(copy[key]);await expect(explorer(page)).not.toContainText(/undefined|NaN|confirmedExtragalactic|confirmedSurface/);await noFictionalRuntime(page);
    await page.screenshot({path:'../var/qa/dev009-confirmed-empty-'+locale+'.png'});
  }
  expect(errors).toEqual([]);
});

test('a late external review cannot replace Milky Way planets and a failed review remains an error rather than a verified empty list',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const review=await json<ExternalReview>(page.request,'/api/v1/catalog/extragalactic-planets?galaxy_id=galaxy-m31');
  let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
  const sourceRequest=page.waitForRequest(request=>request.url().includes('/catalog/extragalactic-planets?galaxy_id=galaxy-m31'));
  await page.route('**/api/v1/catalog/extragalactic-planets?galaxy_id=galaxy-m31',async route=>{await held;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(review)});});
  try {
    await page.goto('/');await page.getByTestId('language').selectOption('en');await openPlanets(page,'galaxy-m31');await sourceRequest;
    await expect(page.getByTestId('confirmed-extragalactic-empty')).toHaveCount(0);
    await page.getByTestId('universe-parent-galaxy').selectOption('galaxy-milky-way');await expect(page.getByTestId('confirmed-catalog-count')).toContainText('6470');
    release();await page.getByTestId('universe-catalog-search').fill('TRAPPIST-1');await expect(explorer(page).locator('[data-testid^="universe-entry-"]')).toHaveCount(7);
    await expect(page.getByTestId('confirmed-extragalactic-empty')).toHaveCount(0);
    await page.route('**/api/v1/catalog/extragalactic-planets?galaxy_id=galaxy-m51',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'source_unavailable',message_key:'source_unavailable',details:{},request_id:'qa-confirmed-source-failure'})}));
    await page.getByTestId('universe-parent-galaxy').selectOption('galaxy-m51');await expect(explorer(page).getByRole('alert')).toContainText(words('en').universeCatalogError);
    await expect(page.getByTestId('confirmed-extragalactic-empty')).toHaveCount(0);await expect(explorer(page).locator('[data-testid^="universe-entry-"]')).toHaveCount(0);await noFictionalRuntime(page);
    await page.screenshot({path:'../var/qa/dev009-confirmed-source-error.png'});expect(errors).toEqual([]);
  } finally {release();}
});

test('the sky uses actual unique catalogue host directions and follows the camera without changing clickable objects',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  const index=await json<PlanetIndex>(page.request,'/api/v1/catalog/exoplanets');
  const hosts=new Set(index.objects.filter(row=>row.hostname.trim()&&typeof row.ra_deg==='number'&&typeof row.dec_deg==='number'&&Number.isFinite(row.ra_deg)&&Number.isFinite(row.dec_deg)&&row.ra_deg>=0&&row.ra_deg<360&&Math.abs(row.dec_deg)<=90).map(row=>row.hostname.trim()));
  expect(hosts.size).toBeGreaterThan(0);expect(hosts.size).toBeLessThanOrEqual(4862);
  const scene=page.getByTestId('universe-scene');await expect(scene).toHaveAttribute('data-sky-star-count',String(hosts.size));await expect(scene).toHaveAttribute('data-sky-representation','catalog_host_directions');
  await expect(scene).toHaveAttribute('data-sky-source-url',index.url);await expect(scene).toHaveAttribute('data-sky-source-sha256',index.raw_sha256);await expect(scene).toHaveAttribute('data-sky-frame-status','catalogue_ra_dec_frame_epoch_not_validated');
  await expect(page.getByTestId('catalog-sky-note')).toBeVisible();const caption=(await page.getByTestId('catalog-sky-note').boundingBox())!,timebar=(await page.getByTestId('unified-timeline').boundingBox())!;expect(caption.y+caption.height).toBeLessThanOrEqual(timebar.y);
  const before=(await scene.getAttribute('data-camera-position'))!;await page.getByTestId('universe-canvas').focus();await page.keyboard.down('KeyD');
  try {await expect.poll(()=>scene.getAttribute('data-camera-position')).not.toBe(before);}finally{await page.keyboard.up('KeyD');}
  await expect.poll(async()=>await scene.getAttribute('data-sky-center')===await scene.getAttribute('data-camera-position')).toBe(true);
  await expect(page.locator('[data-testid^="object-label-synthetic-"]')).toHaveCount(0);await noFictionalRuntime(page);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){await page.getByTestId('language').selectOption(locale);const text=words(locale).catalogSkyNote.replace('{{count}}',String(hosts.size));await expect(page.getByTestId('catalog-sky-note')).toContainText(text);}
  await page.screenshot({path:'../var/qa/dev009-real-host-sky.png'});expect(errors).toEqual([]);
});

test('unavailable catalogue data leave the sky empty rather than restoring generated background stars',async({page})=>{
  await page.route('**/api/v1/catalog/exoplanets',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'source_unavailable',message_key:'source_unavailable',details:{},request_id:'qa-sky-source-failure'})}));
  const response=page.waitForResponse(response=>response.url().endsWith('/api/v1/catalog/exoplanets')&&response.status()===503);await page.goto('/');await response;
  const scene=page.getByTestId('universe-scene');await expect(scene).toHaveAttribute('data-sky-star-count','0');await expect(scene).toHaveAttribute('data-sky-state','empty');await expect(scene).toHaveAttribute('data-sky-source-url','');
  await expect(scene).toHaveAttribute('data-sky-representation','catalog_host_directions');await noFictionalRuntime(page);
});
