import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const en=JSON.parse(readFileSync(new URL('../src/locales/en.json',import.meta.url),'utf8')) as Record<string,string>;

const scene=(page:Page)=>page.getByTestId('universe-scene');
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId(`search-${id}`).click();await expect(scene(page)).toHaveAttribute('data-selected-object',id);}
async function simulation(page:Page){await page.getByTestId('time-mode').selectOption('simulation');await expect(page.getByTestId('simulation-timeline')).toBeVisible();await expect(page.getByTestId('simulation-play')).toBeEnabled();}
async function applyYear(page:Page,year:number){await page.getByTestId('simulation-year').fill(String(year));await page.getByTestId('simulation-apply').click();await expect.poll(async()=>new Date((await scene(page).getAttribute('data-model-epoch'))!).getUTCFullYear()).toBe(year);}

test('all five locales update child moons and selected names while canonical IDs and designations remain searchable',async({page})=>{
  test.setTimeout(90000);await page.goto('/');
  const local:[string,string,string,string][]=[['ko','엔켈라두스','그리드르','토성 위성'],['en','Enceladus','Gridr',''],['ja','エンケラドス','グリーズ','土星の衛星'],['zh-Hant','土衛二','土衛五十四','土星衛星'],['fr','Encelade','Gridr','satellite de Saturne']];
  for(const [locale,enceladus,gridr,context] of local){
    await page.getByTestId('language').selectOption(locale);await choose(page,'saturn');
    const list=page.getByTestId('object-panel').locator('details').filter({has:page.getByTestId('select-moon-602')});
    await expect(list).toHaveCount(1);if((await list.getAttribute('open'))===null)await list.locator('summary').click();
    await expect(page.getByTestId('select-moon-602')).toContainText(enceladus);
    await expect(page.getByTestId('select-moon-654')).toContainText(gridr);
    await expect(page.getByTestId('select-moon-658')).toContainText(`S/2004 S26${context?` · ${context}`:''}`);
    await page.getByTestId('select-moon-654').click();await expect(scene(page)).toHaveAttribute('data-selected-object','moon-654');await expect(page.getByTestId('selected-object-name')).toHaveText(gridr);
    for(const query of ['Enceladus','엔켈라두스','エンケラドス','土衛二','Encelade']){await page.locator('#universe-search').fill(query);await expect(page.getByTestId('search-moon-602')).toContainText(enceladus);}
    await page.locator('#universe-search').fill('S/2004 S26');await expect(page.getByTestId('search-moon-658')).toContainText('S/2004 S26');await page.getByTestId('search-moon-658').click();await expect(scene(page)).toHaveAttribute('data-selected-object','moon-658');await expect(page.getByTestId('selected-object-name')).toHaveText(`S/2004 S26${context?` · ${context}`:''}`);
  }
});

test('the persistent Big Bang entry opens only actual cases and long-term simulation has bounded historical dates and nine supported bodies',async({page})=>{
  test.setTimeout(90000);await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('open-big-bang')).toBeVisible();
  await page.getByTestId('open-big-bang').click();await expect(page.getByTestId('cosmic-observation-viewer')).toBeVisible();await expect(page.getByTestId('cosmic-observation-case-cosmic_gems_clusters')).toBeVisible();
  await expect(page.getByTestId('cosmic-observation-viewer').locator('[data-testid^="cosmic-observation-case-"]')).toHaveCount(5);await expect(page.getByTestId('history-canvas')).toHaveCount(0);await page.getByTestId('cosmic-observation-exit').click();
  await choose(page,'saturn');await expect(page.getByTestId('object-label-moon-606')).toHaveCount(1);await simulation(page);
  await expect(scene(page).locator('[data-testid^="object-label-"]')).toHaveCount(9);await expect(page.getByTestId('object-label-pluto')).toHaveCount(0);await expect(page.getByTestId('object-label-moon-606')).toHaveCount(0);
  await choose(page,'earth');await expect(page.getByTestId('selected-object-name')).toHaveText(en.simEmB);await expect(page.getByTestId('object-label-earth')).toHaveAttribute('data-position-kind','approximate_simulation');
  for(const year of [-2999,0,99,2500]){await applyYear(page,year);await expect(page.getByTestId('simulation-clock')).toContainText(`${year} /`);await expect(scene(page).locator('[data-testid^="object-label-"]')).toHaveCount(9);}
  const before=await page.getByTestId('object-label-earth').getAttribute('data-source-position-au');await page.getByTestId('simulation-rate').selectOption('876600');await page.getByTestId('simulation-play').click();await expect(page.getByTestId('simulation-play')).toHaveAttribute('aria-pressed','true');await expect.poll(()=>page.getByTestId('object-label-earth').getAttribute('data-source-position-au')).not.toBe(before);
  await page.getByTestId('open-big-bang').click();await expect(page.getByTestId('cosmic-observation-viewer')).toBeVisible();await page.getByTestId('cosmic-observation-exit').click();await expect(page.getByTestId('simulation-play')).toHaveAttribute('aria-pressed','false');const stopped=await scene(page).getAttribute('data-model-epoch');await page.waitForTimeout(250);await expect(scene(page)).toHaveAttribute('data-model-epoch',stopped!);
  await page.screenshot({path:'../var/qa/dev008-simulation-history-roundtrip.png'});
});

test('invalid model dates preserve the last valid scene and missing simulation sources expose an error with precise-time recovery',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.locator('#model-epoch').fill('2026-11-15T00:00');await page.locator('#model-epoch').press('Tab');await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-15T00:00:00/);const preciseEpoch=await scene(page).getAttribute('data-model-epoch');
  await simulation(page);await applyYear(page,2500);const valid=await scene(page).getAttribute('data-model-epoch');await page.getByTestId('simulation-year').fill('5001');await page.getByTestId('simulation-apply').click();await expect(page.getByTestId('simulation-timeline').getByRole('alert')).toContainText(en.simInvalid);await expect(scene(page)).toHaveAttribute('data-model-epoch',valid!);await expect(page.getByTestId('simulation-clock')).toContainText('2500 /');await page.getByTestId('simulation-exit').click();await expect(scene(page)).toHaveAttribute('data-model-epoch',preciseEpoch!);
  await page.route('**/api/v1/long-term-model',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'source_unavailable',message_key:'source_unavailable',details:{},request_id:'qa-source-failure'})}));
  await page.reload();await page.getByTestId('language').selectOption('en');await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-14T00:00:00/);const original=await scene(page).getAttribute('data-model-epoch');await page.getByTestId('time-mode').selectOption('simulation');await expect(page.getByTestId('simulation-timeline').getByRole('alert')).toContainText(en.simLoadError);await expect(page.getByTestId('simulation-play')).toBeDisabled();await expect(page.getByTestId('simulation-apply')).toBeDisabled();
  await page.getByTestId('simulation-exit').click();await expect(scene(page)).toHaveAttribute('data-model-epoch',original!);await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');expect(errors).toEqual([]);
});
