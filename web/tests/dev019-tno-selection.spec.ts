import {test,expect,type Page} from '@playwright/test';
import * as THREE from 'three';
import {displayPosition} from '../src/sceneMath';
import {transNeptunianPosition} from '../src/TransNeptunianMath';
import {mkdirSync,writeFileSync} from 'node:fs';

test.afterEach(async({page},info)=>{
  mkdirSync('../var/qa/dev019',{recursive:true});
  const key=info.title.startsWith('all8341')?'catalogue':info.title.startsWith('a real')?'point-pick':'ancient-alias';
  await page.screenshot({path:`../var/qa/dev019/${key}.png`});
  const scene=page.getByTestId('universe-scene'),attributes=await scene.evaluate(element=>({...((element as HTMLElement).dataset)}));
  writeFileSync(`../var/qa/dev019/${key}.json`,JSON.stringify({test:info.title,status:info.status,expected_status:info.expectedStatus,checked_at:new Date().toISOString(),url:page.url(),scene:attributes,errors:info.errors.map(error=>error.message)},null,2));
});

async function ready(page:Page){await page.goto('/');await expect(page.getByTestId('open-tno-catalogue')).toBeEnabled();await expect.poll(async()=>Number(await page.getByTestId('universe-scene').getAttribute('data-outer-tno-rendered'))).toBeGreaterThan(8000);}
async function catalogueChoose(page:Page,query:string){await page.getByTestId('open-tno-catalogue').click();await page.getByTestId('tno-catalogue-search').fill(query);const row=page.getByTestId('tno-catalogue-list').locator('button').first();await expect(row).toBeVisible();await row.click();}

test('all8341 rows are paged and searched, including missing phase and native aliases',async({page})=>{
  await ready(page);await page.getByTestId('open-tno-catalogue').click();const list=page.getByTestId('tno-catalogue-list');
  await expect(page.getByTestId('tno-catalogue-count')).toContainText('8,341');await expect(list.locator('button')).toHaveCount(25);
  await page.getByTestId('tno-catalogue-page').selectOption('333');await expect(list.locator('button')).toHaveCount(16);
  await page.getByTestId('tno-catalogue-search').fill('2002 PD153');await expect(list.locator('button')).toHaveCount(1);await list.locator('button').click();
  const panel=page.getByTestId('outer-tno-panel');await expect(panel).toBeVisible();await expect(panel.getByTestId('selected-object-name')).toContainText('2002 PD153');await expect(panel.getByTestId('outer-tno-position-status')).toContainText('궤도 요소가 부족');await expect(panel.getByTestId('outer-tno-id')).toContainText('sbdb-');await expect(panel.getByTestId('outer-tno-source-facts').getByRole('link')).toHaveAttribute('href',/ssd\.jpl\.nasa\.gov/);
  await catalogueChoose(page,'Sedna');await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','sedna');await expect(page.getByTestId('object-panel')).toBeVisible();await expect(page.getByTestId('outer-tno-source-facts')).toBeVisible();
  await page.getByTestId('open-tno-catalogue').click();await expect(page.getByTestId('tno-catalogue-search')).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByTestId('tno-catalogue-browser')).not.toBeVisible();await expect(page.getByTestId('open-tno-catalogue')).toBeFocused();
});

test('a real projected dense point opens all overlapping identified choices',async({page})=>{
  await ready(page);const scene=page.getByTestId('universe-scene'),canvas=page.getByTestId('universe-canvas');
  await expect(scene).toHaveAttribute('data-decorative-kuiper-points','0');await expect.poll(async()=>Number(await scene.getAttribute('data-outer-tno-jd'))).toBeGreaterThan(2400000);
  const catalog=await (await page.request.get('/api/v1/catalog/outer-tno')).json();const box=(await canvas.boundingBox())!;
  const camera=new THREE.PerspectiveCamera(48,box.width/box.height,.025,6000);camera.position.fromArray((await scene.getAttribute('data-camera-position'))!.split(',').map(Number));camera.lookAt(new THREE.Vector3().fromArray((await scene.getAttribute('data-camera-target'))!.split(',').map(Number)));camera.updateMatrixWorld();
  const jd=Number(await scene.getAttribute('data-outer-tno-jd'));
  const points=catalog.objects.filter((row:{known_object_id:string|null;orbit:unknown})=>!row.known_object_id&&row.orbit).map((row:{object_id:string;orbit:Parameters<typeof transNeptunianPosition>[0]})=>{const position=transNeptunianPosition(row.orbit,jd);if(!position||Math.hypot(...position)>1000)return null;const p=new THREE.Vector3(...displayPosition(position)).project(camera);return {id:row.object_id,x:(p.x+1)*box.width/2,y:(1-p.y)*box.height/2,z:p.z};}).filter((p:{x:number;y:number;z:number}|null):p is {id:string;x:number;y:number;z:number}=>Boolean(p&&p.z>=-1&&p.z<=1&&p.x>450&&p.x<box.width-420&&p.y>150&&p.y<box.height-330));
  const hit=points.find((p:{x:number;y:number})=>points.filter((q:{x:number;y:number})=>Math.hypot(p.x-q.x,p.y-q.y)<8).length>1);expect(hit).toBeTruthy();
  await canvas.click({position:{x:hit.x,y:hit.y}});const chooser=page.getByTestId('tno-catalogue-browser');await expect(chooser).toBeVisible();await expect(chooser).toContainText('겹친');
  const option=chooser.getByTestId('tno-catalogue-list').locator('button').first(),id=(await option.getAttribute('data-testid'))!.replace('tno-row-','');await option.click();await expect(scene).toHaveAttribute('data-selected-object',id);await expect(page.getByTestId('outer-tno-id')).toContainText(id);
});

test('ancient TNO positions and native aliases remain selectable across cached date transitions',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await catalogueChoose(page,'Sedna');
  const scene=page.getByTestId('universe-scene');
  for(const date of ['-002521-01-01T00:00:00','2026-11-14T00:00:00','-002521-01-01T00:00:00']){
    await page.locator('#model-epoch').fill(date);await page.locator('#model-epoch').press('Enter');
    await expect(scene).toHaveAttribute('data-selected-object','sedna');await expect(scene).toHaveAttribute('data-camera-mode','focused');
    await expect.poll(async()=>Number(await scene.getAttribute('data-outer-tno-plotted'))).toBeGreaterThan(8000);
    if(date.startsWith('-')){await expect(page.getByTestId('outer-tno-time-notice')).toBeVisible();await expect(page.getByTestId('selected-position-description')).not.toContainText('지원하지');await expect(page.getByTestId('outer-tno-position-status')).toContainText('장기');}
    const jd=Number(await scene.getAttribute('data-outer-tno-jd')),catalog=await (await page.request.get('/api/v1/catalog/outer-tno')).json(),row=catalog.objects.find((r:{known_object_id:string|null})=>r.known_object_id==='sedna');
    if(date.startsWith('-')){const detail=await (await page.request.get(`/api/v1/catalog/outer-tno/object?object_id=${row.object_id}&jd_tdb=${jd}`)).json(),expected=displayPosition(detail.position_au);await expect.poll(async()=>{const target=(await scene.getAttribute('data-camera-target'))!.split(',').map(Number);return Math.hypot(...target.map((v,i)=>v-expected[i]));}).toBeLessThan(.05);}
    else {const expected=(await page.getByTestId('object-label-sedna').getAttribute('data-world-position'))!.split(',').map(Number);await expect.poll(async()=>{const target=(await scene.getAttribute('data-camera-target'))!.split(',').map(Number);return Math.hypot(...target.map((v,i)=>v-expected[i]));}).toBeLessThan(.05);}
  }
});
