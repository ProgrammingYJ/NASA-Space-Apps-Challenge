import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';

const historyScene=(page:Page)=>page.getByTestId('history-scene');
const age=async(page:Page)=>Number(await page.getByTestId('cosmic-age').getAttribute('data-age-gyr'));
const eye=async(page:Page)=>(await historyScene(page).getAttribute('data-camera-position'))!;
async function enter(page:Page){
  await page.getByTestId('time-mode').selectOption('cosmic-history');
  await expect(page.getByTestId('cosmic-history-panel')).toBeVisible();
  await expect(historyScene(page)).toHaveAttribute('data-scene-active','true');
  await expect(page.getByTestId('cosmic-age-input')).toBeEnabled();
}
async function begin(page:Page){await page.goto('/');await page.getByTestId('language').selectOption('en');await enter(page);}

test('the ten sourced display milestones keep age, lookback, uncertainty and five-language meanings aligned',async({page})=>{
  await begin(page);
  const milestones:[string,number][]=[['hot_big_bang',0],['recombination',.00038],['dark_ages',.01],['first_stars',.1],['early_galaxies',.28],['reionization',.5],['galaxy_growth',1],['cosmic_noon',2.5],['solar_system',9.2],['present',13.8]];
  for(const [id,value] of milestones){
    await page.getByTestId(`cosmic-milestone-${id}`).click();
    await expect(page.getByTestId('cosmic-stage')).toHaveAttribute('data-stage-id',id);
    await expect.poll(()=>age(page)).toBe(value);
    expect(Number(await page.getByTestId('cosmic-lookback').getAttribute('data-lookback-gyr'))).toBeCloseTo(13.8-value,8);
    await expect(page.getByTestId(`cosmic-milestone-${id}`)).toHaveAttribute('aria-pressed','true');
  }
  await page.getByTestId('cosmic-milestone-first_stars').click();
  const panel=page.getByTestId('cosmic-history-panel');
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const words=JSON.parse(await fs.readFile(`src/locales/${locale}.json`,'utf8'));
    await page.getByTestId('language').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang',locale);
    await expect(panel).toContainText(words.cosmicStage);
    await expect(panel).toContainText(words.history_description_first_stars);
    await expect(panel).toContainText(words.cosmicVisualNote);
    await expect(page.getByTestId('cosmic-timeline')).toContainText(words.cosmicApproxNote);
    await expect(historyScene(page)).toContainText(words.cosmicVisualNote);
    expect(await panel.innerText()).not.toMatch(/history_stage_|history_description_|cosmicApproxNote/);
  }
  await page.getByTestId('language').selectOption('en');
  await page.getByTestId('cosmic-age-input').fill('0.001');
  // This deliberately selects the latest educational milestone, not a new
  // claim that recombination remains the only physical era until 10 Myr.
  await expect(page.getByTestId('cosmic-stage')).toHaveAttribute('data-stage-id','recombination');
  await page.getByTestId('cosmic-milestone-early_galaxies').click();
  await expect(panel).toContainText("not the first galaxy's formation time");
  await page.screenshot({path:'../var/qa/cosmic-sourced-milestones.png'});
});

test('cosmic playback clamps and pauses, free camera persists, and hidden scene rendering stops',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await begin(page);await page.getByTestId('cosmic-rate').selectOption('1000');
  await page.getByTestId('cosmic-age-input').fill('13.79');
  await page.getByTestId('cosmic-play-toggle').click();
  await expect.poll(()=>age(page)).toBe(13.8);
  await expect(page.getByTestId('cosmic-play-toggle')).toHaveAttribute('aria-pressed','false');
  await page.getByTestId('cosmic-rate').selectOption('1');
  await page.getByTestId('cosmic-play-toggle').click();
  await expect(page.getByTestId('cosmic-play-toggle')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>age(page)).toBeGreaterThan(0);expect(await age(page)).toBeLessThan(.01);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.getByTestId('cosmic-play-toggle')).toHaveAttribute('aria-pressed','false');
  const stopped=await age(page);await page.waitForTimeout(150);
  await page.evaluate(()=>{delete (document as unknown as Record<string,unknown>).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  expect(await age(page)).toBe(stopped);
  await page.getByTestId('cosmic-milestone-solar_system').click();
  const before=await eye(page);const bounds=(await page.getByTestId('history-canvas').boundingBox())!;
  const x=bounds.x+bounds.width*.45,y=bounds.y+bounds.height*.48;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y+35,{steps:8});await page.mouse.up();
  await expect.poll(()=>eye(page)).not.toBe(before);
  await page.waitForTimeout(600);const rotated=await eye(page);
  await page.getByTestId('history-canvas').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(120);await page.keyboard.up('KeyW');
  await expect.poll(()=>eye(page)).not.toBe(rotated);await page.waitForTimeout(500);const manual=await eye(page);
  await page.screenshot({path:'../var/qa/cosmic-free-camera.png'});
  await page.getByTestId('cosmic-timeline').getByRole('button',{name:'2026 ephemeris time',exact:true}).click();
  await expect(historyScene(page)).toHaveAttribute('data-scene-active','false');
  await page.waitForTimeout(100);const frame=await historyScene(page).getAttribute('data-frame-count');await page.waitForTimeout(200);
  expect(await historyScene(page).getAttribute('data-frame-count')).toBe(frame);
  await enter(page);expect(await eye(page)).toBe(manual);expect(await age(page)).toBe(9.2);
  await expect(page.getByTestId('cosmic-play-toggle')).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});

test('switching through conceptual history preserves actual exposure dates, quality, result and assessment',async({page})=>{
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.locator('#universe-search').fill('epsilon-indi-b');await page.getByTestId('search-epsilon-indi-b').click();
  await page.getByTestId('open-object-observations').click();let panel=page.getByTestId('observation-panel');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();
  const result=await page.getByTestId('result-id').innerText();const quality=await panel.getByRole('table').innerText();
  const first=await page.getByTestId('frame-A').innerText(),second=await page.getByTestId('frame-B').innerText();
  const epoch=await page.getByTestId('universe-scene').getAttribute('data-model-epoch');
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();const judgment='Cosmic chronology is conceptual; these original exposures and quality remain unchanged.';await panel.locator('#assessment').fill(judgment);
  await enter(page);await page.getByTestId('cosmic-milestone-hot_big_bang').click();await page.getByTestId('cosmic-rate').selectOption('1000');await page.getByTestId('cosmic-play-toggle').click();
  await expect.poll(()=>age(page)).toBeGreaterThan(.05);
  await page.getByTestId('cosmic-timeline').getByRole('button',{name:'2026 ephemeris time',exact:true}).click();
  panel=page.getByTestId('observation-panel');await expect(page.getByTestId('result-id')).toHaveText(result);
  expect(await page.getByTestId('universe-scene').getAttribute('data-model-epoch')).toBe(epoch);
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();await expect(panel.locator('#assessment')).toHaveValue(judgment);
  await panel.getByRole('button',{name:'Quality',exact:true}).click();expect(await panel.getByRole('table').innerText()).toBe(quality);
  expect(await page.getByTestId('frame-A').innerText()).toBe(first);expect(await page.getByTestId('frame-B').innerText()).toBe(second);
  await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
  await page.screenshot({path:'../var/qa/cosmic-observation-preserved.png',fullPage:true});
});

test('a pending global import pauses both clocks and a new session closes old search results',async({page})=>{
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  for(const mode of ['ephemeris','cosmic-history']){
    if(mode==='cosmic-history')await enter(page);
    const toggle=page.getByTestId(mode==='ephemeris'?'timeline-play-toggle':'cosmic-play-toggle');
    await toggle.click();await expect(toggle).toHaveAttribute('aria-pressed','true');
    const clock=async()=>mode==='ephemeris'?await page.getByTestId('universe-scene').getAttribute('data-model-epoch'):String(await age(page));
    const running=await clock();await expect.poll(clock).not.toBe(running);
    let entered!:()=>void,release!:()=>void;
    const reached=new Promise<void>(resolve=>entered=resolve),gate=new Promise<void>(resolve=>release=resolve);
    // The transport is intentionally delayed with a rejected placeholder import;
    // actual source-backed restore is covered separately by the Pluto workflow.
    const handler=async(route:import('@playwright/test').Route)=>{entered();await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'recalculation_required',reasons:['delayed_test_placeholder']})});};
    await page.route('**/api/v1/evidence/import',handler);
    try{
      await page.getByTestId('global-import-file').setInputFiles({name:`pending-${mode}.json`,mimeType:'application/json',buffer:Buffer.from('{}')});
      await reached;await expect(toggle).toHaveAttribute('aria-pressed','false');const stopped=await clock();
      await page.waitForTimeout(180);expect(await clock()).toBe(stopped);
      const finished=page.waitForResponse(response=>response.url().endsWith('/api/v1/evidence/import'));release();await finished;
      const english=JSON.parse(await fs.readFile('src/locales/en.json','utf8'));await expect(page.getByRole('alert')).toContainText(english.restoreBlocked);
      if(mode==='cosmic-history'){
        await page.getByTestId('cosmic-timeline').getByRole('button',{name:'2026 ephemeris time',exact:true}).click();
        await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
      }
    }finally{release();await page.unroute('**/api/v1/evidence/import',handler);}
  }
  await page.locator('#universe-search').fill('pluto');await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('button',{name:'New session',exact:true}).click();await expect(page.locator('#universe-search')).toHaveValue('');
  await expect(page.getByRole('listbox')).toHaveCount(0);await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','');
  await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
});
