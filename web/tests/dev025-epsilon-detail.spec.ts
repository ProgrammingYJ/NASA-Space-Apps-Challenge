import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {epsilonBDetailCopy} from '../src/EpsilonBDetailCopy';

// Real served bytes and the two preserved original observations, not mocked images.
const photo={path:'/reference/epsilon-indi-b-2003.jpg',bytes:84074,width:447,height:446,
  sha256:'9398a48e727675900f2776522941cd81e2e3b45ec17c2ed32d59f90dfaccf722',
  original:'https://storage.noirlab.edu/media/archives/images/large/geminiann04016a.jpg',
  credit:'International Gemini Observatory/NOIRLab/NSF/AURA/PHOENIX Image'};
const sourceSha=['aac83ad1e0b4b908b76789da67d69b3c558f9917a412554523dcbf26b7a29146','7cf59b624e5cc53545014dc86be95b1708a1bb0b52280dd945035357d7735d51'];
const dates=['2025-04-30T02:06:28.716','2026-09-23T17:21:46.185'];
const locales=['en','ko','ja','zh-Hant','fr'] as const;
const scene=(page:Page)=>page.getByTestId('universe-scene');

async function selectEpsilon(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();await page.getByTestId('outer-tno-toggle').uncheck();await page.getByTestId('settings-toggle').click();
  await page.locator('#universe-search').fill('epsilon-indi-b');await page.getByTestId('search-epsilon-indi-b').click();
  await expect(scene(page)).toHaveAttribute('data-selected-object','epsilon-indi-b');
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
  await expect(page.getByTestId('object-label-earth')).toHaveAttribute('data-source-position-au',/.+/);
  await expect(page.getByTestId('epsilon-b-overview')).toBeVisible();
  await expect(page.getByTestId('open-object-observations')).toBeVisible();
}

async function sceneSnapshot(page:Page){
  return page.evaluate(()=>{
    const scene=document.querySelector<HTMLElement>('[data-testid="universe-scene"]')!;
    const attrs=(element:Element,names:string[])=>Object.fromEntries(names.map(name=>[name,element.getAttribute(name)]));
    return {scene:attrs(scene,['data-selected-object','data-model-epoch','data-camera-position','data-camera-target','data-distance-algorithm','data-distance-origin-object-id']),
      timeline:document.querySelector('[data-testid="timeline-clock"]')?.textContent,
      bodies:['earth','venus','epsilon-indi-b'].map(id=>{const label=document.querySelector(`[data-testid="object-label-${id}"]`)!;return {id,...attrs(label,['data-source-position-au','data-world-position','data-physical-reference-radius-km','data-mesh-world-radius','data-body-group-scale','data-surface-mesh-scale','data-appearance-lighting'])};})};
  });
}

test('DEV-025 ε Indi Ba/Bb original photo, five-language accessible tabs and modal leave the Solar System state intact',async({page},testInfo)=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const response=await page.request.get(photo.path,{timeout:15000});expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/jpeg');const bytes=await response.body();
  expect(bytes.byteLength).toBe(photo.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(photo.sha256);
  await selectEpsilon(page);
  const overview=page.getByTestId('epsilon-b-overview');await expect(overview).toContainText('2003-08-18');
  await expect(overview.locator('img')).toHaveAttribute('src',photo.path);
  // Let the existing camera finish its reduced-motion selection before the invariant snapshot.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const before=await sceneSnapshot(page);
  expect(before.scene['data-model-epoch']).toBeTruthy();expect(before.scene['data-camera-position']).toBeTruthy();
  const opener=page.getByTestId('open-epsilon-b-detail');
  for(const locale of locales){
    await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
    const copy=epsilonBDetailCopy(locale);await opener.click();
    const dialog=page.getByTestId('epsilon-b-dialog'),detail=page.getByTestId('epsilon-b-detail');
    await expect(dialog).toBeVisible();await expect(dialog).toHaveJSProperty('open',true);
    await expect(detail.locator('header').getByRole('button',{name:copy.close,exact:true})).toBeFocused();
    await expect(dialog).toHaveAccessibleName(copy.title);await expect(detail).toHaveAttribute('data-scope','outside-1000-au');
    await expect(detail).toHaveAttribute('data-photo-source-sha256',photo.sha256);
    await expect(detail).toContainText(copy.intro);await expect(detail).toContainText(copy.temperatureNote);
    await expect(detail).toContainText(copy.phaseNote);
    const actual=page.getByTestId('epsilon-b-photo'),photoTab=page.getByTestId('epsilon-b-photo-tab'),modelTab=page.getByTestId('epsilon-b-model-tab');
    await expect(actual).toHaveAttribute('data-image-state','ready');await expect(actual).toBeVisible();
    await expect(actual.locator('img')).toHaveJSProperty('naturalWidth',photo.width);await expect(actual.locator('img')).toHaveJSProperty('naturalHeight',photo.height);
    await expect(actual.locator('time')).toHaveAttribute('datetime','2003-08-18');await expect(actual.locator('time')).toHaveText('2003-08-18');
    await expect(actual).toContainText(copy.band);await expect(actual).toContainText(copy.photoNotice);
    await expect(photoTab).toHaveAttribute('aria-selected','true');await expect(modelTab).toHaveAttribute('aria-selected','false');
    const credit=page.getByTestId('epsilon-b-photo-credit');await expect(credit).toBeVisible();
    await expect(credit.getByRole('link',{name:photo.credit,exact:true})).toHaveAttribute('href',photo.original);
    await expect(credit.locator('a[href="https://creativecommons.org/licenses/by/4.0/"]')).toBeVisible();
    await photoTab.focus();await page.keyboard.press('End');
    await expect(modelTab).toBeFocused();await expect(modelTab).toHaveAttribute('aria-selected','true');await expect(actual).toBeHidden();
    const model=page.getByTestId('epsilon-b-model');await expect(model).toBeVisible();
    await expect(model).toHaveAttribute('data-position-kind','illustrative_unphased');await expect(model).toHaveAttribute('data-tied-to-date','false');
    await expect(model).toContainText(copy.modelNotice);await expect(model).toContainText(copy.surfaceNote);await expect(credit).toBeVisible();
    const spheres=await Promise.all(['ba','bb'].map(id=>page.getByTestId('epsilon-b-model-'+id).getAttribute('r')));
    expect(spheres).toEqual(['64','64']); // Explicit arbitrary display radii, never a measured physical-size oracle.
    await page.keyboard.press('Home');await expect(photoTab).toBeFocused();await expect(actual).toBeVisible();
    await detail.locator('details > summary').click();await expect(detail.locator('a[href="https://doi.org/10.3847/1538-3881/ac66d2"]')).toBeVisible();
    await expect(detail.locator('code')).toHaveText(photo.sha256);
    if(locale==='en'){
      await expect(detail.getByTestId('epsilon-b-mass-ba')).toContainText('66.92');await expect(detail.getByTestId('epsilon-b-mass-bb')).toContainText('53.25');
      await expect(actual).toContainText('does not resolve either body’s surface');await expect(model).toContainText('not current observed positions or measured physical radii');
    }
    await expect.poll(()=>sceneSnapshot(page)).toEqual(before);
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
    await expect.poll(()=>sceneSnapshot(page)).toEqual(before);await expect(page.getByTestId('open-object-observations')).toBeVisible();
  }
  expect(errors).toEqual([]);
  await testInfo.attach('dev025-epsilon-photo-and-scene-invariants.json',{body:JSON.stringify({photo:{...photo,http_status:response.status()},scene_before:before,locales,modal_does_not_change_scene:true}),contentType:'application/json'});
});

test('DEV-025 separate brown-dwarf detail opens preserved S01/S02 quality and one real evidence export restores in a clean session',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(180000);await selectEpsilon(page);await page.getByTestId('open-epsilon-b-detail').click();
  await expect(page.getByTestId('epsilon-b-photo')).toHaveAttribute('data-image-state','ready');
  await page.getByTestId('epsilon-b-open-observations').click();await expect(page.getByTestId('epsilon-b-dialog')).toHaveCount(0);
  const panel=page.getByTestId('observation-panel');await expect(panel).toBeVisible();
  // Explicitly preserve this pair when additional registered exposures become available.
  const selectors=panel.locator('select').filter({has:page.locator('option[value="S01"]')});await expect(selectors).toHaveCount(2);
  await selectors.nth(0).selectOption('S01');await selectors.nth(1).selectOption('S02');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();
  const resultId=await page.getByTestId('result-id').innerText();
  await expect(page.getByTestId('frame-A')).toContainText(dates[0]);await expect(page.getByTestId('frame-B')).toContainText(dates[1]);
  await expect(panel.getByRole('table')).toContainText('29');
  await panel.getByRole('combobox').filter({has:page.locator('option[value="B"]')}).selectOption('B');await expect(panel.getByRole('table')).toContainText('32');
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();
  const judgment='DEV-025 QA: Ba/Bb photo is a 2003 resolved point pair; S01/S02 quality is not an independent motion, surface or source-association measurement.';
  await panel.locator('#assessment').fill(judgment);await panel.getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  const evidenceId=await page.getByTestId('evidence-id').innerText();const downloadPromise=page.waitForEvent('download');
  await panel.getByRole('button',{name:'Export JSON',exact:true}).click();const download=await downloadPromise,stream=await download.createReadStream();expect(stream).toBeTruthy();
  const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));const bytes=Buffer.concat(chunks),record=JSON.parse(bytes.toString('utf8'));
  expect(record.result_id).toBe(resultId);expect(record.judgment).toBe(judgment);expect(record.session.object_id).toBe('epsilon-indi-b');
  expect(record.session.observation_ids).toEqual(['S01','S02']);expect(record.session.universe_context.selected_object_id).toBe('epsilon-indi-b');
  expect(record.comparison.frames.map((frame:{provenance:{sha256:string}})=>frame.provenance.sha256)).toEqual(sourceSha);
  expect(record.comparison.frames.map((frame:{metadata:{date_avg:string}})=>frame.metadata.date_avg)).toEqual(dates);
  expect(record.comparison.frames.map((frame:{quality:{pixel_count:number}})=>frame.quality.pixel_count)).toEqual([29,32]);
  const fresh=await browser.newContext({baseURL:baseURL??new URL(page.url()).origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage();await restored.goto('/');await expect(restored.getByTestId('result-id')).toHaveCount(0);
    // Public-network response bodies can arrive well after their HTTP headers.
    // Wait for this one import to complete; never repeat the mutation on timeout.
    const importedResponse=restored.waitForResponse(response=>response.url().endsWith('/api/v1/evidence/import')&&response.request().method()==='POST',{timeout:60000});
    await restored.getByTestId('global-import-file').setInputFiles({name:'dev025-epsilon-original-evidence.json',mimeType:'application/json',buffer:bytes});
    const imported=await importedResponse;expect(imported.status()).toBe(200);
    await imported.body();
    await expect(restored.getByTestId('result-id')).toHaveText(resultId);await expect(scene(restored)).toHaveAttribute('data-selected-object','epsilon-indi-b');
    const restoredPanel=restored.getByTestId('observation-panel');await restoredPanel.getByRole('button',{name:'Evidence',exact:true}).click();
    await expect(restoredPanel.locator('#assessment')).toHaveValue(judgment);await expect(restored.getByTestId('evidence-id')).toHaveText(evidenceId);
    await expect(restored.getByTestId('frame-A')).toContainText(dates[0]);await expect(restored.getByTestId('frame-B')).toContainText(dates[1]);
    await testInfo.attach('dev025-epsilon-evidence-restore.json',{body:JSON.stringify({result_id:resultId,evidence_id:evidenceId,observation_ids:record.session.observation_ids,source_sha256:sourceSha,restored_in_clean_context:true}),contentType:'application/json'});
  }finally{await fresh.close();}
});
