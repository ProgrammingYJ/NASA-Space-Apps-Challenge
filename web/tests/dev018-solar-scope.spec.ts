import {appearanceCopy} from '../src/AppearanceCopy';
import {creditsCopy} from '../src/CreditsCopy';
import {registeredObservationCopy} from '../src/RegisteredObservationCopy';
import type {Comparison,ObservationList} from '../src/types';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
const copy=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');}

test('unlinked Quaoar, Mercury, Venus, Earth, Mars and Sun retain honest empty observation states',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/');
  for(const id of ['quaoar','mercury','venus','earth','mars','sun']){
    const response=await page.request.get('/api/v1/observations?object_id='+id);expect(response.ok()).toBe(true);const available=await response.json();expect(available.object_id).toBe(id);expect(available.status).toBe('no_linked_observations');expect(available.observations).toEqual([]);
    await choose(page,id);await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');await expect(panel.getByTestId('observation-availability')).toContainText(copy('ko').noLinkedObservationTitle);await expect(panel.getByRole('combobox')).toHaveCount(0);await expect(panel.getByTestId('frame-A')).toHaveCount(0);await expect(panel.getByRole('alert')).toHaveCount(0);await expect(panel.getByTestId('observation-availability').getByRole('link').first()).toHaveAttribute('href','https://irsa.ipac.caltech.edu/applications/MOST/');
    for(const locale of ['en','ja','zh-Hant','fr','ko']){await page.getByTestId('language').selectOption(locale);await expect(panel).toContainText(copy(locale).noLinkedObservationTitle);await expect(panel).not.toContainText('undefined');}
    await panel.getByRole('button',{name:copy('ko').returnToSpace,exact:true}).click();
  }
});

test('the ten registered targets include real Jupiter, Saturn, Uranus and Neptune pairs, with Neptune original A/B source integrity',async({page})=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  const objectsResponse=await page.request.get('/api/v1/objects');expect(objectsResponse.ok()).toBe(true);const objectList=await objectsResponse.json();
  expect(objectList.objects.map((object:{object_id:string})=>object.object_id).sort()).toEqual(['epsilon-indi-b','pluto','barnards-star','wise0855','rw-aurigae','r-draconis','jupiter','saturn','uranus','neptune'].sort());
  const solar=[['jupiter',['SPX-J01','SPX-J02']],['saturn',['SPX-S01','SPX-S02']],['uranus',['SPX-U01','SPX-U02']],['neptune',['SPX-N01','SPX-N02']]] as const;
  for(const [objectId,ids] of solar){
    const response=await page.request.get('/api/v1/observations?object_id='+objectId);expect(response.ok()).toBe(true);const listing=await response.json() as ObservationList;
    expect(listing.object_id).toBe(objectId);expect(listing.status).toBe('available');expect(listing.default_pair).toEqual(ids);expect(listing.observations.map(row=>row.observation_id)).toEqual(ids);expect(listing.available_pairs).toEqual([[...ids]]);
    for(const exposure of listing.observations){expect(exposure.detector).toBe(objectId==='jupiter'?'D1':'D3');expect(exposure.date_avg).toMatch(/^202[56]-/);}
    expect(listing.observations[0].date_avg).not.toBe(listing.observations[1].date_avg);
    await choose(page,objectId);await page.getByTestId('open-object-observations').click();const panel=page.getByTestId('observation-panel');
    await expect(panel.getByTestId('observation-availability')).toHaveCount(0);const selectors=panel.getByRole('combobox');await expect(selectors).toHaveCount(2);
    await expect(selectors.nth(0)).toHaveValue(ids[0]);await expect(selectors.nth(1)).toHaveValue(ids[1]);
    await expect(panel.getByRole('button',{name:copy('en').open,exact:true})).toBeEnabled();
    if(objectId==='neptune'){
      const comparisonResponse=page.waitForResponse(value=>value.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(new URL(value.url()).pathname));
      await panel.getByRole('button',{name:copy('en').open,exact:true}).click();const resultResponse=await comparisonResponse;expect(resultResponse.ok()).toBe(true);const result=await resultResponse.json() as Comparison;
      expect(result.object_id).toBe('neptune');expect(result.algorithm_version).toBe('spherex-registered-native-v1');expect(result.frames.map(frame=>frame.observation_id)).toEqual(ids);expect(result.scientific_status).toBe('association_insufficient');
      const expectedSha=['591f5002e487fd439ddc0d5f5200523e1fed8b53d2f32cc014b3c7f0e12ae347','e3bbc3b37ba77993396c0c5a350a8c6dbc5853df8b12b6d3bb8fa03b8264eb56'];
      for(const [index,frame] of result.frames.entries()){
        expect(frame.provenance.id).toBe(ids[index]);expect(frame.provenance.sha256).toBe(expectedSha[index]);expect(frame.metadata.date_avg).toBe(listing.observations[index].date_avg);expect(frame.metadata.timesys).toBe('UTC');expect(frame.metadata.detector).toBe('D3');expect(frame.prediction.kind).toBe('observer_ephemeris_prediction');expect(frame.prediction.source).toMatchObject({target_id:'899',observer_id:'-163182'});expect(frame.quality.quantitative.status).toBe('not_validated');
        const view=panel.getByTestId(index===0?'frame-A':'frame-B');await expect(view).toContainText(ids[index]);await expect(view).toContainText(frame.metadata.date_avg);await expect(view.locator('canvas')).toHaveAttribute('width',String(frame.cutout.width));await expect(view.locator('canvas')).toHaveAttribute('height',String(frame.cutout.height));
      }
      await expect(panel.getByTestId('registered-observation-disclosures')).toContainText(registeredObservationCopy('en').note);await expect(page.getByTestId('result-id')).toHaveText(result.result_id);
    }
    await panel.getByRole('button',{name:copy('en').returnToSpace,exact:true}).click();
  }
});

test('provided logo and approved central credits preserve exact contributors, focus and five-language roles',async({page})=>{
  await page.goto('/');const logo=page.getByTestId('project-logo');await expect(logo).toBeVisible();await expect(logo).toHaveAttribute('src','/brand/planet-x-logo.png');expect(await logo.evaluate(element=>{const image=element as HTMLImageElement;return image.complete&&image.naturalWidth===1024&&image.naturalHeight===1024;})).toBe(true);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    await page.getByTestId('language').selectOption(locale);await page.getByTestId('settings-toggle').click();const opener=page.getByTestId('open-credits');await opener.click();const dialog=page.getByTestId('credits-dialog'),words=creditsCopy(locale);await expect(dialog).toBeVisible();await expect(dialog.getByTestId('credits-title')).toHaveText(words.title);await expect(dialog.getByTestId('credits-team')).toHaveText('2026 SNHS Alpha');
    for(const [role,label,names] of [['science',words.science,['송내고교 1학년 윤서진']],['testers',words.testers,['SNHS Alpha 전원 참여']],['design',words.design,['송내고교 1학년 김민정']],['backend',words.backend,['송내고교 1학년 이용진']],['management',words.management,['송내고교 2학년 유영준','송내고교 1학년 박형섭']],['leader',words.leader,['송내고교 1학년 이용진']]] as const){const row=dialog.getByTestId('credits-role-'+role);await expect(row.locator('dt')).toHaveText(label);await expect(row.locator('dd > span')).toHaveText([...names]);}
    await expect(dialog.getByTestId('credits-advisor')).toContainText('김민세');await expect(dialog.getByTestId('credits-venue')).toHaveText('송내고교');await expect(dialog.getByTestId('credits-data-pdf')).toHaveAttribute('href','/downloads/PlanetX_Data_Spec.pdf');await expect(dialog.getByTestId('credits-repository')).toHaveAttribute('href','https://github.com/ProgrammingYJ/NASA-Space-Apps-Challenge');
    await expect(page.getByTestId('credits-close')).toBeFocused();await page.keyboard.press('Tab');await expect(dialog.getByTestId('credits-data-pdf')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByTestId('credits-close')).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(dialog.getByTestId('credits-repository')).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByTestId('credits-close')).toBeFocused();await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();await page.getByTestId('settings-toggle').click();
  }
});

test('Quaoar and Weywot selection retains geometry and a near-safe camera gap',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await choose(page,'quaoar');
  const result=[];
  for(const id of ['quaoar','moon-weywot']){
    const label=page.getByTestId('object-label-'+id);await expect(label).toHaveAttribute('data-mesh-world-radius',/.+/);const before=await label.getAttribute('data-mesh-world-radius');await choose(page,id);expect(Number(await label.getAttribute('data-mesh-world-radius'))).toBeCloseTo(Number(before),7);await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');const scene=page.getByTestId('universe-scene'),radius=Number(await label.getAttribute('data-mesh-world-radius')),minimum=Number(await scene.getAttribute('data-controls-min-distance'));expect(minimum-radius).toBeGreaterThanOrEqual(.075-1e-6);const position=(await scene.getAttribute('data-camera-position'))!.split(',').map(Number),target=(await scene.getAttribute('data-camera-target'))!.split(',').map(Number),distance=Math.hypot(...position.map((v,i)=>v-target[i]));expect(distance-radius).toBeGreaterThan(.075);result.push({id,radius,minimum,distance});
  }
  await testInfo.attach('camera-clearance.json',{body:JSON.stringify(result),contentType:'application/json'});
});

test('Uranus and Neptune maps survive repeated selections without WebGL errors or geometry changes',async({page},testInfo)=>{
  test.setTimeout(120000);const errors:string[]=[],requests:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});page.on('request',request=>{if(/textures\/(uranus|neptune)-/.test(request.url()))requests.push(request.url());});await page.goto('/');const rows=[];
  for(const id of ['uranus','neptune','uranus','neptune']){
    await choose(page,id);await expect(page.getByTestId('source-map-note')).toBeVisible();await expect(page.getByTestId('source-map-note')).toContainText(appearanceCopy('ko').rgb);const label=page.getByTestId('object-label-'+id);await expect(label).toHaveAttribute('data-appearance-state','ready');await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');rows.push({id,radius:await label.getAttribute('data-mesh-world-radius'),dimensions:await label.getAttribute('data-display-texture-dimensions')});await page.screenshot({path:'../var/browser-results/dev018-selected-'+id+'.png'});
  }
  expect(rows[0].radius).toBe(rows[2].radius);expect(rows[1].radius).toBe(rows[3].radius);expect(errors).toEqual([]);await testInfo.attach('maps-and-console.json',{body:JSON.stringify({rows,requests,errors}),contentType:'application/json'});
});

test('the default real TNO layer uses identified points and a selected unknown-surface object exposes its source',async({page},testInfo)=>{
  await page.goto('/');const scene=page.getByTestId('universe-scene');await expect(scene).toHaveAttribute('data-outer-tno-catalogue','8341');await expect(scene).toHaveAttribute('data-outer-tno-visible','true');await expect(scene).toHaveAttribute('data-outer-tno-plotted','8340');await page.getByTestId('settings-toggle').click();await expect(page.getByTestId('outer-tno-catalogue-count')).toContainText('8341');await expect(page.getByTestId('outer-tno-catalogue-count')).toContainText('8340');await expect(page.getByTestId('outer-tno-catalogue-count')).toContainText('위치 미지원 1');await page.getByTestId('outer-tno-toggle').uncheck();await expect(scene).toHaveAttribute('data-outer-tno-visible','false');await page.getByTestId('outer-tno-toggle').check();await page.getByTestId('settings-toggle').click();await choose(page,'sbdb-20015760');const panel=page.getByTestId('outer-tno-panel');await expect(panel).toContainText(copy('ko').outerTnoMarker);await expect(panel).toContainText('Albion');await panel.getByTestId('outer-tno-source-facts').locator('summary').click();await expect(panel.getByRole('link').filter({hasText:'JPL SBDB',exact:true})).toHaveAttribute('href','https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=20015760');await testInfo.attach('TNO-layer-counts.json',{body:JSON.stringify({catalogue:await scene.getAttribute('data-outer-tno-catalogue'),plotted:await scene.getAttribute('data-outer-tno-plotted'),rendered:await scene.getAttribute('data-outer-tno-rendered')}),contentType:'application/json'});
});

test('conditional reference regions expose denominator, direct papers and actual member-to-hypothesis selection',async({page})=>{
  await page.goto('/');await page.getByTestId('open-planet-nine').click();const regions=page.getByTestId('p9-regions');await expect(page.getByTestId('p9-region-denominator')).toContainText('20,406');const response=await page.request.get('/api/v1/planet-nine/regions?limit=1');const data=await response.json();await page.getByTestId('p9-region-'+data.rows[0].cell_id).click();await expect(page.getByTestId('p9-region-members')).toBeVisible();const member=page.getByTestId('p9-region-members').getByRole('button').first(),id=(await member.getAttribute('data-testid'))!.replace('p9-row-','');await member.click();await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-'+id);await page.getByTestId('p9-predict').click();await expect(page.getByTestId('p9-sky-path')).toBeVisible();await expect(page.getByTestId('p9-region-denominator')).toContainText('20,406');await regions.locator('summary').click();for(const doi of ['10.3847/1538-3881/ac2056','10.22002/8fjad-x7y61','10.3847/PSJ/abe53e'])await expect(regions.locator(`a[href="https://doi.org/${doi}"]`)).toHaveCount(1);
});

test('known Sedna retains sourced ellipse and follow during explicitly unvalidated long-range extrapolation',async({page})=>{
  await page.goto('/');await choose(page,'sedna');const scene=page.getByTestId('universe-scene'),label=page.getByTestId('object-label-sedna');const radius=await label.getAttribute('data-mesh-world-radius');await expect(scene).toHaveAttribute('data-outer-tno-orbit-points','257');await expect(label).toHaveAttribute('data-mesh-world-radius',radius!);await expect(page.getByTestId('outer-tno-source-facts')).toContainText(copy('ko').outerTnoPrediction);await page.locator('#model-epoch').fill('2500-01-01T00:00:00');await page.locator('#model-epoch').press('Enter');await expect(scene).toHaveAttribute('data-outer-tno-orbit-points','257');await expect(scene).toHaveAttribute('data-follow-object','sedna');await expect(page.getByTestId('outer-tno-time-notice')).toBeVisible();await expect(page.getByTestId('outer-tno-position-status')).toContainText('\uc7a5\uae30');await expect(page.getByTestId('selected-position-description')).toContainText('\uc7a5\uae30');
});
