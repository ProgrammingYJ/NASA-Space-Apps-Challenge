import {test,expect,type Page,type Locator} from '@playwright/test';
import type {ExtendedCatalog} from '../src/extendedMath';
import {moonSimulationCopy} from '../src/MoonSimulationCopy';
import {fitMoonOsculatingState,propagateMoonOsculating,moonGmAu3Day2,MOON_PARENT_GM_KM3_S2,EARTH_MOON_OFFSET_SCALE,MOON_SIMULATION_ALGORITHM} from '../src/moonKepler';
import type {Vec3} from '../src/sceneMath';

// Existing config supplies workers=1 and screenshots only on failure.
// PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 targets the independent QA server.
// Read the application's existing catalogue response; do not refetch six large
// vector catalogues, call an archive, take success screenshots or run a build.
const parents=new Set(['earth','mars','jupiter','saturn','uranus','neptune']);
const languages=['ko','en','ja','zh-Hant','fr'] as const;
const scene=(page:Page)=>page.getByTestId('universe-scene');
const label=(page:Page,id:string)=>page.getByTestId('object-label-'+id);
const sourceEpoch=2461357.500800726;
// Independently saved source vectors (JPL Horizons), rather than a state copied
// from the new browser result. Core tests separately verify this propagator.
const titanSeed={tdb_jd:sourceEpoch,
  position_au:[.000240211872651548,-.007213669767532534,.003695603884869861] as Vec3,
  velocity_au_day:[.003223765759439939,.00003512534319663326,-.0003387797465696696] as Vec3};
const moonSeed={tdb_jd:sourceEpoch,
  position_au:[.00006487543928800212,-.002702030522195708,-.0001907201554865963] as Vec3,
  velocity_au_day:[.0005593080952028699,.000006475207938530518,.00002857364685472215] as Vec3};

async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}
async function seek(page:Page,date:string){
  const input=page.locator('#model-epoch');await expect(input).toBeEnabled();
  await input.fill(date);await input.press('Enter');
  await expect(input).toHaveAttribute('aria-invalid','false');
  await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source','simulation');
  await expect(scene(page)).toHaveAttribute('data-model-epoch',new Date(date+'Z').toISOString());
}
async function numbers(element:Locator,attribute:string){
  const value=await element.getAttribute(attribute);expect(value,attribute).toBeTruthy();
  const result=value!.split(',').map(Number);expect(result).toHaveLength(3);expect(result.every(Number.isFinite)).toBe(true);return result;
}
async function meshIds(elements:Locator){
  return elements.evaluateAll(rows=>rows.map(element=>element.getAttribute('data-testid')!.replace('object-label-','')).sort());
}

test('DEV-021: 453 sourced moons, including 291 Saturn meshes, survive historical and future model calendars',async({page},testInfo)=>{
  test.setTimeout(180000);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  const catalogueResponse=page.waitForResponse(response=>{
    const url=new URL(response.url());return response.request().method()==='GET'&&url.pathname==='/api/v1/catalog/solar-system'&&!url.search;
  },{timeout:60000});
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const response=await catalogueResponse;expect(response.ok()).toBe(true);
  const catalogue=await response.json() as ExtendedCatalog;
  expect(catalogue.source_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(catalogue.start_epoch).toBe('2026-11-13T00:00:00Z');expect(catalogue.end_epoch).toBe('2026-11-16T00:00:00Z');
  const sourceMoons=catalogue.objects.filter(body=>body.kind==='moon');
  const supported=sourceMoons.filter(body=>parents.has(body.parent_id)&&body.status==='available');
  const saturn=supported.filter(body=>body.parent_id==='saturn');
  expect(sourceMoons).toHaveLength(468);expect(supported).toHaveLength(453);expect(saturn).toHaveLength(291);
  const titanSource=sourceMoons.find(body=>body.object_id==='moon-606')!;
  expect(titanSource).toMatchObject({name:'Titan',parent_id:'saturn',radius_km:2574.76,status:'available'});
  expect(titanSource.source?.sha256).toBe('dff9590ff287ac28296728910274b9a16cf5fa9d24aae534a10aaa825ee7e235');
  await choose(page,'saturn');
  const saturnLabels=page.locator('[data-testid^="object-label-"][data-kind="moon"][data-parent-id="saturn"]');
  await expect(saturnLabels).toHaveCount(291,{timeout:90000});
  await expect(label(page,'moon-606')).toHaveAttribute('data-mesh-world-radius',/.+/);
  const physicalRadius=Number(await label(page,'moon-606').getAttribute('data-physical-reference-radius-km'));
  const displayRadius=Number(await label(page,'moon-606').getAttribute('data-mesh-world-radius'));
  const saturnPhysicalRadius=Number(await label(page,'saturn').getAttribute('data-physical-reference-radius-km'));
  expect(physicalRadius).toBe(titanSource.radius_km);expect(displayRadius).toBeGreaterThan(0);expect(saturnPhysicalRadius).toBeGreaterThan(0);
  const titanModel=fitMoonOsculatingState(titanSeed,moonGmAu3Day2(MOON_PARENT_GM_KM3_S2.saturn))!;
  const captures=[];
  for(const year of [1371,2035,3000]){
    const date=`${year}-01-01T00:00:00`;await seek(page,date);
    const status=page.getByTestId('moon-simulation-status');
    await expect(status).toHaveAttribute('data-hydration-state','ready',{timeout:90000});
    await expect(status).toHaveAttribute('data-algorithm-version',MOON_SIMULATION_ALGORITHM);
    await expect(status).toHaveAttribute('data-added-count','453');
    await expect(status).toHaveAttribute('data-source-moon-count','468');
    const moonLabels=page.locator('[data-testid^="object-label-"][data-kind="moon"]');
    await expect(moonLabels).toHaveCount(453);
    await expect(saturnLabels).toHaveCount(291);
    expect(await meshIds(moonLabels)).toEqual(supported.map(body=>body.object_id).sort());
    expect(await meshIds(saturnLabels)).toEqual(saturn.map(body=>body.object_id).sort());
    const meshes=await saturnLabels.evaluateAll(elements=>elements.map(element=>Number(element.getAttribute('data-mesh-world-radius'))));
    expect(meshes.every(value=>Number.isFinite(value)&&value>0)).toBe(true);
    for(const missing of sourceMoons.filter(body=>parents.has(body.parent_id)&&body.status!=='available'))await expect(label(page,missing.object_id)).toHaveCount(0);
    // Pluto/TNO local moons are not silently frozen at the 2026 seed date.
    await expect(label(page,'moon-901')).toHaveCount(0);
    await choose(page,'moon-606');
    const titan=label(page,'moon-606');
    await expect(titan).toHaveAttribute('data-kind','moon');await expect(titan).toHaveAttribute('data-parent-id','saturn');
    await expect(titan).toHaveAttribute('data-position-kind','osculating_kepler_extrapolation');
    await expect(titan).toHaveAttribute('aria-pressed','true');await expect(titan).toBeVisible();
    await expect(titan).toHaveAttribute('data-body-group-scale','1,1,1');
    expect(Number(await titan.getAttribute('data-physical-reference-radius-km'))).toBe(physicalRadius);
    expect(Number(await titan.getAttribute('data-mesh-world-radius'))).toBeCloseTo(displayRadius,7);
    expect(Number(await label(page,'saturn').getAttribute('data-physical-reference-radius-km'))).toBe(saturnPhysicalRadius);
    const info=page.getByTestId('moon-simulation-info');
    await expect(info).toHaveAttribute('data-source-epoch-jd-tdb',String(sourceEpoch));
    await expect(info).toHaveAttribute('data-gm-km3-s2','37940584.8418');
    await expect(info).toHaveAttribute('data-position-reference','parent_body_center');
    await expect(info).toHaveAttribute('data-status','unvalidated_two_body_extrapolation');
    await expect(info).toHaveAttribute('data-algorithm-version',MOON_SIMULATION_ALGORITHM);
    await expect(info).toContainText(moonSimulationCopy('en').note);
    await expect(info.getByRole('link',{name:moonSimulationCopy('en').stateSource,exact:false})).toHaveAttribute('href',titanSource.source!.url);
    await expect(info.getByRole('link',{name:moonSimulationCopy('en').gmSource,exact:false})).toHaveAttribute('href','https://ssd.jpl.nasa.gov/astro_par.html');
    const p=await numbers(titan,'data-source-position-au'),parent=await numbers(label(page,'saturn'),'data-source-position-au');
    const expected=propagateMoonOsculating(titanModel,Date.parse(date+'Z')/86400000+2440587.5)!.position_au;
    expected.forEach((value,i)=>expect(Math.abs((p[i]-parent[i])-value)).toBeLessThan(5e-10));
    captures.push({year,moon_count:453,saturn_meshes:291,source_epoch_jd_tdb:sourceEpoch,source_position_au:p,parent_position_au:parent,physical_radius_km:physicalRadius,display_radius:Number(await titan.getAttribute('data-mesh-world-radius'))});
  }
  expect(new Set(captures.map(capture=>capture.source_position_au.join(','))).size).toBe(3);
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);
    const copy=moonSimulationCopy(language),info=page.getByTestId('moon-simulation-info');
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(info).toContainText(copy.title);await expect(info).toContainText(copy.note);
    await expect(page.getByTestId('selected-position-description')).toHaveText(copy.description);
    await expect(page.getByTestId('moon-simulation-status')).toContainText(copy.ready);
    await expect(info).not.toContainText(/undefined|NaN|moonSimulationCopy/);
  }
  await page.getByTestId('language').selectOption('en');
  await seek(page,'2035-01-01T00:00:00');await choose(page,'moon-301');
  const lunarInfo=page.getByTestId('moon-simulation-info');
  await expect(lunarInfo).toHaveAttribute('data-position-reference','earth_moon_barycenter');
  await expect(lunarInfo).toHaveAttribute('data-gm-km3-s2','403503.23562500003');
  expect(Number(await label(page,'moon-301').getAttribute('data-physical-reference-radius-km'))).toBe(1737.4);
  const earth=await numbers(label(page,'earth'),'data-source-position-au'),lunar=await numbers(label(page,'moon-301'),'data-source-position-au');
  const lunarModel=fitMoonOsculatingState(moonSeed,moonGmAu3Day2(MOON_PARENT_GM_KM3_S2.earth))!;
  const expectedMoon=propagateMoonOsculating(lunarModel,Date.parse('2035-01-01T00:00:00Z')/86400000+2440587.5)!.position_au;
  expectedMoon.forEach((value,i)=>expect(Math.abs((lunar[i]-earth[i])-value*EARTH_MOON_OFFSET_SCALE)).toBeLessThan(5e-10));
  await expect(scene(page)).toHaveAttribute('data-render-fps-limit','30');
  await expect(scene(page)).toHaveAttribute('data-render-dpr-limit','1.25');
  expect(errors).toEqual([]);
  await testInfo.attach('dev021-source-moon-calendar-regression.json',{body:JSON.stringify({catalogue_manifest_sha256:catalogue.source_manifest_sha256,source_moons:468,supported_moons:453,saturn_supported:291,source_epoch_jd_tdb:sourceEpoch,algorithm:MOON_SIMULATION_ALGORITHM,captures,earth_reference:'earth_moon_barycenter',errors}),contentType:'application/json'});
});
