import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';

async function actualEvidence(page:Page){
  const created=await page.request.post('/api/v1/comparison-jobs',{data:{observation_ids:['S01','S02']},timeout:20000});
  expect(created.status()).toBe(202);const job=await created.json();
  let resultId:string|null=null;
  await expect.poll(async()=>{
    const response=await page.request.get('/api/v1/jobs/'+job.job_id,{timeout:20000});expect(response.ok()).toBe(true);
    const state=await response.json();resultId=state.result_id??null;return state.state;
  },{timeout:60000}).toBe('succeeded');
  expect(resultId).toBeTruthy();
  const saved=await page.request.post('/api/v1/evidence',{data:{result_id:resultId,session:{object_id:'epsilon-indi-b',observation_ids:['S01','S02'],active_frame:'A',view_mode:'split',contrast:1,locale:'en'},judgment:'DEV-025 QA: real protected comparison; delayed delivery tests selection-state hydration only.'},timeout:20000});
  expect(saved.status()).toBe(201);const evidence=await saved.json();
  // The remote QA tunnel can reset a reused keep-alive socket. Retry only
  // this idempotent GET, then require the exact same saved envelope bytes.
  const exported=await page.request.get('/api/v1/evidence/'+evidence.evidence_id+'/export',{timeout:60000,maxRetries:1});expect(exported.ok()).toBe(true);
  const bytes=await exported.body();await exported.dispose();
  expect(JSON.parse(bytes.toString()).evidence_id).toBe(evidence.evidence_id);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(createHash('sha256').update(await saved.body()).digest('hex'));
  // Capture a real successful server import before delaying its delivery to
  // the browser. No comparison, judgment or restore response is fabricated.
  const restored=await page.request.post('/api/v1/evidence/import',{data:bytes,headers:{'Content-Type':'application/json'},timeout:20000});
  expect(restored.ok()).toBe(true);const body=await restored.body(),status=restored.status();
  expect(JSON.parse(body.toString()).status).toBe('restored');await restored.dispose();
  return {bytes,body,status,evidenceId:evidence.evidence_id,resultId:resultId!};
}

for(const entry of ['local','global'] as const)test(`DEV-025: source default hydration cannot discard a pending ${entry} real-evidence import`,async({page})=>{
  test.setTimeout(150000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  const evidence=await actualEvidence(page);
  // Same GET-only keep-alive reset policy as the exact evidence export above;
  // a source error status or a changed listing still fails the assertions.
  const listingResponse=await page.request.get('/api/v1/observations?object_id=barnards-star',{timeout:20000,maxRetries:1});expect(listingResponse.ok()).toBe(true);
  const listingBody=await listingResponse.body();await listingResponse.dispose();
  let releaseListing!:()=>void,releaseImport!:()=>void,listingRequested=false,importRequested=false;
  const listingGate=new Promise<void>(resolve=>releaseListing=resolve),importGate=new Promise<void>(resolve=>releaseImport=resolve);
  const listingRoute=(url:URL)=>url.pathname==='/api/v1/observations'&&url.searchParams.get('object_id')==='barnards-star';
  await page.route(listingRoute,async route=>{listingRequested=true;await listingGate;await route.fulfill({status:200,contentType:'application/json',body:listingBody});});
  await page.route('**/api/v1/evidence/import',async route=>{importRequested=true;await importGate;await route.fulfill({status:evidence.status,contentType:'application/json',body:evidence.body});});
  try{
    await page.locator('#universe-search').fill('barnards-star');await page.getByTestId('search-barnards-star').click();
    await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');await expect(panel).toBeVisible();
    await expect.poll(()=>listingRequested).toBe(true);
    const input=entry==='local'?panel.getByTestId('import-file'):page.getByTestId('global-import-file');
    await input.setInputFiles({name:'actual-protected-evidence.json',mimeType:'application/json',buffer:evidence.bytes});
    await expect.poll(()=>importRequested).toBe(true);
    releaseListing();
    const selectors=panel.locator('select').filter({has:page.locator('option[value="L002"]')});
    await expect(selectors).toHaveCount(2);await expect(selectors.nth(0)).toHaveValue('L002');await expect(selectors.nth(1)).toHaveValue('L006');
    // This source-only fill formerly changed the import guard's revision.
    releaseImport();
    await expect(page.getByTestId('result-id')).toHaveText(evidence.resultId,{timeout:60000});
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','epsilon-indi-b');
    await panel.getByRole('button',{name:'Evidence',exact:true}).click();
    await expect(page.getByTestId('evidence-id')).toHaveText(evidence.evidenceId);
    await expect(panel.locator('#assessment')).toHaveValue(/real protected comparison/);
  }finally{
    releaseListing();releaseImport();await page.unroute(listingRoute);await page.unroute('**/api/v1/evidence/import');
  }
});
