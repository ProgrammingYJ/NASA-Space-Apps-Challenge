import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';

const scene=(page:Page)=>page.getByTestId('universe-scene');
const play=(page:Page)=>page.getByTestId('timeline-play-toggle');
const modelTime=async(page:Page)=>Date.parse((await scene(page).getAttribute('data-model-epoch'))!);
const camera=async(page:Page,key='position')=>(await scene(page).getAttribute(`data-camera-${key}`))!.split(',').map(Number);
const position=async(page:Page,id:string)=>(await page.getByTestId(`object-label-${id}`).getAttribute('data-source-position-au'))!;

async function start(page:Page){
  await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  await expect(page.getByTestId('model-time-range')).toBeVisible();
  await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-14T00:00:00/);
}
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId(`search-${id}`).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}
async function advance(page:Page,before:number,hours=1){
  await expect.poll(()=>modelTime(page)).toBeGreaterThan(before+hours*3600*1000);
}
async function settleManualCamera(page:Page){
  let previous='',unchanged=0;const started=Date.now();
  await expect.poll(async()=>{
    const current=`${await scene(page).getAttribute('data-camera-position')}|${await scene(page).getAttribute('data-camera-target')}`;
    unchanged=current===previous?unchanged+1:0;previous=current;
    return Date.now()-started>=700?unchanged:0;
  },{timeout:8000,intervals:[100]}).toBeGreaterThanOrEqual(3);
}

test('continuous playback moves sourced planets, preserves follow offset, and respects the manual camera',async({page})=>{
  await start(page);await choose(page,'mercury');
  await expect(scene(page)).toHaveAttribute('data-follow-object','mercury');
  const beforeTime=await modelTime(page);const beforePosition=await position(page,'mercury');
  const eye=await camera(page);const target=await camera(page,'target');const offset=eye.map((v,i)=>v-target[i]);
  await page.getByTestId('timeline-rate').selectOption('24');await play(page).click();
  await expect(play(page)).toHaveAttribute('aria-pressed','true');await advance(page,beforeTime,3);await play(page).click();
  await expect(play(page)).toHaveAttribute('aria-pressed','false');expect(await position(page,'mercury')).not.toBe(beforePosition);
  const afterEye=await camera(page);const afterTarget=await camera(page,'target');
  for(let axis=0;axis<3;axis++)expect(afterEye[axis]-afterTarget[axis]).toBeCloseTo(offset[axis],3);
  const paused=await modelTime(page);await page.waitForTimeout(200);expect(await modelTime(page)).toBe(paused);
  const bounds=(await page.getByTestId('universe-canvas').boundingBox())!;
  const x=bounds.x+bounds.width*.5,y=bounds.y+bounds.height*.6;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+110,y+40,{steps:8});await page.mouse.up();
  await expect(scene(page)).toHaveAttribute('data-camera-mode','manual');await expect(scene(page)).toHaveAttribute('data-follow-object','');
  // Damping advances by rendered frames; a fixed wall-clock sleep does not
  // establish that it has settled during concurrent GPU/CPU test load.
  await settleManualCamera(page);const manual=await camera(page);const manualTarget=await camera(page,'target');
  const manualTime=await modelTime(page);await play(page).click();await advance(page,manualTime,3);await play(page).click();
  await expect(scene(page)).toHaveAttribute('data-camera-mode','manual');
  for(let axis=0;axis<3;axis++){expect((await camera(page))[axis]).toBeCloseTo(manual[axis],3);expect((await camera(page,'target'))[axis]).toBeCloseTo(manualTarget[axis],3);}
  await page.screenshot({path:'../var/browser-results/timeline-manual-camera.png'});
});

test('the bounded clock pauses at the end and an explicit replay restarts at the beginning',async({page})=>{
  await start(page);await page.getByTestId('time-source-details').locator('summary').click();await page.getByTestId('time-mode').selectOption('ephemeris');await page.getByTestId('timeline-rate').selectOption('24');
  await page.locator('#model-epoch').fill('2026-11-15T23:59');await page.locator('#model-epoch').press('Tab');
  await expect.poll(()=>modelTime(page)).toBe(Date.parse('2026-11-15T23:59:00Z'));
  await play(page).click();await expect.poll(()=>modelTime(page)).toBe(Date.parse('2026-11-16T00:00:00Z'));
  await expect(play(page)).toHaveAttribute('aria-pressed','false');await page.waitForTimeout(150);
  expect(await modelTime(page)).toBe(Date.parse('2026-11-16T00:00:00Z'));
  await page.getByTestId('timeline-rate').selectOption('1');await play(page).click();
  await expect(play(page)).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>modelTime(page)).toBeLessThan(Date.parse('2026-11-13T02:00:00Z'));
  await play(page).click();
});

test('a browser visibilitychange pauses playback and never catches up hidden time',async({page})=>{
  await start(page);await play(page).click();await expect(play(page)).toHaveAttribute('aria-pressed','true');
  const initial=await modelTime(page);await advance(page,initial,.1);
  // Headless Chrome keeps every tab visible. Exercise the real visibilitychange
  // listener in Chrome with an explicit hidden document state, without pretending
  // this is a physical foreground/background tab transition.
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(play(page)).toHaveAttribute('aria-pressed','false');const stopped=await modelTime(page);
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    delete (document as unknown as Record<string,unknown>).hidden;
    delete (document as unknown as Record<string,unknown>).visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(play(page)).toHaveAttribute('aria-pressed','false');await page.waitForTimeout(150);expect(await modelTime(page)).toBe(stopped);
});

test('saving during playback freezes a real-observation snapshot and a fresh session restores it paused',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await start(page);await choose(page,'epsilon-indi-b');await page.getByTestId('open-object-observations').click();
  const panel=page.getByTestId('observation-panel');await panel.getByRole('button',{name:'Open comparison',exact:true}).click();
  await expect(page.getByTestId('result-id')).toBeVisible();const resultId=await page.getByTestId('result-id').innerText();
  await expect(page.getByTestId('frame-A')).toContainText('2025-04-30T02:06:28.716');await expect(page.getByTestId('frame-B')).toContainText('2026-09-23T17:21:46.185');
  const quality=await panel.getByRole('table').innerText();const original=await (await page.request.get(`/api/v1/comparisons/${resultId}/manifest`)).json();
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();const judgment='Playback is a calculated scene. These real frames and their quality are unchanged.';
  await panel.locator('#assessment').fill(judgment);await page.getByTestId('timeline-rate').selectOption('24');
  const before=await modelTime(page);await play(page).click();await advance(page,before,2);
  await panel.getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  await expect(play(page)).toHaveAttribute('aria-pressed','false');const snapshotTime=await modelTime(page);
  const downloaded=page.waitForEvent('download');await panel.getByRole('button',{name:'Export JSON',exact:true}).click();
  const bytes=await fs.readFile((await (await downloaded).path())!);const evidence=JSON.parse(bytes.toString());const context=evidence.session.universe_context;
  expect(Date.parse(context.model_epoch)).toBe(snapshotTime);expect(context.timeline_algorithm_version).toBe('display-hermite-v1');
  expect(context.playback_rate_hours_per_second).toBe(24);expect(context.playback_paused).toBe(true);expect(context.follow_object_id).toBe('epsilon-indi-b');
  expect(evidence.comparison).toEqual(original);expect(evidence.judgment).toBe(judgment);
  await panel.getByRole('button',{name:'Quality',exact:true}).click();expect(await panel.getByRole('table').innerText()).toBe(quality);
  await expect(page.getByTestId('result-id')).toHaveText(resultId);await page.screenshot({path:'../var/browser-results/timeline-observation-snapshot.png',fullPage:true});
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});const restored=await fresh.newPage();await restored.goto('/');
  await restored.getByTestId('global-import-file').setInputFiles({name:'timeline-evidence.json',mimeType:'application/json',buffer:bytes});
  await expect(restored.getByTestId('result-id')).toHaveText(resultId);await expect(play(restored)).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>modelTime(restored)).toBe(snapshotTime);await expect(restored.getByTestId('timeline-rate')).toHaveValue('24');
  await expect(scene(restored)).toHaveAttribute('data-camera-mode','restored');await expect(scene(restored)).toHaveAttribute('data-follow-object','epsilon-indi-b');
  const eye=await camera(restored);for(let axis=0;axis<3;axis++)expect(eye[axis]).toBeCloseTo(context.camera.position[axis],4);
  await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();
  await expect(restored.locator('#assessment')).toHaveValue(judgment);await page.waitForTimeout(250);expect(await modelTime(restored)).toBe(snapshotTime);
  expect(errors).toEqual([]);await fresh.close();
});
