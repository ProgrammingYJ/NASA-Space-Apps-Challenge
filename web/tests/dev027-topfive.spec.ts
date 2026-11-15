import {test,expect,type Page} from '@playwright/test';
import type {Comparison} from '../src/types';
import type {OuterTnoCatalog} from '../src/OuterTnoPanel';
import type {PlanetNinePresets} from '../src/PlanetNineTypes';

// These IDs are pinned to the genuine first literature preset and the source
// snapshot below. This checks the UI/scene binding; independent numerical
// validation of the descriptive a/e/i rule remains in its existing unit tests.
const sourceSha='6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1';
const firstFive=['sbdb-54526835','sbdb-54352836','sbdb-54476971','sbdb-54343263','sbdb-54352848'];
const planets=['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
const scene=(page:Page)=>page.getByTestId('universe-scene');
const panel=(page:Page)=>page.getByTestId('planet-nine-panel');
const pathOf=(url:string)=>new URL(url).pathname;

async function showSearch(page:Page){
  if(await page.getByTestId('toggle-search-panel').getAttribute('aria-expanded')!=='true')await page.getByTestId('toggle-search-panel').click();
  await expect(page.getByTestId('exploration-search')).toBeVisible();
}
async function choose(page:Page,id:string){
  await showSearch(page);await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}
async function navigation(page:Page){
  return scene(page).evaluate(element=>Object.fromEntries([
    'data-camera-position','data-camera-target','data-selected-object',
    'data-follow-object','data-model-epoch','data-distance-algorithm',
  ].map(name=>[name,element.getAttribute(name)])));
}
async function hypothesis(page:Page){
  return panel(page).locator('input[data-testid^="p9-"],select[data-testid^="p9-"],textarea[data-testid^="p9-"]').evaluateAll(elements=>
    Object.fromEntries(elements.map(element=>[element.getAttribute('data-testid'),
      element instanceof HTMLInputElement&&element.type==='checkbox'?element.checked:
        (element as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement).value])));
}
async function fivePoints(page:Page){
  await expect(scene(page)).toHaveAttribute('data-outer-tno-catalogue','5');
  await expect(scene(page)).toHaveAttribute('data-outer-tno-rendered','5');
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','true');
  await expect(scene(page)).toHaveAttribute('data-decorative-kuiper-points','0');
}
async function nativeSolarSystem(page:Page){
  for(const id of ['sun',...planets])await expect(page.getByTestId('object-label-'+id)).toHaveAttribute('data-source-position-au',/.+/);
  await expect(page.getByTestId('object-label-epsilon-indi-b')).toHaveCount(0);
}

test('DEV-027 R035/R036: actual orbital-similarity TOP 5 initializes in a fresh session and panels reopen without losing the hypothesis, native bodies or real observations',async({page},testInfo)=>{
  test.setTimeout(180000);await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
  const posts:string[]=[];page.on('request',request=>{if(request.method()==='POST')posts.push(pathOf(request.url()));});
  const catalogueReply=page.waitForResponse(response=>pathOf(response.url())==='/api/v1/catalog/outer-tno'&&response.request().method()==='GET');
  const presetsReply=page.waitForResponse(response=>pathOf(response.url())==='/api/v1/planet-nine/presets'&&response.request().method()==='GET');
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const catalogueResponse=await catalogueReply,presetsResponse=await presetsReply;
  expect(catalogueResponse.ok()).toBe(true);expect(presetsResponse.ok()).toBe(true);
  const catalogue=await catalogueResponse.json() as OuterTnoCatalog,presets=await presetsResponse.json() as PlanetNinePresets;
  expect(catalogue.source_manifest_sha256).toBe(sourceSha);expect(catalogue.objects).toHaveLength(8341);
  expect(presets.presets[0]).toMatchObject({id:'caltech-row-0',orbit:{a_au:249.58,e:.074,i_deg:12.5,epoch_jd_tdb:2458270}});
  const names=firstFive.map(id=>{const object=catalogue.objects.find(row=>row.object_id===id);expect(object).toBeTruthy();return object!.name;});
  await expect(page.getByTestId('scene-filter').locator('option[value="p9-reference"]')).toBeEnabled();
  await page.getByTestId('scene-filter').selectOption('p9-reference');
  await expect(page.getByTestId('exploration-search')).toBeVisible();await expect(page.getByTestId('open-planet-nine')).toHaveAttribute('aria-pressed','false');
  const basis=page.getByTestId('top-five-display-basis');await expect(basis).toContainText('249.58');await expect(basis).toContainText('0.074');await expect(basis).toContainText('12.5');
  await expect(basis.locator('[data-testid^="top-five-display-"]')).toHaveCount(5);
  for(const [index,name]of names.entries())await expect(page.getByTestId('top-five-display-'+(index+1))).toContainText(name);
  await fivePoints(page);await expect(page.getByTestId('object-label-sun')).toHaveCount(1);await expect(page.getByTestId('object-label-earth')).toHaveCount(0);
  // The combined mode retains the actual native Solar System and five real
  // catalogue markers. It must not replace the search panel with the P9 dock.
  await page.getByTestId('scene-filter').selectOption('planets-and-p9');await fivePoints(page);await nativeSolarSystem(page);
  await expect(page.getByTestId('exploration-search')).toBeVisible();await expect(page.getByTestId('open-planet-nine')).toHaveAttribute('aria-pressed','false');

  await choose(page,'neptune');await page.getByTestId('open-object-observations').click();
  const observation=page.getByTestId('observation-panel');await expect(observation).toBeVisible();
  const dates=observation.locator('select').filter({has:page.locator('option[value="SPX-N01"]')});
  await expect(dates).toHaveCount(2);await expect(dates.nth(0)).toHaveValue('SPX-N01');await expect(dates.nth(1)).toHaveValue('SPX-N02');
  const comparisonReply=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(pathOf(response.url())),{timeout:60000});
  await observation.getByRole('button',{name:'Open comparison',exact:true}).click();
  const response=await comparisonReply;expect(response.ok()).toBe(true);const comparison=await response.json() as Comparison;
  expect(comparison.object_id).toBe('neptune');expect(comparison.frames.map(frame=>frame.observation_id)).toEqual(['SPX-N01','SPX-N02']);
  await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
  await observation.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='DEV-027 R036 QA: preserve the actual Neptune pair and assessment while opening and hiding independent exploration panels.';
  await observation.locator('#assessment').fill(judgment);
  const epoch=await scene(page).getAttribute('data-model-epoch'),clock=await page.getByTestId('timeline-clock').textContent();
  await page.getByTestId('open-planet-nine').click();await expect(panel(page)).toBeVisible();
  await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-0');
  const table=page.getByTestId('p9-orbit-analogue-table');await expect(table.locator('tbody tr')).toHaveCount(5);
  await expect.poll(()=>table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-object-id')))).toEqual(firstFive);
  await page.getByTestId('p9-judgment').fill('DEV-027: these are descriptive orbit analogues, not discovered Planet Nine candidates or existence probabilities.');
  const inputs=await hypothesis(page);
  await showSearch(page);await expect(page.getByTestId('scene-filter')).toHaveValue('planets-and-p9');await fivePoints(page);await nativeSolarSystem(page);

  for(const rank of [1,2]){
    await showSearch(page);await page.getByTestId('top-five-display-'+rank).click();
    await expect(scene(page)).toHaveAttribute('data-selected-object',firstFive[rank-1]);await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
    const info=page.getByTestId('outer-tno-panel');await expect(info).toBeVisible();await expect(page.getByTestId('outer-tno-id')).toContainText(firstFive[rank-1]);
    await expect(panel(page)).toBeVisible();const before=await navigation(page);
    await page.getByTestId('toggle-info-panel').click();await expect(info).toBeHidden();await expect(page.getByTestId('toggle-info-panel')).toHaveAttribute('aria-expanded','false');
    await page.getByTestId('toggle-info-panel').click();await expect(info).toBeVisible();
    await showSearch(page);await page.getByTestId('toggle-search-panel').click();await expect(page.getByTestId('exploration-search')).toBeHidden();
    await showSearch(page);await expect(page.getByTestId('scene-filter')).toHaveValue('planets-and-p9');
    await page.getByTestId('toggle-info-panel').click();await expect(info).toBeVisible();
    await page.getByTestId('p9-collapse-panel').click();await expect(panel(page)).toBeHidden();
    await page.getByTestId('p9-reopen-panel').click();await expect(panel(page)).toBeVisible();
    await expect.poll(()=>navigation(page)).toEqual(before);expect(await hypothesis(page)).toEqual(inputs);
    await expect(page.getByTestId('timeline-clock')).toHaveText(clock!);await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch!);
    await fivePoints(page);await nativeSolarSystem(page);
  }
  await panel(page).getByRole('button',{name:'Return to exploration',exact:true}).click();await choose(page,'neptune');
  await page.getByTestId('open-object-observations').click();await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
  await expect(dates.nth(0)).toHaveValue('SPX-N01');await expect(dates.nth(1)).toHaveValue('SPX-N02');
  await observation.getByRole('button',{name:'Evidence',exact:true}).click();await expect(observation.locator('#assessment')).toHaveValue(judgment);
  for(const [index,frame]of comparison.frames.entries())await expect(page.getByTestId(index===0?'frame-A':'frame-B')).toContainText(frame.metadata.date_avg);
  await expect(page.getByTestId('timeline-clock')).toHaveText(clock!);
  expect(posts.filter(path=>path==='/api/v1/comparison-jobs')).toHaveLength(1);expect(posts.filter(path=>path==='/api/v1/planet-nine/predict')).toHaveLength(0);
  await testInfo.attach('dev027-top-five-and-panel-continuity.json',{body:JSON.stringify({preset_id:presets.presets[0].id,source_manifest_sha256:sourceSha,actual_top_five_ids:firstFive,actual_top_five_names:names,rendered_TNO_markers:5,native_planets:planets,comparison_id:comparison.result_id,observation_ids:comparison.frames.map(frame=>frame.observation_id),observation_dates:comparison.frames.map(frame=>frame.metadata.date_avg),original_sha256:comparison.frames.map(frame=>frame.provenance.sha256),model_epoch:epoch,repeated_panels_preserved:true}),contentType:'application/json'});
});
