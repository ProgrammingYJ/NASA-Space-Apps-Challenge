import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';

const scene=(page:Page)=>page.getByTestId('universe-scene');
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId(`search-${id}`).click();await expect(scene(page)).toHaveAttribute('data-selected-object',id);}
async function closeSettings(page:Page){await page.getByTestId('kuiper-toggle').press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);}
async function kuiperOff(page:Page){await page.getByTestId('settings-toggle').click();await page.getByTestId('kuiper-toggle').uncheck();await expect(scene(page)).toHaveAttribute('data-kuiper-visible','false');await closeSettings(page);}

test('nine distinct source-informed galaxy shapes fly into focus and preserve approximate-source labels',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await expect(scene(page)).toHaveAttribute('data-galaxy-count','9');
  await expect(scene(page)).toHaveAttribute('data-kuiper-inner-au','30');await expect(scene(page)).toHaveAttribute('data-kuiper-outer-au','50');
  await page.getByTestId('settings-toggle').click();await page.getByTestId('galaxies-toggle').uncheck();await expect(scene(page)).toHaveAttribute('data-galaxy-count','0');await closeSettings(page);
  const ids=['galaxy-m31','galaxy-m33','galaxy-m81','galaxy-m87','galaxy-lmc','galaxy-smc','galaxy-m51','galaxy-m104','galaxy-centaurus-a'];
  for(const id of ids){
    await choose(page,id);await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
    await expect(scene(page)).toHaveAttribute('data-galaxy-count','9');
    await expect(scene(page)).toHaveAttribute('data-focused-object',id);
    await expect(page.getByTestId(`object-label-${id}`)).toHaveAttribute('data-position-kind','catalog_direction_distance_estimate');
    await expect(page.getByTestId(`object-label-${id}`)).toHaveAttribute('data-representation','source_informed_morphology_with_illustrative_detail');
    await expect(page.getByTestId('galaxy-panel')).toBeVisible();
    const shape=page.getByTestId(`object-label-${id}`);
    // These are independent recognizability checks from the NASA/CXC source
    // photographs and descriptions, not equality to this API's own output.
    if(id==='galaxy-m31'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','inclined_spiral');
      expect(Number(await shape.getAttribute('data-axis-ratio'))).toBeLessThan(.4);
      expect(Number(await shape.getAttribute('data-inclination-deg'))).toBe(77);
      await expect(page.getByTestId('galaxy-morphology')).toContainText('77°');
    }else if(id==='galaxy-m33')await expect(shape).toHaveAttribute('data-galaxy-renderer','flocculent_spiral');
    else if(id==='galaxy-m81')await expect(shape).toHaveAttribute('data-arm-count','2');
    else if(id==='galaxy-m87'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','elliptical_jet');await expect(shape).toHaveAttribute('data-arm-count','0');
    }else if(id==='galaxy-lmc'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','irregular_barred');await expect(shape).toHaveAttribute('data-arm-count','1');await expect(shape).toHaveAttribute('data-asymmetry','true');
    }else if(id==='galaxy-smc'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','irregular_cloud');await expect(shape).toHaveAttribute('data-arm-count','0');await expect(shape).toHaveAttribute('data-asymmetry','true');
    }else if(id==='galaxy-m51'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','interacting_pair');await expect(shape).toHaveAttribute('data-companion-count','1');await expect(shape).toHaveAttribute('data-arm-count','2');
    }else if(id==='galaxy-m104'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','edge_on_dust_disk');expect(Number(await shape.getAttribute('data-dust-lane-count'))).toBeGreaterThan(0);expect(Number(await shape.getAttribute('data-axis-ratio'))).toBeLessThan(.4);
    }else if(id==='galaxy-centaurus-a'){
      await expect(shape).toHaveAttribute('data-galaxy-renderer','dust_lane_elliptical');await expect(shape).toHaveAttribute('data-arm-count','0');expect(Number(await shape.getAttribute('data-dust-lane-count'))).toBeGreaterThan(0);
    }
    await expect(page.getByTestId('galaxy-morphology')).toBeVisible();
    await expect(shape).toHaveAttribute('data-orientation-assumed','true');
    if(['galaxy-m104','galaxy-centaurus-a'].includes(id))await expect(page.getByTestId('galaxy-panel')).not.toContainText('M33 Fast Facts');
    await expect(page.getByRole('navigation').getByRole('button',{name:'Observations',exact:true})).toBeDisabled();
    await expect(page.getByTestId('frame-A')).toHaveCount(0);
    await page.screenshot({path:`../var/qa/galaxy-shape-${id.replace('galaxy-','')}.png`});
  }
  await choose(page,'galaxy-m87');await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
  const epoch=await scene(page).getAttribute('data-model-epoch');const position=await page.getByTestId('object-label-galaxy-m87').getAttribute('data-source-position-au');
  await kuiperOff(page);expect(await scene(page).getAttribute('data-model-epoch')).toBe(epoch);expect(await page.getByTestId('object-label-galaxy-m87').getAttribute('data-source-position-au')).toBe(position);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const words=JSON.parse(await fs.readFile(`src/locales/${locale}.json`,'utf8'));await page.getByTestId('language').selectOption(locale);
    await expect(page.getByTestId('galaxy-panel')).toContainText(words.galaxyApproxNote);await expect(page.getByTestId('galaxy-panel')).toContainText(words.galaxyDistance);
    await expect(page.getByTestId('galaxy-panel')).toContainText(words.galaxyMorphologyNote);await expect(page.getByTestId('galaxy-morphology')).toContainText(words.galaxy_shape_elliptical_jet);
    await page.getByTestId('settings-toggle').click();await expect(page.getByRole('dialog')).toContainText(words.kuiperNote);await closeSettings(page);
  }
  await page.getByTestId('language').selectOption('en');await page.getByTestId('timeline-rate').selectOption('72');await page.getByTestId('timeline-play-toggle').click();
  await expect(scene(page)).toHaveAttribute('data-model-epoch',/2026-11-16T00:00:00/);await expect(page.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
  expect(await page.getByTestId('object-label-galaxy-m87').getAttribute('data-source-position-au')).toBe(position);
  await page.screenshot({path:'../var/qa/galaxy-source-context.png'});expect(errors).toEqual([]);
});

test('Kuiper setting, 72-hour rate and galaxy provenance survive actual Pluto evidence restore',async({page,browser})=>{
  test.setTimeout(90000);await page.goto('/');await page.getByTestId('language').selectOption('en');await choose(page,'pluto');
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');await kuiperOff(page);await page.getByTestId('timeline-rate').selectOption('72');
  await page.getByTestId('settings-toggle').click();await page.getByTestId('galaxies-toggle').uncheck();await expect(scene(page)).toHaveAttribute('data-galaxy-count','0');await closeSettings(page);
  const galaxies=await (await page.request.get('/api/v1/catalog/galaxies')).json();
  await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');await panel.getByRole('button',{name:'Open comparison',exact:true}).click();
  await expect(page.getByTestId('result-id')).toBeVisible();const result=await page.getByTestId('result-id').innerText();
  const original=await (await page.request.get(`/api/v1/comparisons/${result}/manifest`)).json();await panel.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='Kuiper points and galaxy shapes are illustrative context. Pluto association remains insufficient.';await panel.locator('#assessment').fill(judgment);await panel.getByRole('button',{name:'Save evidence',exact:true}).click();
  await expect(page.getByTestId('evidence-id')).toBeVisible({timeout:45000});const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Export JSON',exact:true}).click();
  const bytes=await fs.readFile((await (await download).path())!);const evidence=JSON.parse(bytes.toString());const context=evidence.session.universe_context;
  expect(context.show_kuiper_belt).toBe(false);expect(context.show_galaxies).toBe(false);expect(context.kuiper_display_version).toBe('kuiper-region-v1');expect(context.galaxy_manifest_sha256).toBe(galaxies.source_manifest_sha256);
  expect(context.playback_rate_hours_per_second).toBe(72);expect(context.playback_paused).toBe(true);expect(evidence.comparison).toEqual(original);
  const changed=structuredClone(evidence);changed.session.universe_context.galaxy_manifest_sha256='f'.repeat(64);
  const blocked=await page.request.post('/api/v1/evidence/import',{data:changed});expect(blocked.ok()).toBeTruthy();expect((await blocked.json()).status).toBe('recalculation_required');
  const fresh=await browser.newContext({viewport:{width:1440,height:1000}});const restored=await fresh.newPage();await restored.goto('/');
  await restored.getByTestId('global-import-file').setInputFiles({name:'galaxy-context-evidence.json',mimeType:'application/json',buffer:bytes});
  await expect(restored.getByTestId('result-id')).toHaveText(result,{timeout:45000});await expect(scene(restored)).toHaveAttribute('data-kuiper-visible','false');await expect(scene(restored)).toHaveAttribute('data-galaxy-count','0');
  const english=JSON.parse(await fs.readFile('src/locales/en.json','utf8'));await expect(restored.getByRole('alert')).toContainText(english.restoreSuccess);
  await expect(restored.getByTestId('timeline-rate')).toHaveValue('72');await expect(restored.getByTestId('timeline-play-toggle')).toHaveAttribute('aria-pressed','false');
  await restored.getByTestId('observation-panel').getByRole('button',{name:'Evidence',exact:true}).click();await expect(restored.locator('#assessment')).toHaveValue(judgment);
  await expect(restored.getByTestId('frame-A')).toContainText(original.frames[0].metadata.date_avg);await expect(restored.getByTestId('frame-B')).toContainText(original.frames[1].metadata.date_avg);
  await restored.screenshot({path:'../var/qa/galaxy-kuiper-evidence-restored.png',fullPage:true});await fresh.close();
});
