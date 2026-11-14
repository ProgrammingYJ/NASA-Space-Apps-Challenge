import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const words=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
const scene=(page:Page)=>page.getByTestId('universe-scene');
async function date(page:Page,value:string,method:'enter'|'blur'='enter'){const input=page.locator('#model-epoch');await input.fill(value);await input.press(method==='enter'?'Enter':'Tab');}
async function source(page:Page,value:'ephemeris'|'simulation'){await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source',value);}
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();await expect(scene(page)).toHaveAttribute('data-selected-object',id);}
async function manual(page:Page,value:string){const details=page.getByTestId('time-source-details');if(await details.getAttribute('open')===null)await details.locator('summary').click();await page.getByTestId('time-mode').selectOption(value);}

test('one automatic calendar supports every 2026 date, zero and signed years while selecting only a supported source',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('model-time-range')).toHaveAttribute('min',/^-/);
  await source(page,'ephemeris');await choose(page,'earth');await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
  const cameraOffset=async()=>{const eye=(await scene(page).getAttribute('data-camera-position'))!.split(',').map(Number),target=(await scene(page).getAttribute('data-camera-target'))!.split(',').map(Number);return eye.map((value,i)=>value-target[i]);};const offset=await cameraOffset();
  for(const [text,expected] of [['2026-01-01T00:00','simulation'],['2026-12-31T23:59','simulation'],['0000-01-01T00:00','simulation'],['0099-01-01T00:00','simulation'],['2500-01-01T00:00','simulation'],['-2999-01-01T00:00','simulation'],['2026-11-13T00:00','ephemeris'],['2026-11-16T00:00','ephemeris']] as const){
    await date(page,text);await source(page,expected);await expect(scene(page)).toHaveAttribute('data-selected-object','earth');
    const year=Number(/^(-?\d+)-/.exec(text)![1]);await expect.poll(async()=>new Date((await scene(page).getAttribute('data-model-epoch'))!).getUTCFullYear()).toBe(year);
    await expect(page.getByTestId('selected-object-name')).toHaveText(words('en').body_earth);
    await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');for(const [i,value] of (await cameraOffset()).entries())expect(value).toBeCloseTo(offset[i],3);
    if(expected==='simulation'){await expect(scene(page).locator('[data-testid^="object-label-"]:not([data-position-kind="catalog_direction_distance_estimate"])')).toHaveCount(9);await expect(page.getByTestId('position-reference')).toContainText(words('en').simEmB);}
  }
  await date(page,'3000-01-02T00:00');await expect(page.getByTestId('unified-timeline').getByRole('alert')).toContainText(words('en').autoTimeInvalid);await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-16T00:00:00/);
  await date(page,'2026-02-29T00:00','blur');await expect(page.locator('#model-epoch')).toHaveAttribute('aria-invalid','true');await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-16T00:00:00/);
  await date(page,'2500-01-01T00:00');await source(page,'simulation');await manual(page,'ephemeris');await expect(page.getByTestId('unified-timeline')).toHaveCount(0);await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-16T00:00:00/);
  await page.screenshot({path:'../var/qa/dev009-unified-calendar.png'});expect(errors).toEqual([]);
});

test('automatic playback crosses the acquired UTC boundary, pauses at the supported endpoint and does not catch up hidden time',async({page})=>{
  await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('model-time-range')).toHaveAttribute('min',/^-/);await date(page,'2026-11-15T23:59');await page.getByTestId('timeline-rate').selectOption('72');await page.getByTestId('timeline-play-toggle').click();
  await source(page,'simulation');await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','true');await page.getByTestId('timeline-play-toggle').click();
  await date(page,'2999-12-31T00:00');await page.getByTestId('timeline-rate').selectOption('876600');await page.getByTestId('timeline-play-toggle').click();await expect(scene(page)).toHaveAttribute('data-model-epoch',/3000-01-01T00:00:00/);await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
  await date(page,'2026-11-14T00:00');await page.getByTestId('timeline-rate').selectOption('6');await page.getByTestId('timeline-play-toggle').click();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');const stopped=await scene(page).getAttribute('data-model-epoch');
  await page.evaluate(()=>{delete (document as unknown as Record<string,unknown>).hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(150);await expect(scene(page)).toHaveAttribute('data-model-epoch',stopped!);
});

test('the visible upper-right gear opens settings in all views and explains hidden Kuiper layers in five languages',async({page})=>{
  test.setTimeout(90000);await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('model-time-range')).toHaveAttribute('min',/^-/);const button=page.getByTestId('settings-toggle');await expect(button).toBeVisible();await expect(button.locator('svg')).toHaveCount(1);
  const box=(await button.boundingBox())!;expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);expect(box.x+box.width).toBeGreaterThan(1300);expect(box.y).toBeLessThan(70);
  const overlap=await page.locator('header button,header select').evaluateAll(nodes=>{const gear=document.querySelector('[data-testid="settings-toggle"]')!.getBoundingClientRect();return nodes.filter(node=>node.getAttribute('data-testid')!=='settings-toggle').filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left<gear.right&&r.right>gear.left&&r.top<gear.bottom&&r.bottom>gear.top;}).map(node=>node.textContent);});expect(overlap).toEqual([]);
  await date(page,'2026-01-01T00:00');await button.click();await expect(page.getByTestId('kuiper-unavailable-reason')).toContainText(words('en').kuiperApproxHidden);await expect(page.getByTestId('kuiper-toggle')).toBeChecked();await button.click();
  for(const open of ['open-exoplanet-catalog','open-universe-catalog','open-big-bang']){await page.getByTestId(open).click();await expect(button).toBeVisible();await button.click();await expect(page.getByTestId('layers-main-view-only')).toContainText(words('en').layersMainViewOnly);await button.click();}
  for(const locale of ['ko','en','ja','zh-Hant','fr']){await page.getByTestId('language').selectOption(locale);await button.click();await expect(page.locator('#universe-settings').getByRole('heading')).toHaveText(words(locale).settings);await expect(page.getByTestId('layers-main-view-only')).toContainText(words(locale).layersMainViewOnly);await button.click();}
  await page.screenshot({path:'../var/qa/dev009-gear-all-views.png'});
  await page.setViewportSize({width:820,height:780});await expect(button).toBeVisible();const narrowOverlap=await page.locator('header button,header select').evaluateAll(nodes=>{const gear=document.querySelector('[data-testid="settings-toggle"]')!.getBoundingClientRect();return nodes.filter(node=>node.getAttribute('data-testid')!=='settings-toggle').filter(node=>{const r=node.getBoundingClientRect();return r.width>0&&r.height>0&&r.left<gear.right&&r.right>gear.left&&r.top<gear.bottom&&r.bottom>gear.top;}).map(node=>node.textContent);});expect(narrowOverlap).toEqual([]);await page.screenshot({path:'../var/qa/dev010-gear-narrow-fixed.png'});
});
