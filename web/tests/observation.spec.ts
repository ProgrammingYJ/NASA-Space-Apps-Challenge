import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import type {Comparison,Observation,ObservationList} from '../src/types';
async function selectObject(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId(`search-${id}`).click();}
async function openLab(page:Page,id='epsilon-indi-b'){await selectObject(page,id);await page.getByTestId('open-object-observations').click();await expect(page.getByTestId('observation-panel')).toBeVisible();}
async function openAfterManifestBody(page:Page,click:()=>Promise<unknown>):Promise<Comparison>{
  // The SSH test transport can deliver response headers well before the real
  // 0.9 MB body. Bound that transport wait separately from DOM expectations.
  let timer:ReturnType<typeof setTimeout>|undefined;
  const complete=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(new URL(response.url()).pathname),{timeout:60000}).then(async response=>{expect(response.ok()).toBe(true);expect(await response.finished()).toBeNull();return await response.json() as Comparison;});
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual comparison manifest body did not complete within 60 seconds')),60000);});
  try{await click();return await Promise.race([complete,deadline]);}finally{if(timer)clearTimeout(timer);}
}

test('real ε Indi B originals → quality → evidence → fresh-context restore, five locales and other routes',async({page,browser})=>{
  // Five locales, imaging controls, two exports, fresh restore and four other routes share this workflow. Individual expectations retain their 15-second limit.
  test.setTimeout(180000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await openLab(page);const panel=page.getByTestId('observation-panel');
  await expect(panel.locator('option').filter({hasText:'S01 · 2025-04-30T02:06:28.716'})).toHaveCount(2);const original=await openAfterManifestBody(page,()=>panel.getByRole('button',{name:'관측 비교 열기',exact:true}).click());expect(original.frames.map(frame=>frame.observation_id)).toEqual(['S01','S02']);expect(original.frames.map(frame=>frame.quality.pixel_count)).toEqual([29,32]);
  await expect(page.getByTestId('frame-A')).toBeVisible();await expect(page.getByTestId('frame-B')).toBeVisible();await expect(page.getByTestId('frame-A')).toContainText('2025-04-30T02:06:28.716');await expect(page.getByTestId('frame-B')).toContainText('2026-09-23T17:21:46.185');await expect(panel.getByText('원본 픽셀 잘라보기 · 각각 중심 배치 · 영상 정합 없음')).toBeVisible();await expect(panel.getByRole('table')).toContainText('29');
  await panel.getByRole('combobox').filter({has:page.locator('option[value="B"]')}).selectOption('B');await expect(panel.getByRole('table')).toContainText('32');await panel.getByText('상세 조건과 출처',{exact:true}).click();await expect(panel.locator('aside')).toContainText('cal-swcs-v5-2026-191');await expect(panel.locator('aside')).toContainText('441');const resultId=await page.getByTestId('result-id').innerText();
  for(const locale of ['en','ja','zh-Hant','fr','ko']){await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.getByTestId('result-id')).toHaveText(resultId);await expect(panel.getByRole('table')).toContainText('32');}
  await panel.getByRole('button',{name:'깜빡임',exact:true}).click();await expect(panel.getByRole('button',{name:'깜빡임 시작',exact:true})).toBeVisible();await panel.getByRole('button',{name:'깜빡임 시작',exact:true}).click();await expect(panel.getByRole('button',{name:'깜빡임 정지',exact:true})).toBeVisible();await panel.getByRole('button',{name:'깜빡임 정지',exact:true}).click();await panel.getByRole('button',{name:'나란히 보기',exact:true}).click();
  await panel.getByRole('button',{name:'근거',exact:true}).click();const judgment='QA: 원본 품질을 확인했다. NF/T와 SOURCE는 천체 연관·운동 검증을 보장하지 않는다.';await panel.locator('#assessment').fill(judgment);await panel.getByRole('button',{name:'근거 저장',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  const id=await page.getByTestId('evidence-id').innerText();const jsonDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'JSON 내보내기',exact:true}).click();const json=await jsonDownload;const bytes=await fs.readFile((await json.path())!);const record=JSON.parse(bytes.toString());expect(record.result_id).toBe(resultId);expect(record.judgment).toBe(judgment);expect(record.comparison.frames[1].quality.pixel_count).toBe(32);expect(record.session.universe_context.selected_object_id).toBe('epsilon-indi-b');expect(record.session.universe_context.camera.representation_version).toBe('solar-display-v1');
  const csvDownload=page.waitForEvent('download');await panel.getByRole('button',{name:'CSV 내보내기',exact:true}).click();const csv=await csvDownload;expect((await fs.readFile((await csv.path())!,'utf8'))).toContain('S01');await page.screenshot({path:'../var/browser-results/workbench-evidence.png',fullPage:true});
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});const restored=await fresh.newPage();await restored.goto('/');await expect(restored.getByTestId('result-id')).toHaveCount(0);await restored.getByTestId('global-import-file').setInputFiles({name:'evidence.json',mimeType:'application/json',buffer:bytes});await expect(restored.getByTestId('result-id')).toHaveText(resultId);const restoredPanel=restored.getByTestId('observation-panel');await restoredPanel.getByRole('button',{name:'근거',exact:true}).click();await expect(restoredPanel.locator('#assessment')).toHaveValue(judgment);await expect(restored.getByTestId('evidence-id')).toHaveText(id);await expect(restored.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','restored');
  const restoredPosition=(await restored.getByTestId('universe-scene').getAttribute('data-camera-position'))!.split(',').map(Number);for(let axis=0;axis<3;axis++)expect(restoredPosition[axis]).toBeCloseTo(record.session.universe_context.camera.position[axis],4);
  // These four official routes now have registered native pairs. Compare the UI
  // with actual listing/job/manifest responses; do not carry over “no originals”.
  for(const objectId of ['barnards-star','wise0855','rw-aurigae','r-draconis']){
    const listingResponse=await restored.request.get(`/api/v1/observations?object_id=${objectId}`);expect(listingResponse.ok()).toBe(true);
    const listing=await listingResponse.json() as Omit<ObservationList,'observations'>&{observations:(Observation&{sha256:string;source_url:string})[]};
    expect(listing.object_id).toBe(objectId);expect(listing.default_pair).toHaveLength(2);expect(listing.available_pairs?.some(pair=>JSON.stringify(pair)===JSON.stringify(listing.default_pair))).toBe(true);
    await openLab(restored,objectId);await expect(restored.getByTestId('frame-A')).toHaveCount(0);
    const dates=restoredPanel.locator('select').filter({has:restored.locator(`option[value="${listing.default_pair![0]}"]`)});await expect(dates).toHaveCount(2);
    await dates.nth(0).selectOption(listing.default_pair![0]);await dates.nth(1).selectOption(listing.default_pair![1]);
    const created=restored.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/comparison-jobs');
    const rendered=await openAfterManifestBody(restored,()=>restoredPanel.getByRole('button',{name:'관측 비교 열기',exact:true}).click());const job=await (await created).json();expect(rendered.object_id).toBe(objectId);
    await expect(restored.getByTestId('result-id')).toBeVisible();const routeResult=await restored.getByTestId('result-id').innerText();
    const status=await restored.request.get(`/api/v1/jobs/${job.job_id}`);expect(status.ok()).toBe(true);expect(await status.json()).toMatchObject({state:'succeeded',result_id:routeResult,object_id:objectId});
    const manifest=await restored.request.get(`/api/v1/comparisons/${routeResult}/manifest`);expect(manifest.ok()).toBe(true);const comparison=await manifest.json() as Comparison;
    expect(comparison.object_id).toBe(objectId);expect(comparison.algorithm_version).toBe('spherex-registered-native-v1');expect(comparison.frames.map(frame=>frame.observation_id)).toEqual(listing.default_pair);
    for(const [index,frame] of comparison.frames.entries()){
      const original=listing.observations.find(value=>value.observation_id===frame.observation_id)!;expect(original).toBeTruthy();
      expect(frame.provenance.sha256).toBe(original.sha256);expect(frame.provenance.source_url).toBe(original.source_url);expect(frame.metadata.date_avg).toBe(original.date_avg);expect(frame.metadata.detector).toBe(original.detector);
      await expect(restored.getByTestId(index===0?'frame-A':'frame-B')).toContainText(frame.observation_id);await expect(restored.getByTestId(index===0?'frame-A':'frame-B')).toContainText(original.date_avg);
    }
    await expect(restoredPanel.getByTestId('registered-observation-disclosures')).toBeVisible();await expect(restoredPanel.getByTestId('observation-availability')).toHaveCount(0);
  }
  await openLab(restored);await expect(restored.getByTestId('result-id')).toHaveText(resultId);await expect(page.locator('body')).not.toContainText('undefined');expect(errors).toEqual([]);await fresh.close();
});

test('late save and import responses cannot repopulate a new universe session',async({page})=>{
  await page.goto('/');await openLab(page);const panel=page.getByTestId('observation-panel');await panel.getByRole('button',{name:'관측 비교 열기',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();await panel.getByRole('button',{name:'근거',exact:true}).click();await panel.locator('#assessment').fill('stale response guard');
  let saveReady!:()=>void;let releaseSave!:()=>void;const saveReached=new Promise<void>(resolve=>saveReady=resolve);const saveGate=new Promise<void>(resolve=>releaseSave=resolve);let evidenceId='';await page.route('**/api/v1/evidence',async route=>{const response=await route.fetch();evidenceId=(await response.json()).evidence_id;saveReady();await saveGate;await route.fulfill({response});});
  await panel.getByRole('button',{name:'근거 저장',exact:true}).click();await saveReached;await page.getByRole('button',{name:'새 세션',exact:true}).click();const saveFinished=page.waitForEvent('requestfinished',request=>request.url().endsWith('/api/v1/evidence'));releaseSave();await saveFinished;await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(page.getByTestId('result-id')).toHaveCount(0);await expect(page.getByTestId('evidence-id')).toHaveCount(0);
  const exported=await page.request.get(`/api/v1/evidence/${evidenceId}/export`);expect(exported.ok()).toBeTruthy();const bytes=await exported.body();let importReady!:()=>void;let releaseImport!:()=>void;const importReached=new Promise<void>(resolve=>importReady=resolve);const importGate=new Promise<void>(resolve=>releaseImport=resolve);await page.route('**/api/v1/evidence/import',async route=>{const response=await route.fetch();importReady();await importGate;await route.fulfill({response});});
  await page.getByTestId('global-import-file').setInputFiles({name:'evidence.json',mimeType:'application/json',buffer:bytes});await importReached;await page.getByRole('button',{name:'새 세션',exact:true}).click();const importFinished=page.waitForEvent('requestfinished',request=>request.url().endsWith('/api/v1/evidence/import'));releaseImport();await importFinished;await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(page.getByTestId('result-id')).toHaveCount(0);await expect(page.getByTestId('observation-panel')).toHaveCount(0);
});
