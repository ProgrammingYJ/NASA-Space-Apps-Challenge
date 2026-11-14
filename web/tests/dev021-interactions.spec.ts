import {test,expect,type Page} from '@playwright/test';
import {planetNineInteractionCopy} from '../src/PlanetNineInteractionCopy';
import {r029Copy} from '../src/R029Copy';

// Run against root's isolated built server. These checks do not run external
// archives or fabricate source observations. Only explicit network-error/race
// fixtures intercept otherwise real source-backed API responses.
const locales=['ko','en','ja','zh-Hant','fr'] as const;
const subset='subset=ztf_des_ps1&max_reference_distance_au=1000';
const topCell=3682,firstRow=2413,earthMassKg=5.97217e24;
const scene=(page:Page)=>page.getByTestId('universe-scene');
const workbench=(page:Page)=>page.getByTestId('planet-nine-workbench');
const membersDialog=(page:Page)=>page.getByTestId('p9-members-dialog');
const pathIs=(url:string,path:string)=>new URL(url).pathname===path;
const localized=(value:number,locale='en')=>value.toLocaleString(locale,{maximumSignificantDigits:6});

interface MemberSample {
  id:string;row_index:number;kind:string;mass_earth:number;assumed_radius_earth:number;
  semimajor_axis_au:number;eccentricity:number;
}
interface Members {
  cell_id:number;rows:number[];samples:MemberSample[];member_count:number;
  source:{sha256:string};selection:{selected_count:number};
}

async function ready(page:Page){
  await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  await expect(page.getByTestId('open-tno-catalogue')).toBeEnabled();
  await expect(scene(page)).toHaveAttribute('data-outer-tno-catalogue','8341');
}
async function openP9(page:Page){
  await page.getByTestId('open-planet-nine').click();
  await expect(workbench(page)).toBeVisible();
  await expect(page.getByTestId(`p9-region-${topCell}`)).toBeEnabled();
}
async function chooseNative(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
}

test.beforeEach(async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
});

test('DEV-021: actual top-region samples open immediately in a native dialog and apply the source Earth mass',async({page},testInfo)=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const regionsResponse=await page.request.get(`/api/v1/planet-nine/regions?${subset}&offset=0&limit=5`);
  expect(regionsResponse.ok()).toBe(true);
  const regions=await regionsResponse.json() as {rows:{cell_id:number;rank:number}[];selection:{selected_count:number}};
  expect(regions.rows).toHaveLength(5);expect(regions.rows[0]).toMatchObject({cell_id:topCell,rank:1});
  expect(regions.selection.selected_count).toBe(20406);
  const response=await page.request.get(`/api/v1/planet-nine/regions/${topCell}/members?${subset}&limit=100`);
  expect(response.ok()).toBe(true);const actual=await response.json() as Members;
  expect(actual.cell_id).toBe(topCell);expect(actual.rows[0]).toBe(firstRow);
  expect(actual.samples[0]).toMatchObject({id:'caltech-row-2413',row_index:firstRow,kind:'synthetic_literature_sample',mass_earth:6.14,assumed_radius_earth:2.05});
  expect(actual.source.sha256).toBe('050b68182ecbf7fd76f280d8cc43c0683d207499aba1488a68092b834420a422');
  await ready(page);await openP9(page);
  await expect(page.getByTestId('p9-regions').locator('tbody tr')).toHaveCount(5);
  let release!:()=>void,finish!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve),finished=new Promise<void>(resolve=>finish=resolve);
  await page.route(/\/api\/v1\/planet-nine\/regions\/3682\/members(?:\?|$)/,async route=>{
    try{const real=await route.fetch();await gate;await route.fulfill({response:real});}
    catch{/* Closing a native dialog may correctly cancel its request. */}
    finally{finish();}
  });
  try{
    await page.getByTestId(`p9-region-${topCell}`).click();
    // Visibility must not depend on the HTTP result or scrolling to an inline list.
    await expect(membersDialog(page)).toBeVisible();
    await expect(membersDialog(page)).toHaveAttribute('open','');
    await expect(membersDialog(page)).toBeInViewport({ratio:.95});
    await expect(membersDialog(page).getByRole('status')).toHaveText(planetNineInteractionCopy('en').loading);
    await expect(page.getByTestId('p9-region-members')).toHaveCount(0);
    release();await finished;
    const row=membersDialog(page).getByTestId(`p9-row-${firstRow}`);
    await expect(row).toBeVisible();await expect(row).toContainText('6.14 M⊕');await expect(row).toContainText('2.05 R⊕');
    await row.click();
    await expect(membersDialog(page)).not.toBeVisible();
    await expect(page.getByTestId('p9-mass_earth')).toHaveValue('6.14');
    await expect(page.getByTestId('p9-sample-applied')).toContainText('#2413');
    await expect(page.getByTestId('p9-sample-applied')).toContainText(planetNineInteractionCopy('en').applied);
    await expect(page.getByTestId('p9-current-mass')).toContainText('6.14 M⊕');
    await expect(page.getByTestId('p9-current-mass-kg')).toContainText((6.14*earthMassKg).toExponential(6)+' kg');
    await expect(page.getByTestId('p9-current-mass')).toContainText(planetNineInteractionCopy('en').massNote);
    await expect(page.getByTestId('p9-density-unit-note')).toHaveText(planetNineInteractionCopy('en').densityNote);
  }finally{release();await page.unroute(/\/api\/v1\/planet-nine\/regions\/3682\/members(?:\?|$)/);}
  expect(errors).toEqual([]);
  await testInfo.attach('dev021-real-region-source.json',{body:JSON.stringify({cell:topCell,selected_count:actual.selection.selected_count,first_sample:actual.samples[0],source_sha256:actual.source.sha256,displayed_mass_kg:6.14*earthMassKg}),contentType:'application/json'});
});

test('DEV-021: the sample dialog stays visible and Escape restores its opener in all five locales',async({page})=>{
  test.setTimeout(120000);await ready(page);await openP9(page);
  for(const locale of locales){
    await page.getByTestId('language').selectOption(locale);
    const copy=planetNineInteractionCopy(locale),opener=page.getByTestId(`p9-region-${topCell}`);
    await opener.click();
    await expect(membersDialog(page)).toBeVisible();await expect(membersDialog(page)).toBeInViewport({ratio:.95});
    await expect(membersDialog(page).getByRole('heading',{level:2})).toContainText(copy.title);
    await expect(membersDialog(page)).toContainText(copy.synthetic);
    const row=membersDialog(page).getByTestId(`p9-row-${firstRow}`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(localized(6.14,locale)+' M⊕');
    await expect(row).toContainText(localized(2.05,locale)+' R⊕');
    await expect(page.getByTestId('p9-density-unit-note')).toHaveText(copy.densityNote);
    await expect(membersDialog(page)).not.toContainText(/undefined|NaN/);
    await page.keyboard.press('Escape');
    await expect(membersDialog(page)).not.toBeVisible();await expect(opener).toBeFocused();
  }
});

test('DEV-021: a timed-out member request keeps the dialog usable and a retry fetches real samples',async({page})=>{
  test.setTimeout(90000);let fail=true,attempts=0;
  await page.route(/\/api\/v1\/planet-nine\/regions\/3682\/members(?:\?|$)/,async route=>{
    attempts++;
    if(fail)await route.abort('timedout');else await route.continue();
  });
  await ready(page);await openP9(page);await page.getByTestId(`p9-region-${topCell}`).click();
  await expect(membersDialog(page)).toBeVisible();
  await expect(membersDialog(page).getByRole('alert')).toContainText(planetNineInteractionCopy('en').error);
  await expect(membersDialog(page).getByTestId(`p9-row-${firstRow}`)).toHaveCount(0);
  fail=false;await page.getByTestId('p9-members-retry').click();
  await expect(membersDialog(page).getByTestId(`p9-row-${firstRow}`)).toContainText('6.14 M⊕');
  expect(attempts).toBe(2);
  await page.getByTestId('p9-members-close').click();
  await expect(membersDialog(page)).not.toBeVisible();await expect(page.getByTestId(`p9-region-${topCell}`)).toBeFocused();
});

test('DEV-021: Sedna direct mass action starts blank and only an explicit density produces M⊕ and kg',async({page},testInfo)=>{
  test.setTimeout(90000);const posts:Record<string,unknown>[]=[];
  await page.route('**/api/v1/mass-scenarios/calculate',route=>{posts.push(route.request().postDataJSON() as Record<string,unknown>);return route.continue();});
  await ready(page);await chooseNative(page,'sedna');
  const compact=page.getByTestId('planet-criteria-card'),cta=compact.getByTestId('open-mass-calculator');
  await expect(cta).toHaveText(r029Copy('en').calculateCurrentMass+' ↗');
  await expect(compact.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','unavailable');
  expect(posts).toEqual([]);await cta.click();
  const dialog=page.getByTestId('planet-criteria-dialog'),editor=dialog.getByTestId('mass-scenario-panel');
  await expect(dialog).toBeVisible();await expect(editor).toHaveAttribute('open','');
  await expect(editor.getByTestId('mass-density')).toBeFocused();
  await expect(editor.getByTestId('mass-density')).toHaveValue('');await expect(editor.getByTestId('mass-analogue')).toHaveValue('');
  await expect(editor.getByTestId('mass-no-assumption')).toBeVisible();await expect(editor.getByTestId('mass-scenario-result')).toHaveCount(0);
  expect(posts).toEqual([]);
  await expect(editor.getByTestId('mass-adopted-radius')).toContainText('497.5 km');
  await expect(editor.getByTestId('mass-adopted-radius').getByRole('link')).toHaveAttribute('href','https://arxiv.org/abs/1204.0899');
  await expect(editor.getByTestId('mass-unit-formula')).toContainText('ρ[kg/m³]');
  await expect(editor.getByTestId('mass-unit-formula')).toContainText('R[km] × 1000');
  await expect(editor.getByTestId('mass-earth-conversion')).toContainText('kg');
  await expect(editor.getByTestId('mass-earth-conversion').getByRole('link')).toHaveAttribute('href','https://ssd.jpl.nasa.gov/planets/phys_par.html');
  const calculated=page.waitForResponse(response=>pathIs(response.url(),'/api/v1/mass-scenarios/calculate')&&response.request().method()==='POST');
  await editor.getByTestId('mass-density').fill('2000');await editor.getByTestId('mass-density').press('Enter');
  const result=await calculated;expect(result.ok()).toBe(true);
  const output=await result.json() as {mass_earth:number;mass_kg:number;radius_km:number;density_kg_m3:number;status:string};
  const expectedKg=2000*(4*Math.PI/3)*(497.5*1000)**3,expectedEarth=expectedKg/earthMassKg;
  expect(output.mass_kg/expectedKg).toBeCloseTo(1,14);expect(output.mass_earth).toBeCloseTo(expectedEarth,14);
  expect(output).toMatchObject({status:'hypothesis',radius_km:497.5,density_kg_m3:2000});
  await expect(editor.getByTestId('mass-estimate-earth')).toHaveText(localized(expectedEarth)+' M⊕');
  await expect(editor.getByTestId('mass-estimate-kg')).toContainText(expectedKg.toLocaleString('en',{notation:'scientific',maximumSignificantDigits:6})+' kg');
  await expect(editor.getByTestId('mass-applied-inputs')).toContainText('R = 497.5 km · ρ = 2,000 kg/m³');
  await expect(editor.getByTestId('mass-density-provenance')).toHaveText(r029Copy('en').manualDensity);
  await expect(dialog.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','hypothesis');
  await expect(dialog.getByTestId('criteria-minimum-mass')).toContainText('≈');
  expect(posts.length).toBeGreaterThan(0);expect(posts.every(input=>input.target_id==='sedna'&&input.density_kg_m3===2000&&input.analogue_id===null)).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(cta).toBeFocused();
  await expect(compact.getByTestId('criteria-minimum-mass')).toContainText('≈');
  expect(Number(await compact.getByTestId('criteria-minimum-mass').getAttribute('data-current-mass-earth'))).toBeCloseTo(expectedEarth,14);
  await chooseNative(page,'earth');await expect(page.getByTestId('open-mass-calculator')).toHaveCount(0);
  await expect(compact.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','measured');
  await testInfo.attach('dev021-explicit-density-units.json',{body:JSON.stringify({radius_km:497.5,density_kg_m3:2000,earth_mass_kg:earthMassKg,expected_mass_kg:expectedKg,expected_mass_earth:expectedEarth,posted_inputs:posts}),contentType:'application/json'});
});

test('DEV-021: a late P9 prediction cannot reset the closed-panel Earth camera at the 2035 model epoch',async({page},testInfo)=>{
  test.setTimeout(90000);await ready(page);await chooseNative(page,'earth');
  const epoch='2035-03-19T12:22:00.000Z';
  await page.locator('#model-epoch').fill('2035-03-19T12:22:00');await page.locator('#model-epoch').press('Enter');
  await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
  await openP9(page);
  let release!:()=>void,seen!:()=>void,done!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve),arrived=new Promise<void>(resolve=>seen=resolve),finished=new Promise<void>(resolve=>done=resolve);
  await page.route('**/api/v1/planet-nine/predict',async route=>{
    try{const real=await route.fetch();seen();await gate;await route.fulfill({response:real});}
    catch{/* Cancelling a now-hidden prediction is a valid guarded outcome. */}
    finally{done();}
  });
  const snapshot=()=>scene(page).evaluate(element=>({
    camera:element.getAttribute('data-camera-position'),target:element.getAttribute('data-camera-target'),
    mode:element.getAttribute('data-camera-mode'),epoch:element.getAttribute('data-model-epoch'),
    earthRadius:document.querySelector('[data-testid="object-label-earth"]')?.getAttribute('data-mesh-world-radius'),
  }));
  try{
    await page.getByTestId('p9-predict').click();await arrived;
    await workbench(page).locator('header').first().getByRole('button').click();await expect(workbench(page)).toBeHidden();
    await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
    const before=await snapshot();expect(before.epoch).toBe(epoch);expect(before.camera).toBeTruthy();
    release();await finished;
    // This bounded negative-observation window catches a fulfilled fetch whose
    // React callback runs after the panel has already closed (the original bug).
    await page.waitForTimeout(600);
    const after=await snapshot();expect(after).toEqual(before);
    await expect(workbench(page)).toBeHidden();await expect(scene(page)).toHaveAttribute('data-selected-object','earth');
    await testInfo.attach('dev021-closed-panel-late-prediction.json',{body:JSON.stringify({before,after}),contentType:'application/json'});
  }finally{release();await page.unroute('**/api/v1/planet-nine/predict');}
});
