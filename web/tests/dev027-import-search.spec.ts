import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {Comparison,Session,UniverseContext} from '../src/types';
import type {PlanetNineEvidenceEnvelope,PlanetNinePreset,PlanetNinePrediction} from '../src/PlanetNineTypes';
import {workspaceNavigationCopy} from '../src/WorkspaceNavigationCopy';

// Genuine server jobs, source comparisons and signed exports only. Mutating
// requests are never retried. One retry is allowed for idempotent export GETs
// because the isolated SSH QA transport can reset a reused keep-alive socket.
const observationEpoch='2026-11-14T12:00:00.000Z';
const observationJudgment='DEV-027 R040 QA: the saved Pluto originals and assessment must be visibly restored by the global importer.';
const hypothesisJudgment='DEV-027 R040 QA: a restored literature hypothesis is conditional and is not an observed or discovered planet.';
const tnoSourceSha='6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1';
const scene=(page:Page)=>page.getByTestId('universe-scene');
const pathOf=(url:string)=>new URL(url).pathname;

async function ready(page:Page){
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  await expect(scene(page)).toBeVisible();
}

async function observationExport(page:Page){
  const created=await page.request.post('/api/v1/comparison-jobs',{data:{observation_ids:['S12','S14']},timeout:60000});
  expect(created.status()).toBe(202);const job=await created.json();let resultId:string|null=null;
  await expect.poll(async()=>{
    const response=await page.request.get('/api/v1/jobs/'+job.job_id,{timeout:30000,maxRetries:1});expect(response.ok()).toBe(true);
    const state=await response.json();resultId=state.result_id??null;return state.state;
  },{timeout:60000}).toBe('succeeded');
  expect(resultId).toBe('cmp_0d749ea3f9ec3a8da925dc44');
  const universeResponse=await page.request.get('/api/v1/universe?epoch='+encodeURIComponent(observationEpoch),{timeout:60000,maxRetries:1});expect(universeResponse.ok()).toBe(true);
  const universe=await universeResponse.json() as {epoch:string;source_manifest_sha256:string;orbit_manifest_sha256:string;timeline_algorithm_version:'display-hermite-v1'};
  expect(Date.parse(universe.epoch)).toBe(Date.parse(observationEpoch));
  expect(universe.source_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);expect(universe.orbit_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(universe.timeline_algorithm_version).toBe('display-hermite-v1');
  const universeContext:UniverseContext={selected_object_id:'pluto',model_epoch:observationEpoch,panel_open:true,source_manifest_sha256:universe.source_manifest_sha256,orbit_manifest_sha256:universe.orbit_manifest_sha256,timeline_algorithm_version:universe.timeline_algorithm_version,show_orbits:true,show_kuiper_belt:false,playback_paused:true,playback_rate_hours_per_second:6};
  const saved=await page.request.post('/api/v1/evidence',{data:{result_id:resultId,judgment:observationJudgment,session:{object_id:'pluto',observation_ids:['S12','S14'],active_frame:'B',view_mode:'split',contrast:1.7,locale:'en',universe_context:universeContext}},timeout:60000});
  expect(saved.status()).toBe(201);const value=await saved.json();
  const exported=await page.request.get(`/api/v1/evidence/${value.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(exported.ok()).toBe(true);
  const bytes=await exported.body(),record=JSON.parse(bytes.toString('utf8'));
  expect(record.evidence_id).toBe(value.evidence_id);expect(record.judgment).toBe(observationJudgment);
  expect(record.session.universe_context).toEqual(universeContext);
  expect(record.comparison.frames.map((frame:{observation_id:string})=>frame.observation_id)).toEqual(['S12','S14']);
  return {bytes,record,evidenceId:value.evidence_id as string,resultId:resultId!,comparison:record.comparison as Comparison};
}

async function hypothesisExport(page:Page){
  const rowResponse=await page.request.get('/api/v1/planet-nine/population/2413',{timeout:60000,maxRetries:1});expect(rowResponse.ok()).toBe(true);
  const row=await rowResponse.json() as PlanetNinePreset&{source_sha256:string};expect(row.row_index).toBe(2413);
  const predicted=await page.request.post('/api/v1/planet-nine/predict',{data:{orbit:row.orbit,start_jd_tdb:2461312.5,end_jd_tdb:2461315.5,samples:8,observer:'earth_moon_barycenter'},timeout:60000});
  expect(predicted.status()).toBe(200);const prediction=await predicted.json() as PlanetNinePrediction;expect(prediction.full_orbit_au).toHaveLength(257);
  const saved=await page.request.post('/api/v1/planet-nine/evidence',{data:{orbit:row.orbit,prediction,coverage:null,judgment:hypothesisJudgment,locale:'en',source:{preset_id:row.id,row_index:row.row_index,source_sha256:row.source_sha256}},timeout:60000});
  expect(saved.status()).toBe(201);const value=await saved.json() as PlanetNineEvidenceEnvelope;
  expect(value.kind).toBe('planet_nine_hypothesis_coverage');
  const exported=await page.request.get(`/api/v1/planet-nine/evidence/${value.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(exported.ok()).toBe(true);
  const bytes=await exported.body();expect(JSON.parse(bytes.toString('utf8'))).toEqual(value);
  return {bytes,record:value};
}

async function importThroughGlobal(page:Page,bytes:Buffer,endpoint:string){
  const complete=page.waitForResponse(response=>response.request().method()==='POST'&&pathOf(response.url())===endpoint,{timeout:60000});
  await page.getByTestId('global-import-file').setInputFiles({name:'genuine-evidence.json',mimeType:'application/json',buffer:bytes});
  const response=await complete;expect(response.status()).toBe(200);
  const restored=await response.json();expect(restored.status).toBe('restored');return restored;
}

async function showSearch(page:Page){
  if(await page.getByTestId('toggle-search-panel').getAttribute('aria-expanded')!=='true')await page.getByTestId('toggle-search-panel').click();
  await expect(page.getByTestId('exploration-search')).toBeVisible();
}

async function bareCanvasPoint(page:Page){
  return page.getByTestId('universe-canvas').evaluate(canvas=>{
    const bounds=canvas.getBoundingClientRect();
    for(const [x,y]of [[.65,.4],[.75,.6],[.5,.5],[.85,.3],[.6,.7]]){
      const point={x:bounds.x+bounds.width*x,y:bounds.y+bounds.height*y};
      if(document.elementFromPoint(point.x,point.y)===canvas)return point;
    }
    throw new Error('No unobstructed canvas point is available for the outside-click regression');
  });
}

test('DEV-027 R040: global JSON import visibly restores genuine Pluto observations, source dates, assessment and saved model time',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(180000);const source=await observationExport(page);
  const fresh=await browser.newContext({baseURL:baseURL!,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage();await ready(restored);
    await expect(restored.getByTestId('result-id')).toHaveCount(0);
    const result=await importThroughGlobal(restored,source.bytes,'/api/v1/evidence/import');
    expect(result.comparison.frames.map((frame:{provenance:{sha256:string}})=>frame.provenance.sha256)).toEqual(source.comparison.frames.map(frame=>frame.provenance.sha256));
    await expect(restored.getByTestId('global-import-status')).toBeVisible();
    await expect(scene(restored)).toHaveAttribute('data-selected-object','pluto');
    await expect(scene(restored)).toHaveAttribute('data-model-epoch',observationEpoch);
    await expect(restored.getByTestId('result-id')).toHaveText(source.resultId);
    const panel=restored.getByTestId('observation-panel');await expect(panel).toBeVisible();
    await panel.getByRole('button',{name:'Evidence',exact:true}).click();
    await expect(panel.locator('#assessment')).toHaveValue(observationJudgment);
    await expect(restored.getByTestId('evidence-id')).toHaveText(source.evidenceId);
    for(const [index,frame]of source.comparison.frames.entries())await expect(restored.getByTestId(index===0?'frame-A':'frame-B')).toContainText(frame.metadata.date_avg);
    const again=await restored.request.get(`/api/v1/evidence/${source.evidenceId}/export`,{timeout:60000,maxRetries:1});expect(again.ok()).toBe(true);
    expect(await again.body()).toEqual(source.bytes);
    await testInfo.attach('dev027-observation-global-restore.json',{body:JSON.stringify({evidence_id:source.evidenceId,result_id:source.resultId,source_dates:source.comparison.frames.map(frame=>frame.metadata.date_avg),source_sha256:source.comparison.frames.map(frame=>frame.provenance.sha256),export_sha256:createHash('sha256').update(source.bytes).digest('hex'),model_epoch:observationEpoch,original_bytes_preserved:true}),contentType:'application/json'});
  }finally{await fresh.close();}
});

test('DEV-027 R040: global JSON import routes genuine Planet Nine evidence to its hypothesis workspace without observation misdelivery',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(150000);const source=await hypothesisExport(page);
  const fresh=await browser.newContext({baseURL:baseURL!,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage(),imports:string[]=[],predictions:string[]=[];
    restored.on('request',request=>{if(request.method()!=='POST')return;const path=pathOf(request.url());if(path.endsWith('/evidence/import'))imports.push(path);if(path==='/api/v1/planet-nine/predict')predictions.push(path);});
    await ready(restored);const result=await importThroughGlobal(restored,source.bytes,'/api/v1/planet-nine/evidence/import');
    expect(result.evidence).toEqual(source.record);
    await expect(restored.getByTestId('global-import-status')).toBeVisible();
    await expect(restored.getByTestId('planet-nine-panel')).toBeVisible();
    await expect(restored.getByTestId('open-planet-nine')).toHaveAttribute('aria-pressed','true');
    await expect(restored.getByTestId('p9-preset')).toHaveValue(source.record.payload.source!.preset_id);
    // UI formatting is limited to 12 significant digits; the signed source
    // payload below must still remain byte-identical on re-export.
    for(const [key,value]of Object.entries(source.record.payload.orbit))expect(Number(await restored.getByTestId('p9-'+key).inputValue())).toBeCloseTo(value,9);
    await expect(restored.getByTestId('p9-judgment')).toHaveValue(hypothesisJudgment);
    await expect(restored.getByTestId('p9-evidence-id').locator('code')).toHaveText(source.record.evidence_id);
    await expect(restored.getByTestId('p9-active-hypothesis')).toHaveAttribute('data-source-row','2413');
    await expect(restored.getByTestId('p9-sky-path')).toBeVisible();await expect(scene(restored)).toHaveAttribute('data-hypothesis-orbit-points','257');
    expect(imports).toEqual(['/api/v1/planet-nine/evidence/import']);expect(predictions).toEqual([]);
    const exported=await restored.request.get(`/api/v1/planet-nine/evidence/${source.record.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(exported.ok()).toBe(true);
    expect(await exported.body()).toEqual(source.bytes);
    await testInfo.attach('dev027-hypothesis-global-restore.json',{body:JSON.stringify({evidence_id:source.record.evidence_id,source_row:2413,source_sha256:source.record.payload.source!.source_sha256,payload_sha256:source.record.payload_sha256,import_endpoints:imports,unexpected_predict_posts:predictions.length,original_bytes_preserved:true}),contentType:'application/json'});
  }finally{await fresh.close();}
});

test('DEV-027 R035/R040: observation evidence preserves its custom TOP 5 basis on the first P9 opening and visibly migrates an unversioned filter without changing either export',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(240000);const source=await observationExport(page);await ready(page);
  await importThroughGlobal(page,source.bytes,'/api/v1/evidence/import');
  await expect(page.getByTestId('result-id')).toHaveText(source.resultId);
  await expect(scene(page)).toHaveAttribute('data-selected-object','pluto');
  await expect(page.getByTestId('planet-nine-panel')).toHaveCount(0);
  await page.getByTestId('open-planet-nine').click();await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-0');
  // These are explicit user hypothesis inputs, never substituted for observed
  // elements. All four differ from the first preset to expose restore races.
  const custom={a_au:401.25,e:.235,i_deg:17.75,epoch_jd_tdb:2458271.25};
  for(const [key,value]of Object.entries(custom))await page.getByTestId('p9-'+key).fill(String(value));
  await expect(page.getByTestId('p9-preset')).toHaveValue('');
  const table=page.getByTestId('p9-orbit-analogue-table');await expect(table.locator('tbody tr')).toHaveCount(5);
  const originalIds=await table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-object-id')));
  await showSearch(page);await page.getByTestId('scene-filter').selectOption('planets-and-p9');
  await expect(page.getByTestId('top-five-display-basis')).toContainText('401.25');
  await page.locator('#universe-search').fill('pluto');await page.getByTestId('search-pluto').click();
  await expect(page.getByTestId('planet-nine-panel')).toBeVisible();
  await page.getByTestId('planet-nine-panel').getByRole('button',{name:'Return to exploration',exact:true}).click();
  await page.getByTestId('open-object-observations').click();
  const observation=page.getByTestId('observation-panel');await expect(page.getByTestId('result-id')).toHaveText(source.resultId);
  await observation.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='DEV-027 TOP 5 restore QA: custom comparison elements are a browsing hypothesis; preserve the original Pluto observations and their assessment.';
  await observation.locator('#assessment').fill(judgment);
  const savedResponse=page.waitForResponse(response=>response.request().method()==='POST'&&pathOf(response.url())==='/api/v1/evidence',{timeout:60000});
  await observation.getByRole('button',{name:'Save evidence',exact:true}).click();
  const saved=await savedResponse;expect(saved.status()).toBe(201);
  const record=await saved.json() as {evidence_id:string;session:Session;comparison:Comparison;judgment:string};
  const context=record.session.universe_context!;
  expect(context.scene_filter).toBe('planets-and-p9');expect(context.scene_filter_version).toBe('actual-analogue-top5-v1');
  expect(context.orbit_analogue_context).toEqual({algorithm_version:'tno-source-aei-exploratory-v1',hypothesis:custom,source_manifest_sha256:tnoSourceSha});
  expect(record.comparison).toEqual(source.comparison);expect(record.judgment).toBe(judgment);
  await expect(page.getByTestId('evidence-id')).toHaveText(record.evidence_id);
  const exported=await page.request.get(`/api/v1/evidence/${record.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(exported.ok()).toBe(true);
  const bytes=await exported.body();expect(JSON.parse(bytes.toString('utf8'))).toEqual(record);
  const fresh=await browser.newContext({baseURL:baseURL!,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage();await ready(restored);
    await expect(restored.getByTestId('planet-nine-panel')).toHaveCount(0);
    const result=await importThroughGlobal(restored,bytes,'/api/v1/evidence/import');
    expect(result.session.universe_context.orbit_analogue_context).toEqual(context.orbit_analogue_context);
    expect(result.comparison).toEqual(source.comparison);
    await expect(restored.getByTestId('global-import-status')).toHaveAttribute('data-state','observation');
    await expect(scene(restored)).toHaveAttribute('data-selected-object','pluto');await expect(scene(restored)).toHaveAttribute('data-model-epoch',observationEpoch);
    await expect(restored.getByTestId('result-id')).toHaveText(source.resultId);
    for(const [index,frame]of source.comparison.frames.entries())await expect(restored.getByTestId(index===0?'frame-A':'frame-B')).toContainText(frame.metadata.date_avg);
    await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();
    await expect(restored.locator('#assessment')).toHaveValue(judgment);
    await showSearch(restored);await expect(restored.getByTestId('scene-filter')).toHaveValue('planets-and-p9');
    await expect(restored.getByTestId('top-five-display-basis')).toContainText('401.25');
    await restored.getByTestId('open-planet-nine').click();
    for(const [key,value]of Object.entries(custom))await expect.poll(async()=>Number(await restored.getByTestId('p9-'+key).inputValue())).toBeCloseTo(value,9);
    await expect(restored.getByTestId('p9-preset')).toHaveValue('');
    await expect.poll(()=>restored.getByTestId('p9-orbit-analogue-table').locator('tbody tr').evaluateAll(rows=>rows.map(row=>row.getAttribute('data-object-id')))).toEqual(originalIds);
    await expect(scene(restored)).toHaveAttribute('data-model-epoch',observationEpoch);
    const again=await restored.request.get(`/api/v1/evidence/${record.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(again.ok()).toBe(true);expect(await again.body()).toEqual(bytes);
  }finally{await fresh.close();}

  // Create a valid legacy-format record through the real save endpoint. The
  // original comparison and previous exports are never edited or re-signed.
  const legacySession:Session={...source.record.session,universe_context:{...source.record.session.universe_context,scene_filter:'p9-reference'}};
  const legacySaved=await page.request.post('/api/v1/evidence',{data:{result_id:source.resultId,session:legacySession,judgment:observationJudgment},timeout:60000});expect(legacySaved.status()).toBe(201);
  const legacyRecord=await legacySaved.json();expect(legacyRecord.session.universe_context.scene_filter_version).toBeUndefined();
  const legacyExport=await page.request.get(`/api/v1/evidence/${legacyRecord.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(legacyExport.ok()).toBe(true);const legacyBytes=await legacyExport.body();
  const legacyFresh=await browser.newContext({baseURL:baseURL!,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await legacyFresh.newPage();await ready(restored);await importThroughGlobal(restored,legacyBytes,'/api/v1/evidence/import');
    await expect(restored.getByRole('alert')).toContainText(workspaceNavigationCopy('en').legacyFilter);
    await expect(restored.getByTestId('result-id')).toHaveText(source.resultId);
    await showSearch(restored);await expect(restored.getByTestId('scene-filter')).toHaveValue('all');
    const again=await restored.request.get(`/api/v1/evidence/${legacyRecord.evidence_id}/export`,{timeout:60000,maxRetries:1});expect(again.ok()).toBe(true);expect(await again.body()).toEqual(legacyBytes);
  }finally{await legacyFresh.close();}
  await testInfo.attach('dev027-observation-top-five-context-roundtrip.json',{body:JSON.stringify({evidence_id:record.evidence_id,comparison_id:source.resultId,hypothesis:custom,orbit_analogue_source_sha256:tnoSourceSha,actual_top_five_ids:originalIds,source_dates:source.comparison.frames.map(frame=>frame.metadata.date_avg),original_source_sha256:source.comparison.frames.map(frame=>frame.provenance.sha256),export_sha256:createHash('sha256').update(bytes).digest('hex'),legacy_evidence_id:legacyRecord.evidence_id,legacy_export_sha256:createHash('sha256').update(legacyBytes).digest('hex'),first_P9_open_preserved:true,original_envelopes_unchanged:true}),contentType:'application/json'});
});

test('DEV-027 R040: malformed JSON and the actual data-document manifest are visibly rejected without replacing the current scene',async({page},testInfo)=>{
  test.setTimeout(120000);await ready(page);
  await page.locator('#universe-search').fill('pluto');await page.getByTestId('search-pluto').click();await expect(scene(page)).toHaveAttribute('data-selected-object','pluto');
  const epoch=await scene(page).getAttribute('data-model-epoch');
  const manifest=await readFile(new URL('../../data/manifests/data_spec_pdf.json',import.meta.url));
  const fixtures=[{name:'broken.json',bytes:Buffer.from('{"not_finished":')},{name:'data_spec_pdf.json',bytes:manifest},{name:'unknown-kind.json',bytes:Buffer.from(JSON.stringify({kind:'not_a_registered_evidence',payload:{}}))}];
  for(const fixture of fixtures){
    const input=page.getByTestId('global-import-file');
    await input.setInputFiles({name:fixture.name,mimeType:'application/json',buffer:fixture.bytes});
    // App clears this input in the completed import's finally block. Waiting
    // avoids accidentally accepting the previous invalid-file notice.
    await expect(input).toHaveValue('');
    const status=page.getByTestId('global-import-status');await expect(status).toBeVisible();
    await expect(status).toContainText(/could not|invalid|exported|unsupported|not.*evidence|failed/i);
    await expect(scene(page)).toHaveAttribute('data-selected-object','pluto');await expect(scene(page)).toHaveAttribute('data-model-epoch',epoch!);
    await expect(page.getByTestId('result-id')).toHaveCount(0);await expect(page.getByTestId('p9-evidence-id')).toHaveCount(0);
  }
  await testInfo.attach('dev027-invalid-imports.json',{body:JSON.stringify({rejected_files:fixtures.map(value=>value.name),selection_preserved:'pluto',model_epoch:epoch}),contentType:'application/json'});
});

test('DEV-027 R037/R038: search closes on background, Escape and explicit back while camera drag locking leaves text fields usable',async({page},testInfo)=>{
  test.setTimeout(120000);await ready(page);const search=page.locator('#universe-search');
  const results=page.getByRole('listbox');
  await search.fill('neptune');await expect(results).toBeVisible();
  const outside=await bareCanvasPoint(page);await page.mouse.click(outside.x,outside.y);await expect(results).toHaveCount(0);
  await search.click();await expect(results).toBeVisible();await search.press('Escape');await expect(results).toHaveCount(0);
  await search.fill('eris');await expect(results).toBeVisible();
  await page.getByTestId('close-exploration-search').click();await expect(search).toHaveValue('');await expect(results).toHaveCount(0);
  await page.getByTestId('settings-toggle').click();await page.getByTestId('camera-drag-lock').check();
  await page.getByTestId('camera-drag-lock').press('Escape');
  const before=await scene(page).getAttribute('data-camera-position'),target=await scene(page).getAttribute('data-camera-target');
  const point=await bareCanvasPoint(page);await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+70,point.y+35,{steps:8});await page.mouse.up();
  await expect.poll(()=>scene(page).getAttribute('data-camera-position')).toBe(before);await expect(scene(page)).toHaveAttribute('data-camera-target',target!);
  await search.fill('saturn');await expect(search).toHaveValue('saturn');await expect(page.getByTestId('search-saturn')).toBeVisible();
  await testInfo.attach('dev027-search-and-drag-lock.json',{body:JSON.stringify({outside_click_closes:true,Escape_closes:true,explicit_back_clears_query:true,camera_position_preserved_when_locked:true,text_input_usable_when_locked:true}),contentType:'application/json'});
});
