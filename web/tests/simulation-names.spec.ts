import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const en=JSON.parse(readFileSync(new URL('../src/locales/en.json',import.meta.url),'utf8')) as Record<string,string>;

const scene=(page:Page)=>page.getByTestId('universe-scene');
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId(`search-${id}`).click();await expect(scene(page)).toHaveAttribute('data-selected-object',id);}
async function selectMode(page:Page,value:string){const details=page.getByTestId('time-source-details');if(await details.count()&&await details.getAttribute('open')===null)await details.locator('summary').click();await page.getByTestId('time-mode').selectOption(value);}
async function simulation(page:Page){await selectMode(page,'simulation');await expect(page.getByTestId('simulation-timeline')).toBeVisible();await expect(page.getByTestId('simulation-play')).toBeEnabled();}
async function applyYear(page:Page,year:number,method:'button'|'enter'|'tab'='button'){const input=page.getByTestId('simulation-year');await input.fill(String(year));if(method==='button')await page.getByTestId('simulation-apply').click();else await input.press(method==='enter'?'Enter':'Tab');await expect.poll(async()=>new Date((await scene(page).getAttribute('data-model-epoch'))!).getUTCFullYear()).toBe(year);}

test('all five locales update child moons and selected names while canonical IDs and designations remain searchable',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
  const local:[string,string,string,string][]=[['ko','엔켈라두스','그리드르','토성 위성'],['en','Enceladus','Gridr',''],['ja','エンケラドス','グリーズ','土星の衛星'],['zh-Hant','土衛二','土衛五十四','土星衛星'],['fr','Encelade','Gridr','satellite de Saturne']];
  for(const [locale,enceladus,gridr,context] of local){
    await page.getByTestId('language').selectOption(locale);await choose(page,'saturn');
    const list=page.getByTestId('object-panel').locator('details').filter({has:page.getByTestId('select-moon-602')});
    await expect(list).toHaveCount(1);if((await list.getAttribute('open'))===null)await list.locator('summary').click();
    await expect(page.getByTestId('select-moon-602')).toContainText(enceladus);
    await expect(page.getByTestId('select-moon-654')).toContainText(gridr);
    await expect(page.getByTestId('select-moon-658')).toContainText(`S/2004 S26${context?` · ${context}`:''}`);
    await page.getByTestId('select-moon-654').click();await expect(scene(page)).toHaveAttribute('data-selected-object','moon-654');await expect(page.getByTestId('selected-object-name')).toHaveText(gridr);
    await page.screenshot({path:'../var/qa/dev008-object-namedmoon-'+locale+'.png'});
    for(const query of ['Enceladus','엔켈라두스','エンケラドス','土衛二','Encelade']){await page.locator('#universe-search').fill(query);await expect(page.getByTestId('search-moon-602')).toContainText(enceladus);}
    await page.locator('#universe-search').fill('S/2004 S26');await expect(page.getByTestId('search-moon-658')).toContainText('S/2004 S26');await page.getByTestId('search-moon-658').click();await expect(scene(page)).toHaveAttribute('data-selected-object','moon-658');await expect(page.getByTestId('selected-object-name')).toHaveText(`S/2004 S26${context?` · ${context}`:''}`);
    await page.screenshot({path:'../var/qa/dev008-object-names-'+locale+'.png'});
  }
  expect(errors).toEqual([]);
});

test('the persistent Big Bang entry opens only actual cases and long-term simulation has bounded historical dates and nine supported bodies',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('open-big-bang')).toBeVisible();
  await page.getByTestId('open-big-bang').click();await expect(page.getByTestId('cosmic-observation-viewer')).toBeVisible();await expect(page.getByTestId('cosmic-observation-case-cosmic_gems_clusters')).toBeVisible();
  await expect(page.getByTestId('cosmic-observation-viewer').locator('[data-testid^="cosmic-observation-case-"]')).toHaveCount(5);await expect(page.getByTestId('history-canvas')).toHaveCount(0);await page.getByTestId('cosmic-observation-exit').click();
  await choose(page,'saturn');await expect(page.getByTestId('object-label-moon-606')).toHaveCount(1);await simulation(page);
  await expect(scene(page).locator('[data-testid^="object-label-"]')).toHaveCount(9);await expect(page.getByTestId('object-label-pluto')).toHaveCount(0);await expect(page.getByTestId('object-label-moon-606')).toHaveCount(0);
  await choose(page,'earth');await expect(page.getByTestId('selected-object-name')).toHaveText(en.body_earth);await expect(page.getByTestId('object-label-earth')).toHaveText(en.body_earth);await expect(page.getByTestId('position-reference')).toContainText(en.positionReference);await expect(page.getByTestId('position-reference')).toContainText(en.simEmB);await expect(page.getByTestId('object-panel')).toContainText(en.simEmbIcon);await expect(page.getByTestId('object-panel').locator('dt').filter({hasText:en.physicalRadius})).toHaveCount(0);await expect(page.getByTestId('object-label-earth')).toHaveAttribute('data-position-kind','approximate_simulation');
  const earthPosition=await page.getByTestId('object-label-earth').getAttribute('data-source-position-au');
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const words=JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
    await page.getByTestId('language').selectOption(locale);
    await expect(page.getByTestId('selected-object-name')).toHaveText(words.body_earth);
    await expect(page.getByTestId('object-label-earth')).toHaveText(words.body_earth);
    await expect(page.getByTestId('position-reference')).toContainText(words.positionReference);
    await expect(page.getByTestId('position-reference')).toContainText(words.simEmB);
    await expect(page.getByTestId('simulation-emb-icon-note')).toHaveText(words.simEmbIcon);
    await expect(page.getByTestId('object-label-earth')).toHaveAttribute('data-source-position-au',earthPosition!);
    await expect(page.getByTestId('object-panel').locator('dt').filter({hasText:words.physicalRadius})).toHaveCount(0);
    await page.screenshot({path:'../var/qa/dev009-earth-'+locale+'.png'});
  }
  await page.getByTestId('language').selectOption('en');
  for(const [year,method] of [[-2999,'button'],[0,'enter'],[99,'tab'],[2500,'enter']] as const){await applyYear(page,year,method);await expect(page.getByTestId('simulation-clock')).toContainText(`${year} /`);await expect(scene(page).locator('[data-testid^="object-label-"]')).toHaveCount(9);}
  const before=await page.getByTestId('object-label-earth').getAttribute('data-source-position-au');await page.getByTestId('simulation-rate').selectOption('876600');await page.getByTestId('simulation-play').click();await expect(page.getByTestId('simulation-play')).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.getByTestId('object-label-earth').getAttribute('data-source-position-au')).not.toBe(before);
  await page.getByTestId('open-big-bang').click();await expect(page.getByTestId('cosmic-observation-viewer')).toBeVisible();await page.getByTestId('cosmic-observation-exit').click();await expect(page.getByTestId('simulation-play')).toHaveAttribute('aria-pressed','false');const stopped=await scene(page).getAttribute('data-model-epoch');await page.waitForTimeout(250);await expect(scene(page)).toHaveAttribute('data-model-epoch',stopped!);
  await page.screenshot({path:'../var/qa/dev008-simulation-history-roundtrip.png'});
  expect(errors).toEqual([]);
});

test('invalid model dates preserve the last valid scene and missing simulation sources expose an error with precise-time recovery',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.locator('#model-epoch').fill('2026-11-15T00:00');await page.locator('#model-epoch').press('Tab');await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-15T00:00:00/);const preciseEpoch=await scene(page).getAttribute('data-model-epoch');
  await simulation(page);await applyYear(page,2500);const valid=await scene(page).getAttribute('data-model-epoch');await page.getByTestId('simulation-year').fill('');await page.getByTestId('simulation-year').press('Enter');await expect(page.getByTestId('simulation-timeline').getByRole('alert')).toContainText(en.simInvalid);await expect(scene(page)).toHaveAttribute('data-model-epoch',valid!);await expect(page.getByTestId('simulation-clock')).toContainText('2500 /');await page.getByTestId('simulation-year').fill('5001');await page.getByTestId('simulation-apply').click();await expect(page.getByTestId('simulation-timeline').getByRole('alert')).toContainText(en.simInvalid);await expect(scene(page)).toHaveAttribute('data-model-epoch',valid!);await expect(page.getByTestId('simulation-clock')).toContainText('2500 /');await page.getByTestId('simulation-exit').click();await expect(scene(page)).toHaveAttribute('data-model-epoch',preciseEpoch!);
  await page.route('**/api/v1/long-term-model',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'source_unavailable',message_key:'source_unavailable',details:{},request_id:'qa-source-failure'})}));
  await page.reload();await page.getByTestId('language').selectOption('en');await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-14T00:00:00/);const original=await scene(page).getAttribute('data-model-epoch');await selectMode(page,'simulation');await expect(page.getByTestId('simulation-timeline').getByRole('alert')).toContainText(en.simLoadError);await expect(page.getByTestId('simulation-play')).toBeDisabled();await expect(page.getByTestId('simulation-apply')).toBeDisabled();await expect(scene(page).locator('[data-testid^="object-label-"]')).toHaveCount(0);
  await page.getByTestId('simulation-exit').click();await expect(scene(page)).toHaveAttribute('data-model-epoch',original!);await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');expect(errors).toEqual([]);
});

test('a supported moon with a pending parent response is loading rather than unsupported and receives its actual ephemeris when ready',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
  const parentRequest=page.waitForRequest(request=>request.url().endsWith('/api/v1/catalog/solar-system?parent_id=saturn'));
  await page.route(/\/api\/v1\/catalog\/solar-system\?parent_id=saturn$/,async route=>{await held;await route.continue();});
  try {
    await page.goto('/');await page.getByTestId('language').selectOption('en');await choose(page,'moon-654');await parentRequest;
    const panel=page.getByTestId('object-panel');
    await expect(page.getByTestId('selected-object-name')).toHaveText('Gridr');
    await expect(panel).toContainText(en.timelineLoading);await expect(panel).not.toContainText(en.extendedUnavailable);
    await expect(page.getByTestId('object-label-moon-654')).toHaveCount(0);
    await page.screenshot({path:'../var/qa/dev008-supported-moon-loading.png'});
    release();
    await expect(page.getByTestId('object-label-moon-654')).toHaveCount(1);
    await expect(panel.locator('small').first()).toHaveText(en.modelPosition);
    await expect(panel).not.toContainText(en.extendedUnavailable);
    await expect(panel).toContainText(en.heliocentricPosition);
    await page.screenshot({path:'../var/qa/dev008-supported-moon-ready.png'});
    expect(errors).toEqual([]);
  } finally {release();}
});
