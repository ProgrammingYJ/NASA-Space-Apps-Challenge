import {test,expect,type Page} from '@playwright/test';
import type {Comparison} from '../src/types';

// These regressions use the actual exported observations/literature population.
// The asynchronous case only delays a genuine server response; no API values,
// observation pixels or scientific quantities are fabricated.
const locales=['ko','en','ja','zh-Hant','fr'] as const;
const scene=(page:Page)=>page.getByTestId('universe-scene');
const panel=(page:Page)=>page.getByTestId('planet-nine-panel');
const predictionRequest=(url:string)=>new URL(url).pathname==='/api/v1/planet-nine/predict';

async function ready(page:Page){
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  await expect(page.getByTestId('timeline-clock')).not.toHaveText('');
}
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}
async function navigation(page:Page){
  return scene(page).evaluate(element=>Object.fromEntries([
    'data-camera-position','data-camera-target','data-camera-mode','data-selected-object',
    'data-follow-object','data-distance-algorithm','data-distance-origin-object-id','data-model-epoch',
  ].map(name=>[name,element.getAttribute(name)])));
}
async function sunOverview(page:Page){
  await expect(scene(page)).toHaveAttribute('data-camera-mode','overview');
  await expect(scene(page)).toHaveAttribute('data-selected-object','');
  await expect(scene(page)).toHaveAttribute('data-follow-object','');
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm','solar-overview-common-v2');
  await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','');
  expect((await scene(page).getAttribute('data-camera-target'))!.split(',').map(Number)).toEqual([0,0,0]);
}
async function hypothesisState(page:Page){
  const inputs=await panel(page).locator('[data-testid^="p9-"]:is(input,select,textarea)').evaluateAll(elements=>
    Object.fromEntries(elements.map(element=>[
      element.getAttribute('data-testid'),element instanceof HTMLInputElement&&element.type==='checkbox'?element.checked:
        (element as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement).value,
    ])));
  return {inputs,sourceRow:await page.getByTestId('p9-active-hypothesis').getAttribute('data-source-row'),
    evidenceId:await page.getByTestId('p9-evidence-id').locator('code').textContent(),
    analogueIds:await page.getByTestId('p9-orbit-analogue-table').locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-object-id'))),
    path:await page.getByTestId('p9-sky-path').locator('path').getAttribute('d')};
}
async function reopen(page:Page){
  const button=page.getByTestId('p9-reopen-panel');
  await expect(button).toBeVisible();await expect(button).toBeInViewport({ratio:1});
  await expect(button).toHaveAttribute('aria-expanded','false');
  await expect(button).toHaveAttribute('aria-controls','planet-nine-panel');
  await expect(button).toHaveAccessibleName(/\S/);
  await button.focus();await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();await expect(panel(page)).toBeFocused();
  await expect(button).toHaveCount(0);
}

test('DEV-026 R033: entering Planet Nine from a focused observed planet returns to the Sun while its real observation workspace survives',async({page},testInfo)=>{
  test.setTimeout(150000);await ready(page);
  await page.locator('#model-epoch').fill('2035-03-19T12:22:00');await page.locator('#model-epoch').press('Enter');
  await expect(scene(page)).toHaveAttribute('data-model-epoch','2035-03-19T12:22:00.000Z');
  await choose(page,'neptune');await expect(scene(page)).toHaveAttribute('data-distance-algorithm','parent-linear-distance-v1');
  await page.getByTestId('open-object-observations').click();
  const observation=page.getByTestId('observation-panel');await expect(observation).toBeVisible();
  const dates=observation.locator('select').filter({has:page.locator('option[value="SPX-N01"]')});
  await expect(dates).toHaveCount(2);await expect(dates.nth(0)).toHaveValue('SPX-N01');await expect(dates.nth(1)).toHaveValue('SPX-N02');
  const comparisonResponse=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(new URL(response.url()).pathname),{timeout:60000});
  await observation.getByRole('button',{name:'Open comparison',exact:true}).click();
  const response=await comparisonResponse;expect(response.ok()).toBe(true);const comparison=await response.json() as Comparison;
  expect(comparison.object_id).toBe('neptune');expect(comparison.frames.map(frame=>frame.observation_id)).toEqual(['SPX-N01','SPX-N02']);
  await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
  await observation.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='DEV-026 R033 QA: keep the actual Neptune observation pair and its assessment when changing only the exploration view.';
  await observation.locator('#assessment').fill(judgment);
  const epoch=await scene(page).getAttribute('data-model-epoch'),clock=await page.getByTestId('timeline-clock').textContent();
  await page.getByTestId('open-planet-nine').click();await expect(panel(page)).toBeVisible();await sunOverview(page);
  await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch!);await expect(page.getByTestId('timeline-clock')).toHaveText(clock!);
  await expect(observation).toHaveCount(0);await expect(page.getByTestId('open-planet-nine')).toHaveAttribute('aria-pressed','true');
  // Return through the actual controls and reselect the same object. The
  // observation workspace must survive without a new comparison calculation.
  await panel(page).getByRole('button',{name:'Return to exploration',exact:true}).click();
  await choose(page,'neptune');await page.getByTestId('open-object-observations').click();
  await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
  await expect(dates.nth(0)).toHaveValue('SPX-N01');await expect(dates.nth(1)).toHaveValue('SPX-N02');
  await observation.getByRole('button',{name:'Evidence',exact:true}).click();await expect(observation.locator('#assessment')).toHaveValue(judgment);
  for(const [index,frame]of comparison.frames.entries())await expect(page.getByTestId(index===0?'frame-A':'frame-B')).toContainText(frame.metadata.date_avg);
  await expect(page.getByTestId('timeline-clock')).toHaveText(clock!);
  await testInfo.attach('dev026-r033-observation-and-sun.json',{body:JSON.stringify({object_id:'neptune',result_id:comparison.result_id,observation_ids:comparison.frames.map(frame=>frame.observation_id),source_sha256:comparison.frames.map(frame=>frame.provenance.sha256),model_epoch:epoch,observation_workspace_preserved:true}),contentType:'application/json'});
});

test('DEV-026 R034: hypothesis orbit view keeps a keyboard-reopenable workspace with unchanged source rows, inputs, evidence and continuous real-object selection',async({page},testInfo)=>{
  test.setTimeout(150000);await ready(page);const requests:unknown[]=[];
  page.on('request',request=>{if(request.method()==='POST'&&predictionRequest(request.url()))requests.push(request.postDataJSON());});
  await page.getByTestId('open-planet-nine').click();await page.getByTestId('p9-region-3682').click();
  const members=page.getByTestId('p9-members-dialog');await expect(members.getByTestId('p9-row-2413')).toBeEnabled();
  const predictionResponse=page.waitForResponse(response=>response.request().method()==='POST'&&predictionRequest(response.url()));
  await members.getByTestId('p9-row-2413').click();const response=await predictionResponse;expect(response.ok()).toBe(true);
  const prediction=await response.json() as {status:string;full_orbit_au:number[][];orbit:{a_au:number;e:number;i_deg:number;mass_earth:number}};
  expect(prediction.status).toBe('conditional_hypothesis');expect(prediction.orbit).toMatchObject({a_au:390.78,e:.139,i_deg:16.32,mass_earth:6.14});expect(prediction.full_orbit_au).toHaveLength(257);
  await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-2413');
  await expect(page.getByTestId('p9-orbit-analogue-table').locator('tbody tr')).toHaveCount(5);
  await page.getByTestId('p9-judgment').fill('DEV-026 R034 QA: literature row 2413 remains a conditional hypothesis while the panel is collapsed; analogue rank is not discovery probability.');
  await page.getByTestId('p9-save').click();await expect(page.getByTestId('p9-evidence-id').locator('code')).toHaveText(/^p9ev_[a-f0-9]+$/);
  const before=await hypothesisState(page),clock=await page.getByTestId('timeline-clock').textContent();
  await page.getByTestId('p9-view-hypothesis-orbit').click();await expect(panel(page)).toBeHidden();await sunOverview(page);
  await expect(scene(page)).toHaveAttribute('data-hypothesis-orbit-points','257');
  await expect(page.getByTestId('open-planet-nine')).toHaveAttribute('aria-pressed','true');
  const sun=await navigation(page);await expect(page.getByTestId('p9-reopen-panel')).toBeFocused();
  await reopen(page);await expect.poll(()=>navigation(page)).toEqual(sun);expect(await hypothesisState(page)).toEqual(before);
  const boundaries=[];
  for(const locale of locales){
    await page.getByTestId('language').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang',locale);
    const unchanged=await hypothesisState(page),cameraBefore=await navigation(page);
    const collapse=page.getByTestId('p9-collapse-panel');await expect(collapse).toHaveAttribute('aria-expanded','true');
    await expect(collapse).toHaveAttribute('aria-controls','planet-nine-panel');await expect(collapse).toHaveAccessibleName(/\S/);
    await collapse.click();await expect(panel(page)).toBeHidden();await expect(page.getByTestId('p9-reopen-panel')).toBeFocused();
    const bounds=await page.getByTestId('p9-reopen-panel').boundingBox();expect(bounds).toBeTruthy();boundaries.push({locale,bounds});
    await reopen(page);await expect.poll(()=>navigation(page)).toEqual(cameraBefore);expect(await hypothesisState(page)).toEqual(unchanged);
    await expect(page.getByTestId('p9-judgment')).toHaveValue(before.inputs['p9-judgment'] as string);
    expect(requests).toHaveLength(1);
  }
  await page.getByTestId('language').selectOption('en');
  // Native catalogue names continue to select their own scene/INFO without
  // replacing the hypothesis. A panel-only collapse must preserve this camera.
  for(const rank of [1,2]){
    await page.getByTestId('p9-goto-analogues').click();
    const row=page.getByTestId('p9-orbit-analogue-'+rank),id=await row.getAttribute('data-object-id');expect(id).toMatch(/^sbdb-/);
    await page.getByTestId('p9-analogue-name-'+rank).click();await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
    await expect(scene(page)).toHaveAttribute('data-selected-object',id!);await expect(scene(page)).toHaveAttribute('data-follow-object',id!);
    await expect(page.getByTestId('outer-tno-panel')).toBeVisible();await expect(page.getByTestId('outer-tno-id')).toContainText(id!);
    const selectedCamera=await navigation(page),state=await hypothesisState(page);
    await page.getByTestId('p9-collapse-panel').click();await expect(panel(page)).toBeHidden();await reopen(page);
    await expect.poll(()=>navigation(page)).toEqual(selectedCamera);expect(await hypothesisState(page)).toEqual(state);
    await expect(page.getByTestId('outer-tno-id')).toContainText(id!);await expect(row).toHaveAttribute('data-selected','true');
    expect(requests).toHaveLength(1);
  }
  await expect(page.getByTestId('timeline-clock')).toHaveText(clock!);
  await testInfo.attach('dev026-r034-collapse-continuity.json',{body:JSON.stringify({source_row:2413,evidence_id:before.evidenceId,analogue_ids:before.analogueIds,automatic_prediction_posts:requests.length,path_points:prediction.full_orbit_au.length,locale_bounds:boundaries,continuous_selection_preserved:true}),contentType:'application/json'});
});

test('DEV-026 R034: a genuine in-flight hypothesis calculation completes while only the panel is collapsed and does not recenter the camera',async({page},testInfo)=>{
  test.setTimeout(120000);await ready(page);await page.getByTestId('open-planet-nine').click();await expect(page.getByTestId('p9-preset')).toHaveValue(/caltech-row-/);await sunOverview(page);
  let release!:()=>void,finished!:()=>void,delivered=false,aborted=false,posts=0;
  const gate=new Promise<void>(resolve=>release=resolve),delivery=new Promise<void>(resolve=>finished=resolve);
  const pattern=/\/api\/v1\/planet-nine\/predict$/;
  await page.route(pattern,async route=>{
    posts++;
    try{const response=await route.fetch();expect(response.ok()).toBe(true);await gate;await route.fulfill({response});delivered=true;}
    catch{aborted=true;}finally{finished();}
  });
  try{
    await page.getByTestId('p9-predict').click();await expect(page.getByTestId('planet-nine-workbench')).toHaveAttribute('aria-busy','true');
    await page.getByTestId('p9-collapse-panel').click();await expect(panel(page)).toBeHidden();
    const before=await navigation(page);release();await delivery;
    await expect(scene(page)).toHaveAttribute('data-hypothesis-orbit-points','257');expect(delivered).toBe(true);expect(aborted).toBe(false);
    await expect.poll(()=>navigation(page)).toEqual(before);await reopen(page);
    await expect(page.getByTestId('p9-sky-path')).toBeVisible();await expect(page.getByTestId('planet-nine-workbench')).toHaveAttribute('aria-busy','false');
    await expect.poll(()=>navigation(page)).toEqual(before);expect(posts).toBe(1);
    await testInfo.attach('dev026-r034-pending-calculation.json',{body:JSON.stringify({genuine_prediction_posts:posts,delivered_after_collapse:delivered,aborted,camera_unchanged:true}),contentType:'application/json'});
  }finally{release();await page.unroute(pattern);}
});

test('DEV-026 R034: mobile hypothesis collapse and reopen controls fit their panel and viewport in all five languages',async({page},testInfo)=>{
  test.setTimeout(120000);await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByTestId('open-planet-nine').click();await expect(page.getByTestId('p9-preset')).toHaveValue(/caltech-row-/);
  const rectangles=[];
  for(const locale of locales){
    await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
    const collapse=page.getByTestId('p9-collapse-panel');await collapse.scrollIntoViewIfNeeded();
    await expect(collapse).toBeInViewport({ratio:1});await expect(collapse).toHaveAccessibleName(/\S/);
    const expanded=await panel(page).boundingBox(),control=await collapse.boundingBox();expect(expanded).toBeTruthy();expect(control).toBeTruthy();
    expect(control!.x).toBeGreaterThanOrEqual(expanded!.x-1);
    expect(control!.x+control!.width).toBeLessThanOrEqual(expanded!.x+expanded!.width+1);
    expect(control!.x).toBeGreaterThanOrEqual(0);expect(control!.x+control!.width).toBeLessThanOrEqual(391);
    await expect.poll(()=>page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth)).toBeLessThanOrEqual(1);
    await collapse.click();await expect(panel(page)).toBeHidden();
    const compact=page.getByTestId('p9-reopen-panel');await expect(compact).toBeFocused();await expect(compact).toBeInViewport({ratio:1});
    const compactBox=await compact.boundingBox();expect(compactBox).toBeTruthy();
    expect(compactBox!.x).toBeGreaterThanOrEqual(0);expect(compactBox!.x+compactBox!.width).toBeLessThanOrEqual(391);
    expect(compactBox!.y).toBeGreaterThanOrEqual(0);expect(compactBox!.y+compactBox!.height).toBeLessThanOrEqual(845);
    await expect.poll(()=>page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth)).toBeLessThanOrEqual(1);
    await reopen(page);rectangles.push({locale,panel:expanded,collapse:control,reopen:compactBox});
  }
  await testInfo.attach('dev026-r034-mobile-controls.json',{body:JSON.stringify({viewport:{width:390,height:844},locale_rectangles:rectangles,keyboard_reopen_and_focus:true}),contentType:'application/json'});
});
