import {test,expect,type Page} from '@playwright/test';
import {p9StepCopy} from '../src/P9StepCopy';
import {planetNineInteractionCopy} from '../src/PlanetNineInteractionCopy';
import {orbitAnalogueCopy} from '../src/OrbitAnalogueCopy';

// Root runs this on the isolated built server, one Chrome worker. Gates delay
// genuine local API responses only; no source values or science images are faked.
const locales=['ko','en','ja','zh-Hant','fr'] as const;
const query='subset=ztf_des_ps1&max_reference_distance_au=1000';
interface Region {cell_id:number;rank:number;count:number;conditional_probability:number;density_sr_inv:number;center_ra_deg:number;center_dec_deg:number}
interface Regions {rows:Region[];selection:{selected_count:number;original_count:number};source:{reference_epoch_jd_raw:number;sha256:string}}
async function ready(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('open-planet-nine').click();await expect(page.getByTestId('p9-region-3682')).toBeEnabled();
}

test('DEV-025: TOP5 cards preserve real n/N, density, epoch, source links and five-language selection meaning',async({page},testInfo)=>{
  test.setTimeout(120000);await page.setViewportSize({width:1440,height:1180});
  const response=await page.request.get(`/api/v1/planet-nine/regions?${query}&offset=0&limit=5`);expect(response.ok()).toBe(true);
  const source=await response.json() as Regions;expect(source.rows).toHaveLength(5);expect(source.rows[0]).toMatchObject({cell_id:3682,rank:1});
  expect(source.selection).toMatchObject({selected_count:20406,original_count:100000});
  expect(source.source.reference_epoch_jd_raw).toBe(2458270);expect(source.source.sha256).toBe('050b68182ecbf7fd76f280d8cc43c0683d207499aba1488a68092b834420a422');
  await ready(page);const regions=page.getByTestId('p9-regions'),list=page.getByTestId('p9-region-cards');
  await expect(list.getByRole('listitem')).toHaveCount(5);await expect(regions.locator('table')).toHaveCount(0);
  await expect(page.getByTestId('p9-workflow-steps').getByRole('listitem')).toHaveCount(3);
  await expect(page.getByTestId('p9-region-card-3682')).toBeInViewport({ratio:.8});
  for(const row of source.rows){
    const card=page.getByTestId('p9-region-card-'+row.cell_id);await expect(card).toHaveAttribute('data-count',String(row.count));
    await expect(card).toHaveAttribute('data-denominator',String(source.selection.selected_count));await expect(card).toHaveAttribute('data-density-sr-inv',String(row.density_sr_inv));
    await expect(card).toHaveAttribute('data-source-epoch-jd',String(source.source.reference_epoch_jd_raw));await expect(card).toContainText('sr⁻¹');
    await expect(card).toContainText(row.center_ra_deg.toLocaleString('en',{maximumSignificantDigits:6}));await expect(card).toContainText(row.center_dec_deg.toLocaleString('en',{maximumSignificantDigits:6}));
    await expect(card.getByTestId('p9-region-'+row.cell_id)).toHaveAttribute('aria-haspopup','dialog');
  }
  const originalIds=await list.getByRole('listitem').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-testid')));
  for(const locale of locales){
    await page.getByTestId('language').selectOption(locale);const copy=p9StepCopy(locale),detail=page.getByTestId('p9-region-method');
    await expect(regions).toContainText(copy.condition);await expect(regions).toContainText(copy.epochNote);await expect(regions).toContainText(copy.densityShort);
    await detail.locator('summary').click();await expect(page.getByTestId('p9-density-unit-note')).toHaveText(planetNineInteractionCopy(locale).densityNote);
    await expect(detail).toContainText(source.source.sha256);
    for(const doi of ['10.3847/1538-3881/ac2056','10.22002/8fjad-x7y61','10.3847/PSJ/abe53e'])await expect(detail.locator(`a[href="https://doi.org/${doi}"]`)).toHaveCount(1);
    await detail.locator('summary').click();await expect(regions).not.toContainText(/undefined|NaN/);
    expect(await list.getByRole('listitem').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-testid')))).toEqual(originalIds);
  }
  await page.getByTestId('language').selectOption('en');
  for(const width of [1440,2542]){
    await page.setViewportSize({width,height:1180});
    await expect.poll(()=>page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth)).toBeLessThanOrEqual(1);
    const panel=await page.getByTestId('planet-nine-panel').boundingBox();expect(panel).not.toBeNull();
    for(const row of source.rows){const box=await page.getByTestId('p9-region-card-'+row.cell_id).boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(panel!.x);expect(box!.x+box!.width).toBeLessThanOrEqual(panel!.x+panel!.width);}
  }
  await testInfo.attach('dev025-region-card-source.json',{body:JSON.stringify(source),contentType:'application/json'});
});

test('DEV-025: sample cards show loading, cancel stale selection and keep P9 hypotheses while real names focus',async({page},testInfo)=>{
  test.setTimeout(120000);await page.setViewportSize({width:1440,height:1180});await ready(page);
  const predictions:unknown[]=[];page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/planet-nine/predict')predictions.push(request.postDataJSON());});
  let releaseMembers!:()=>void,releasePopulation!:()=>void,memberDone!:()=>void,populationDone!:()=>void;
  const memberGate=new Promise<void>(resolve=>releaseMembers=resolve),populationGate=new Promise<void>(resolve=>releasePopulation=resolve);
  const membersFinished=new Promise<void>(resolve=>memberDone=resolve),populationFinished=new Promise<void>(resolve=>populationDone=resolve);
  const membersPattern=/\/api\/v1\/planet-nine\/regions\/3682\/members(?:\?|$)/,populationPattern=/\/api\/v1\/planet-nine\/population\/2413(?:\?|$)/;
  await page.route(membersPattern,async route=>{try{const real=await route.fetch();await memberGate;await route.fulfill({response:real});}catch{/* An explicit close may abort this response. */}finally{memberDone();}});
  await page.route(populationPattern,async route=>{try{const real=await route.fetch();await populationGate;await route.fulfill({response:real});}catch{/* Cancellation must not apply a stale sample. */}finally{populationDone();}});
  const dialog=page.getByTestId('p9-members-dialog');
  try{
    await page.getByTestId('p9-region-3682').click();await expect(dialog).toBeVisible();await expect(dialog.getByRole('status')).toHaveText(planetNineInteractionCopy('en').loading);
    await expect(page.getByTestId('p9-region-card-3682')).toHaveAttribute('data-selected','true');
    releaseMembers();await membersFinished;await expect(dialog.getByTestId('p9-row-2413')).toContainText('6.14 M⊕');
    await dialog.getByTestId('p9-row-2413').click();await expect(dialog.getByTestId('p9-sample-applying')).toContainText('#2413');
    await expect(dialog.getByTestId('p9-row-2413')).toHaveAttribute('aria-busy','true');
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByTestId('p9-region-3682')).toBeFocused();
    releasePopulation();await populationFinished;await expect(page.getByTestId('p9-preset')).not.toHaveValue('caltech-row-2413');expect(predictions).toHaveLength(0);
  }finally{releaseMembers();releasePopulation();await page.unroute(membersPattern);await page.unroute(populationPattern);}
  await page.getByTestId('p9-region-3682').click();await expect(dialog.getByTestId('p9-row-2413')).toBeEnabled();
  const predictionPromise=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/planet-nine/predict');
  await dialog.getByTestId('p9-row-2413').click();const predictionResponse=await predictionPromise;expect(predictionResponse.ok()).toBe(true);
  const prediction=await predictionResponse.json() as {status:string;orbit:{mass_earth:number;a_au:number;e:number;i_deg:number};full_orbit_au:number[][]};
  expect(prediction.status).toBe('conditional_hypothesis');expect(prediction.orbit).toMatchObject({mass_earth:6.14,a_au:390.78,e:.139,i_deg:16.32});expect(prediction.full_orbit_au).toHaveLength(257);
  await expect(dialog).not.toBeVisible();await expect(page.getByTestId('p9-sample-applied')).toContainText(p9StepCopy('en').applied);
  await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-2413');const summary=page.getByTestId('p9-active-hypothesis');await expect(summary).toHaveAttribute('data-source-row','2413');
  const hypothesisSummary=(await summary.textContent())!;await expect(page.getByTestId('p9-sky-path')).toBeVisible();await page.getByTestId('p9-goto-analogues').click();
  await expect(page.getByTestId('p9-orbit-analogue-table').locator('tbody tr')).toHaveCount(10);
  for(const rank of [1,2]){
    const row=page.getByTestId('p9-orbit-analogue-'+rank),id=await row.getAttribute('data-object-id');expect(id).toMatch(/^sbdb-/);
    await page.getByTestId('p9-analogue-name-'+rank).click();await expect(page.getByTestId('planet-nine-panel')).toBeVisible();await expect(summary).toHaveText(hypothesisSummary);
    await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-2413');await expect(page.getByTestId('p9-mass_earth')).toHaveValue('6.14');
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id!);await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-follow-object',id!);
    await expect(page.getByTestId('outer-tno-panel')).toBeVisible();await expect(page.getByTestId('outer-tno-id')).toContainText(id!);await expect(row).toHaveAttribute('data-selected','true');
  }
  expect(predictions).toHaveLength(1);
  await testInfo.attach('dev025-selection-continuity.json',{body:JSON.stringify({cancelled_selection_applied:false,automatic_prediction_posts:predictions.length,source_row:2413,orbit:prediction.orbit}),contentType:'application/json'});
});

test('DEV-025: catalogue errors remain retryable and App/P9 share one genuine retry across panel hide and reopen',async({page},testInfo)=>{
  test.setTimeout(120000);let requests=0,abortedRetries=0,release!:()=>void,finished!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve),delivery=new Promise<void>(resolve=>finished=resolve);
  const catalogueUrl=/\/api\/v1\/catalog\/outer-tno$/;
  let rawSource:{coordinate_frame:string;time_scale:string;source_manifest_sha256:string;objects:unknown[]}|undefined;
  // Inject a transport failure only, never fabricated catalogue/science values.
  // The retry forwards the real server body after an explicit UI-state gate.
  await page.route(catalogueUrl,async route=>{
    requests++;
    if(requests===1){await route.abort('failed');return;}
    try{
      const response=await route.fetch();expect(response.ok()).toBe(true);rawSource=await response.json();
      await gate;await route.fulfill({response});
    }catch{abortedRetries++;}finally{finished();}
  });
  try{
    await ready(page);const analogues=page.getByTestId('p9-orbit-analogues');await page.getByTestId('p9-goto-analogues').click();
    await expect(page.getByTestId('p9-analogue-retry')).toBeEnabled();await expect(analogues.getByRole('alert')).toContainText(orbitAnalogueCopy('en').error);expect(requests).toBe(1);
    await page.getByTestId('p9-analogue-retry').click();await expect(analogues.getByRole('status')).toHaveText(orbitAnalogueCopy('en').loading);
    await expect.poll(()=>requests).toBe(2);
    await page.getByTestId('planet-nine-panel').getByRole('button',{name:'Return to exploration',exact:true}).click();
    await expect(page.getByTestId('planet-nine-panel')).toBeHidden();await page.getByTestId('open-planet-nine').click();
    await expect(page.getByTestId('planet-nine-panel')).toBeVisible();await page.getByTestId('p9-goto-analogues').click();
    await expect(analogues.getByRole('status')).toHaveText(orbitAnalogueCopy('en').loading);expect(requests).toBe(2);
    release();await delivery;expect(abortedRetries).toBe(0);
    await expect(page.getByTestId('p9-orbit-analogue-table').locator('tbody tr')).toHaveCount(10);
    expect(rawSource).toBeTruthy();expect(rawSource!.objects).toHaveLength(8341);expect(rawSource!.coordinate_frame).toBe('heliocentric_IAU76_80_ecliptic_J2000');expect(rawSource!.time_scale).toBe('TDB');
    expect(rawSource!.source_manifest_sha256).toBe('6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1');
    await expect(analogues.locator('code').last()).toContainText(rawSource!.source_manifest_sha256);
    await expect(page.getByTestId('p9-analogue-count')).toContainText('8,340 / 8,341');
    await expect(analogues.getByRole('alert')).toHaveCount(0);expect(requests).toBe(2);
    await testInfo.attach('dev025-shared-catalogue-retry.json',{body:JSON.stringify({initial_transport_failure:true,requests,aborted_retries:abortedRetries,source_sha256:rawSource!.source_manifest_sha256,real_source_objects:rawSource!.objects.length,shared_retry_survived_panel_hide:true}),contentType:'application/json'});
  }finally{release();await page.unroute(catalogueUrl);}
});
