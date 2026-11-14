import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const scene=(page:Page)=>page.getByTestId('universe-scene');
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId(`search-${id}`).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
}
async function readyMap(page:Page,id:string){
  await choose(page,id);await expect(page.getByTestId(`object-label-${id}`)).toHaveAttribute('data-appearance-state','ready',{timeout:60000});
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}

test('every adopted texture URL serves the exact published original and ring geometry retains its sources',async({request})=>{
  test.setTimeout(120000);
  const raw=await fs.readFile('../data/manifests/appearance.json');const local=JSON.parse(raw.toString());
  const response=await request.get('/api/v1/appearance');expect(response.ok()).toBeTruthy();const actual=await response.json();
  expect(actual.source_manifest_sha256).toBe(createHash('sha256').update(raw).digest('hex'));expect(Object.keys(actual.objects)).toHaveLength(31);
  for(const [id,value] of Object.entries(actual.objects)){
    const record=value as {texture_url:string;sha256:string;bytes:number;credit:string;limitations:string[];body_orientation:{pole_icrs_deg:{ra:number;dec:number};rotation_phase_verified:boolean}};
    expect(record.texture_url).toMatch(/^\/textures\/[^/]+\.(?:jpg|png)$/);expect(record.credit).toBeTruthy();expect(record.limitations.length).toBeGreaterThan(0);
    expect(record.body_orientation.pole_icrs_deg).toEqual(local.objects[id].body_orientation.pole_icrs_deg);expect(record.body_orientation.rotation_phase_verified).toBe(false);
    const image=await request.get(record.texture_url);expect(image.status(),`${id}: ${record.texture_url}`).toBe(200);const bytes=await image.body();
    expect(bytes.length,id).toBe(record.bytes);expect(createHash('sha256').update(bytes).digest('hex'),id).toBe(record.sha256);await image.dispose();
  }
  expect(Object.keys(actual.rings).sort()).toEqual(['jupiter','neptune','saturn','uranus']);
  for(const ring of Object.values(actual.rings) as {units:string;source:{url:string};pole_source:{url:string};bands_km:{inner_km:number;outer_km:number}[]}[]){
    expect(ring.units).toBe('km');expect(ring.source.url).toMatch(/^https:\/\/(?:nssdc\.gsfc\.nasa\.gov|pds-rings\.seti\.org)\//);expect(ring.pole_source.url).toContain('naif.jpl.nasa.gov');
    for(const band of ring.bands_km){expect(band.inner_km).toBeGreaterThan(0);expect(band.outer_km).toBeGreaterThan(band.inner_km);}
  }
  expect(actual.rings.saturn.gaps_km.map((gap:{name:string})=>gap.name)).toEqual(expect.arrayContaining(['Cassini division','Encke gap','Keeler gap']));
});

test('actual maps and ring shaders load, five locales retain conditions, and unavailable moon positions stay absent',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  for(const id of ['earth','saturn','uranus','neptune','moon-606','moon-901','ceres','pluto']){
    await readyMap(page,id);await expect(page.getByTestId('appearance-info')).toContainText('Published map displayed');
    const position=(await page.getByTestId(`object-label-${id}`).getAttribute('data-source-position-au'))!;
    expect(position.split(',').map(Number).every(Number.isFinite)).toBe(true);
    if(['earth','saturn','moon-606','ceres'].includes(id))await page.screenshot({path:`../var/qa/appearance-${id}.png`});
  }
  await readyMap(page,'moon-606');
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const labels=JSON.parse(await fs.readFile(`src/locales/${locale}.json`,'utf8'));await page.getByTestId('language').selectOption(locale);
    await expect(page.locator('html')).toHaveAttribute('lang',locale);const info=page.getByTestId('appearance-info');
    await expect(info).toContainText(labels.appearance_observed_mosaic);await expect(info).toContainText(labels.appearanceState_ready);await expect(info).toContainText(labels.appearanceEpochNote);
    await expect(page.getByTestId('object-label-moon-606')).toHaveAttribute('data-appearance-kind','observed_mosaic');
  }
  await page.getByTestId('language').selectOption('en');await choose(page,'moon-635');
  await expect(page.getByTestId('selected-object-name')).toHaveText('Daphnis');
  await expect(page.getByTestId('object-panel')).toContainText('No verified ephemeris supports the current time range');
  await expect(page.getByTestId('object-label-moon-635')).toHaveCount(0);
  await expect(page.getByTestId('open-object-observations')).toBeDisabled();await expect(page.getByTestId('frame-A')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('new appearance and satellite source hashes preserve the actual Pluto evidence through a fresh session',async({page,browser})=>{
  test.setTimeout(120000);await page.goto('/');await page.getByTestId('language').selectOption('en');await readyMap(page,'pluto');
  const appearance=await (await page.request.get('/api/v1/appearance')).json();const catalog=await (await page.request.get('/api/v1/catalog/solar-system')).json();
  await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();
  const result=await page.getByTestId('result-id').innerText();await expect(page.getByTestId('frame-A')).toContainText('S12');await expect(page.getByTestId('frame-B')).toContainText('S14');
  const original=await (await page.request.get(`/api/v1/comparisons/${result}/manifest`)).json();
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();const judgment='The surface map and moon ephemerides are source-linked context. SPHEREx source association remains unvalidated.';
  await panel.locator('#assessment').fill(judgment);await panel.getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Export JSON',exact:true}).click();const bytes=await fs.readFile((await (await download).path())!);const evidence=JSON.parse(bytes.toString());
  expect(evidence.session.universe_context.appearance_manifest_sha256).toBe(appearance.source_manifest_sha256);
  expect(evidence.session.universe_context.extended_solar_manifest_sha256).toBe(catalog.source_manifest_sha256);
  expect(evidence.comparison).toEqual(original);expect(evidence.judgment).toBe(judgment);expect(evidence.comparison.scientific_status).toBe('association_insufficient');
  const changed=structuredClone(evidence);changed.session.universe_context.appearance_manifest_sha256='f'.repeat(64);
  const blocked=await page.request.post('/api/v1/evidence/import',{data:changed});expect(blocked.ok()).toBeTruthy();expect((await blocked.json()).status).toBe('recalculation_required');
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});const restored=await fresh.newPage();await restored.goto('/');
  await restored.getByTestId('global-import-file').setInputFiles({name:'appearance-evidence.json',mimeType:'application/json',buffer:bytes});
  await expect(restored.getByTestId('result-id')).toHaveText(result);await expect(restored.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
  await expect(restored.getByTestId('object-label-pluto')).toHaveAttribute('data-appearance-state','ready',{timeout:30000});
  await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();await expect(restored.locator('#assessment')).toHaveValue(judgment);
  await expect(restored.getByTestId('frame-A')).toContainText(original.frames[0].metadata.date_avg);await expect(restored.getByTestId('frame-B')).toContainText(original.frames[1].metadata.date_avg);
  await restored.screenshot({path:'../var/qa/appearance-pluto-evidence-restored.png',fullPage:true});await fresh.close();
});
