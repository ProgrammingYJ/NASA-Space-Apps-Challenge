import {test,expect,type APIRequestContext,type Page} from '@playwright/test';
import type {OuterTnoCatalog,OuterTnoObject} from '../src/OuterTnoPanel';
import type {AppearanceEntry} from '../src/planetAppearance';
import {tnoDescriptionCopy} from '../src/TnoDescriptionCopy';
import {appearanceCopy} from '../src/AppearanceCopy';
import {sceneSettingsCopy} from '../src/SceneSettingsCopy';
import {planetNineCopy} from '../src/PlanetNineCopy';

// Existing config: workers=1, screenshot=only-on-failure, trace=retain-on-failure.
// Run against the independent server with PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012.
// This spec uses the deployed API and published assets; it does not mock observations,
// call external archives, run gravity integrations or take success screenshots.
const languages=['ko','en','ja','zh-Hant','fr'] as const;
const planets=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
const identitySha='de0303824a588ead2ebd0a027780946e97c98cec99b7ab8ba0c0f85361608509';
const identityReceived='2026-11-14T21:50:50.039598+00:00';
const snapshotSha='6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1';
const scene=(page:Page)=>page.getByTestId('universe-scene');

async function json<T>(request:APIRequestContext,url:string):Promise<T>{
  const response=await request.get(url,{timeout:15000});
  expect(response.ok(),`${response.status()} ${url}`).toBe(true);
  return await response.json() as T;
}
async function ready(page:Page){
  await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  await expect(page.getByTestId('open-tno-catalogue')).toBeEnabled();
  await expect(scene(page)).toHaveAttribute('data-outer-tno-catalogue','8341');
  await expect(scene(page)).toHaveAttribute('data-render-fps-limit','30');
  await expect(scene(page)).toHaveAttribute('data-render-dpr-limit','1.25');
}
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
}
async function browseChoose(page:Page,query:string,id:string){
  await page.getByTestId('open-tno-catalogue').click();
  await page.getByTestId('tno-catalogue-search').fill(query);
  const list=page.getByTestId('tno-catalogue-list');
  await expect(list.locator('button')).toHaveCount(1);
  await list.getByTestId('tno-row-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
}
async function settingFilter(page:Page,value:string){
  await page.getByTestId('settings-toggle').click();
  await page.getByTestId('settings-scene-filter').selectOption(value);
  await expect(page.locator('#universe-settings')).toHaveCount(0);
}
async function expectNativeIds(page:Page,ids:string[]){
  const labels=page.locator('[data-testid^="object-label-"]');
  await expect(labels).toHaveCount(ids.length);
  const actual=await labels.evaluateAll(elements=>elements.map(element=>element.getAttribute('data-testid')!.replace('object-label-','')).sort());
  expect(actual).toEqual([...ids].sort());
}

test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});

test('DEV-020: real catalogue facts, FO563 identity and missing-phase criteria remain honest in five languages',async({page},testInfo)=>{
  test.setTimeout(120000);
  const massCalculations:string[]=[];
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/mass-scenarios/calculate'))massCalculations.push(request.postData()??'');});
  await ready(page);
  const catalogue=await json<OuterTnoCatalog & {source_algorithm_version:string}>(page.request,'/api/v1/catalog/outer-tno');
  expect(catalogue.objects).toHaveLength(8341);
  expect(catalogue.objects.filter(row=>row.orbit!==null)).toHaveLength(8340);
  expect(new Set(catalogue.objects.map(row=>row.object_id)).size).toBe(8341);
  expect(catalogue.source_manifest_sha256).toBe(snapshotSha);
  expect(catalogue.algorithm_version).toBe('jpl-sbdb-tno-two-body-v2');
  expect(catalogue.source_algorithm_version).toBe('jpl-sbdb-tno-two-body-v1');
  expect(catalogue.objects.every(row=>!('info' in row))).toBe(true);
  const fo=catalogue.objects.find(row=>row.object_id==='sbdb-54538127');
  expect(fo?.pdes).toBe('2015 FO563');expect(fo?.known_object_id).toBeNull();
  const detail=await json<OuterTnoObject>(page.request,`/api/v1/catalog/outer-tno/object?object_id=sbdb-54538127&jd_tdb=${catalogue.reference_jd_tdb}`);
  expect(detail.info?.designation).toMatchObject({value:'2015 FO563',type:'provisional_designation',jpl_kind:'au',iau_name:null});
  expect(detail.info?.orbit_class).toMatchObject({code:'TNO',iau_planet_status_inferred:false});
  expect(detail.info?.observations).toMatchObject({arc_days:7,count:10,condition_code:'9',first_used:'2015-03-18',last_used:'2015-03-25',normalized_rms:.14971,normalized_rms_unit:'dimensionless',dates_are_discovery_dates:false});
  expect(detail.info?.uncertainty).toMatchObject({sigma_a_au:3844.3,highly_uncertain_condition:true,sigma_a_at_least_nominal_a:true,propagated_position_covariance:null,verified_long_term_precision:false});
  expect(detail.info?.marker).toEqual({kind:'calculated_navigation_marker',resolved_photo:false,physical_radius:false,measured_brightness:false});
  expect(detail.info?.provenance).toMatchObject({sha256:identitySha,bytes:506627,received_at_utc:identityReceived,api_version:'1.0',snapshot_manifest_sha256:snapshotSha});
  expect(detail.info?.provenance.url).toBe('https://ssd-api.jpl.nasa.gov/sbdb_query.api?sb-class=TNO&fields=spkid%2Ckind%2Cprefix%2Cpdes%2Cfull_name%2Cclass&sort=spkid');
  expect(detail.physical.mass_kg).toBeNull();expect(detail.physical.diameter_km).toBeNull();
  expect(detail.full_orbit_au).toHaveLength(257);
  await page.getByTestId('open-tno-catalogue').click();
  await expect(page.getByTestId('tno-catalogue-count')).toContainText('8,341');
  await page.getByTestId('tno-catalogue-search').fill('2015 FO563');
  await expect(page.getByTestId('tno-catalogue-list').locator('button')).toHaveCount(1);
  await page.getByTestId('tno-row-sbdb-54538127').click();
  const panel=page.getByTestId('outer-tno-panel'),description=panel.getByTestId('tno-description');
  await expect(panel.getByTestId('outer-tno-id')).toContainText('sbdb-54538127');
  await expect(scene(page)).toHaveAttribute('data-outer-tno-selected','sbdb-54538127');
  await expect(scene(page)).toHaveAttribute('data-outer-tno-orbit-points','257');
  for(const language of languages){
    // A modal is closed before operating the language control behind its backdrop.
    await page.getByTestId('language').selectOption(language);
    const copy=tnoDescriptionCopy(language);
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(description).toContainText(copy.title);
    await expect(description.getByTestId('outer-tno-classification')).toContainText(copy.className);
    await expect(description.getByTestId('tno-designation-explanation')).toContainText(copy.provisional);
    await expect(description.getByTestId('tno-marker-explanation')).toHaveText(copy.marker);
    await expect(description.getByTestId('tno-high-uncertainty')).toContainText(copy.highUncertainty);
    await expect(description).not.toContainText(/undefined|NaN|tnoDescriptionCopy/);
    await page.getByTestId('open-planet-criteria').click();
    const dialog=page.getByTestId('planet-criteria-dialog');
    await expect(dialog).toHaveAttribute('data-object-id','sbdb-54538127');
    await expect(dialog).toHaveAttribute('data-generic-tno','true');
    await expect(dialog.getByTestId('criterion-orbits_sun')).toHaveAttribute('data-status','met');
    for(const id of ['equilibrium_shape','orbital_dominance'])await expect(dialog.getByTestId('criterion-'+id)).toHaveAttribute('data-status','unknown');
    await expect(dialog.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','unavailable');
    await expect(dialog.getByTestId('criteria-orbit-diagram')).toBeVisible();
    await expect(dialog.getByTestId('criteria-orbit-diagram')).toHaveAttribute('data-semimajor-au',String(detail.semimajor_axis_au));
    await expect(dialog.getByTestId('mass-scenario-panel')).toHaveCount(0);
    await expect(dialog).not.toContainText(/undefined|NaN|criteriaReason_r029|criteriaClass_small_body/);
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('open-planet-criteria')).toBeFocused();
  }
  await page.getByTestId('language').selectOption('en');
  await description.locator('summary').click();
  await expect(description).toContainText('2015-03-18 → 2015-03-25');
  await expect(description).toContainText(tnoDescriptionCopy('en').notDiscovery);
  await expect(description).toContainText(identityReceived);await expect(description).toContainText(identitySha);
  await expect(description.getByRole('link',{name:'JPL SBDB Query',exact:false})).toHaveAttribute('href',detail.info!.provenance.url);
  for(const url of ['https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html','https://ssd-api.jpl.nasa.gov/doc/sbdb_filter.html','https://docs.minorplanetcenter.net/mpc-ops-docs/designations/'])await expect(description.locator(`a[href="${url}"]`)).toHaveCount(1);
  const facts=panel.getByTestId('outer-tno-source-facts');await facts.locator('summary').click();
  await expect(facts).toContainText('Normalised orbit-fit RMS (dimensionless): 0.14971');
  await expect(facts).not.toContainText(/0\.14971\s*[″"]/);
  const missing=catalogue.objects.find(row=>row.pdes==='2002 PD153');expect(missing).toBeTruthy();expect(missing!.orbit).toBeNull();
  await browseChoose(page,'2002 PD153',missing!.object_id);
  await expect(scene(page)).toHaveAttribute('data-outer-tno-orbit-points','0');
  await page.getByTestId('open-planet-criteria').click();
  const missingDialog=page.getByTestId('planet-criteria-dialog');
  await expect(missingDialog.getByTestId('criterion-orbits_sun')).toHaveAttribute('data-status','met');
  await expect(missingDialog.getByTestId('criterion-orbits_sun')).toContainText('missing orbital phase');
  await expect(missingDialog.getByTestId('criteria-orbit-diagram')).toHaveAttribute('data-eccentricity','0');
  await expect(missingDialog.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','unavailable');
  expect(massCalculations).toEqual([]);
  await testInfo.attach('dev020-selected-source-contract.json',{body:JSON.stringify({catalogue_count:catalogue.objects.length,usable_orbits:8340,source_sha256:catalogue.source_manifest_sha256,fo563:detail.info,missing_phase_object_id:missing!.object_id,mass_calculations:massCalculations}),contentType:'application/json'});
});

test('DEV-020: display filters separate eight planets and the Sun from a conditional literature hypothesis',async({page},testInfo)=>{
  test.setTimeout(120000);await ready(page);
  const epoch=await scene(page).getAttribute('data-model-epoch');
  await page.getByTestId('scene-filter').selectOption('confirmed-planets');
  await expectNativeIds(page,['sun',...planets]);
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','false');
  await expect(scene(page)).toHaveAttribute('data-hypothesis-orbit-points','0');
  await expect(page.getByTestId('object-label-pluto')).toHaveCount(0);
  await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch!);
  await page.getByTestId('scene-filter').selectOption('p9-reference');
  await expect(page.getByTestId('planet-nine-workbench')).toBeVisible();
  await expectNativeIds(page,['sun']);
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','false');
  await expect(page.getByTestId('p9-preset')).toBeEnabled();
  const predicted=page.waitForResponse(response=>response.url().endsWith('/api/v1/planet-nine/predict')&&response.request().method()==='POST');
  await page.getByTestId('p9-predict').click();
  const response=await predicted;expect(response.ok()).toBe(true);
  const prediction=await response.json() as {status:string;full_orbit_au:number[][];orbit:{epoch_jd_tdb:number}};
  expect(prediction.status).toBe('conditional_hypothesis');expect(prediction.full_orbit_au).toHaveLength(257);
  // No new observed object or confirmed planet is created for this path.
  await expect(scene(page)).toHaveAttribute('data-hypothesis-orbit-points','257');
  await expectNativeIds(page,['sun']);
  await settingFilter(page,'planets-and-p9');
  await expectNativeIds(page,['sun',...planets]);
  await expect(scene(page)).toHaveAttribute('data-hypothesis-orbit-points','257');
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','false');
  await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch!);
  await expect(page.getByTestId('planet-nine-workbench')).toContainText(planetNineCopy('en').sourceNote);
  await page.getByTestId('settings-toggle').click();
  await expect(page.locator('#universe-settings')).toContainText(sceneSettingsCopy('en').note);
  await expect(page.getByTestId('outer-tno-toggle')).toBeDisabled();
  await page.getByTestId('settings-scene-filter').selectOption('all');
  await expect(page.getByTestId('scene-filter')).toHaveValue('all');
  await expect(page.getByTestId('planet-nine-panel')).toBeHidden();
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','true');
  await expect(page.getByTestId('object-label-pluto')).toHaveCount(1);
  const catalogue=await json<OuterTnoCatalog>(page.request,'/api/v1/catalog/outer-tno');
  expect(catalogue.objects).toHaveLength(8341);expect(catalogue.source_manifest_sha256).toBe(snapshotSha);
  expect(catalogue.objects.some(row=>/planet.?nine|hypothesis/i.test(row.object_id))).toBe(false);
  await testInfo.attach('dev020-display-filters.json',{body:JSON.stringify({unchanged_model_epoch:epoch,confirmed_ids:planets,sun_reference:true,conditional_path_points:prediction.full_orbit_au.length,catalogue_count:catalogue.objects.length,catalogue_sha256:catalogue.source_manifest_sha256}),contentType:'application/json'});
});

test('DEV-020: four published maps keep source dates, lighting controls and physical size through camera selection',async({page},testInfo)=>{
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  await ready(page);
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('render-preset')).toHaveValue('balanced');
  await expect(page.getByTestId('settings-appearance-lighting')).toHaveValue('inspection');
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);
    const copy=sceneSettingsCopy(language),settings=page.locator('#universe-settings');
    await expect(settings).toContainText(copy.balanced);await expect(settings).toContainText(copy.lightNote);
    await expect(settings).not.toContainText(/undefined|NaN|sceneSettingsCopy/);
  }
  await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();
  const adopted=await json<{objects:Record<string,AppearanceEntry & {sha256:string;observation_period:string;retrieved_utc:string}>}>(page.request,'/api/v1/appearance');
  const cases=[
    {id:'neptune',date:'2025-08-24/2025-08-25 (source UT labels)',url:'https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-32',note:appearanceCopy('en').rgb},
    {id:'uranus',date:'2025-10-23/2025-10-24 (source UT labels)',url:'https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-33',note:appearanceCopy('en').rgb},
    {id:'saturn',date:'2011-08-11',url:'https://atmos.nmsu.edu/data_and_services/atmospheres_data/Cassini/sat_global_map.html',note:appearanceCopy('en').saturn},
    {id:'pluto',date:'2015-07',url:'https://science.nasa.gov/resource/pluto-global-color-map/',note:appearanceCopy('en').pluto},
  ];
  const measurements=[];
  for(const entry of cases){
    const source=adopted.objects[entry.id];expect(source.observation_period).toBe(entry.date);expect(source.source.url).toBe(entry.url);
    expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);expect(source.texture_url).toMatch(/^\/textures\//);
    expect(Date.parse(source.retrieved_utc)).toBeLessThanOrEqual(Date.now());
    const label=page.getByTestId('object-label-'+entry.id);
    await expect(label).toHaveAttribute('data-mesh-world-radius',/.+/);
    const before={physical:Number(await label.getAttribute('data-physical-reference-radius-km')),mesh:Number(await label.getAttribute('data-mesh-world-radius'))};
    expect(before.physical).toBeGreaterThan(0);expect(before.mesh).toBeGreaterThan(0);
    await choose(page,entry.id);
    await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
    await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
    const notice=page.getByTestId('source-map-note');await expect(notice).toContainText(entry.note);
    await expect(notice.getByRole('link')).toHaveAttribute('href',entry.url);
    await expect(page.getByTestId('appearance-coverage-note')).toContainText(sceneSettingsCopy('en').gaps);
    await expect(page.getByTestId('appearance-lighting')).toHaveValue('inspection');
    await expect(label).toHaveAttribute('data-appearance-lighting','inspection');
    await page.getByTestId('appearance-lighting').selectOption('solar');
    await expect(label).toHaveAttribute('data-appearance-lighting','solar');
    expect(Number(await label.getAttribute('data-physical-reference-radius-km'))).toBe(before.physical);
    expect(Number(await label.getAttribute('data-mesh-world-radius'))).toBeCloseTo(before.mesh,7);
    await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');
    await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');
    await page.getByTestId('appearance-lighting').selectOption('inspection');
    await expect(label).toHaveAttribute('data-appearance-lighting','inspection');
    const dimensions=(await label.getAttribute('data-display-texture-dimensions'))!.split(',').map(Number);
    expect(dimensions).toHaveLength(2);expect(dimensions.every(value=>value>0&&Number.isFinite(value))).toBe(true);
    measurements.push({id:entry.id,observation_period:source.observation_period,source_url:source.source.url,sha256:source.sha256,physical_radius_km:before.physical,display_mesh_radius:before.mesh,display_texture_dimensions:dimensions});
  }
  await expect(scene(page)).toHaveAttribute('data-render-fps-limit','30');
  await expect(scene(page)).toHaveAttribute('data-render-dpr-limit','1.25');
  expect(errors).toEqual([]);
  await testInfo.attach('dev020-map-source-size-and-console.json',{body:JSON.stringify({maps:measurements,errors}),contentType:'application/json'});
});
