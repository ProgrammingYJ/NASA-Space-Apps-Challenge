import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {registeredObservationCopy,observationPixelQualityNote} from '../src/RegisteredObservationCopy';
import type {Comparison,Frame,ObservationList} from '../src/types';

interface SolarExposure{source:{sha256:string;bytes:number;source_url:string};date_avg:string;detector:string;native_shape_yx:[number,number];calibration_source:{sha256:string};prediction:{kind:string;ra_deg:number;dec_deg:number;source:{url:string;sha256:string;observer_id:string;target_id:string;epoch:string}}}
interface Registry{objects:Record<string,{default_pair:string[]}>;exposures:Record<string,SolarExposure>;pairs:string[][]}
type SolarFrame=Frame&{prediction:Frame['prediction']&{source:Frame['prediction']['source']&{sha256:string;observer_id:string;target_id:string}}};
const registry=JSON.parse(readFileSync(new URL('../../data/manifests/observation_registry.json',import.meta.url),'utf8')) as Registry;
const planets=[['jupiter','599',['SPX-J01','SPX-J02']],['saturn','699',['SPX-S01','SPX-S02']],['uranus','799',['SPX-U01','SPX-U02']],['neptune','899',['SPX-N01','SPX-N02']]] as const;
const locales=['ko','en','ja','zh-Hant','fr'] as const;
const panel=(page:Page)=>page.getByTestId('observation-panel');
async function viewState(page:Page,id:string){return page.evaluate(objectId=>{
  const scene=document.querySelector<HTMLElement>('[data-testid="universe-scene"]')!,body=document.querySelector<HTMLElement>(`[data-testid="object-label-${objectId}"]`)!;
  const attrs=(element:Element,names:string[])=>Object.fromEntries(names.map(name=>[name,element.getAttribute(name)]));
  return {clock:document.querySelector('[data-testid="timeline-clock"]')?.textContent,
    scene:attrs(scene,['data-selected-object','data-model-epoch','data-camera-position','data-camera-target','data-distance-algorithm','data-distance-origin-object-id']),
    body:attrs(body,['data-source-position-au','data-world-position','data-physical-reference-radius-km','data-mesh-world-radius','data-body-group-scale','data-surface-mesh-scale','data-coverage-mode','data-appearance-lighting'])};
},id);}

test('DEV-025 four Solar System planets open source-pinned SPHEREx A/B with diagnostic gaps while model time, geometry and globe maps stay unchanged',async({page},testInfo)=>{
  test.setTimeout(180000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();await page.getByTestId('outer-tno-toggle').uncheck();await page.getByTestId('settings-toggle').click();
  const appearanceResponse=await page.request.get('/api/v1/appearance');expect(appearanceResponse.ok()).toBe(true);const appearanceBefore=await appearanceResponse.json();
  const results:unknown[]=[];
  for(const [id,targetId,ids] of planets){
    expect(registry.objects[id].default_pair).toEqual(ids);expect(registry.pairs).toContainEqual([...ids]);
    const listingResponse=await page.request.get('/api/v1/observations?object_id='+id);expect(listingResponse.ok()).toBe(true);const listing=await listingResponse.json() as ObservationList;
    expect(listing.object_id).toBe(id);expect(listing.default_pair).toEqual(ids);expect(listing.available_pairs).toContainEqual([...ids]);
    await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');
    await expect(page.getByTestId('object-label-'+id)).toHaveAttribute('data-source-position-au',/.+/);
    await expect(page.getByTestId('object-label-'+id)).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
    const before=await viewState(page,id);expect(before.clock).toBeTruthy();
    await page.getByTestId('open-object-observations').click();await expect(panel(page)).toBeVisible();
    const dates=panel(page).locator('select').filter({has:page.locator(`option[value="${ids[0]}"]`)});await expect(dates).toHaveCount(2);await dates.nth(0).selectOption(ids[0]);await dates.nth(1).selectOption(ids[1]);
    let timer:ReturnType<typeof setTimeout>|undefined;
    const finished=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(new URL(response.url()).pathname),{timeout:60000}).then(async response=>{expect(response.ok()).toBe(true);expect(await response.finished()).toBeNull();return await response.json() as Comparison;});
    const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual solar observation body did not complete within 60 seconds')),60000);});
    let comparison:Comparison;
    try{await panel(page).getByRole('button',{name:'Open comparison',exact:true}).click();comparison=await Promise.race([finished,deadline]);}finally{if(timer)clearTimeout(timer);}
    expect(comparison.object_id).toBe(id);expect(comparison.algorithm_version).toBe('spherex-registered-native-v1');expect(comparison.scientific_status).toBe('association_insufficient');
    expect(comparison.frames.map(frame=>frame.observation_id)).toEqual(ids);await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
    for(const [index,raw] of comparison.frames.entries()){
      const frame=raw as SolarFrame,source=registry.exposures[frame.observation_id],view=page.getByTestId(index===0?'frame-A':'frame-B');
      expect(frame.provenance.sha256).toBe(source.source.sha256);expect(frame.provenance.bytes).toBe(source.source.bytes);expect(frame.provenance.source_url).toBe(source.source.source_url);
      expect(frame.metadata.date_avg).toBe(source.date_avg);expect(frame.metadata.detector).toBe(source.detector);expect(frame.metadata.unit.replace(/\s/g,'')).toBe('MJy/sr');expect(frame.metadata.timesys).toBe('UTC');
      expect(frame.calibration.verified).toBe(true);expect(frame.calibration.sha256).toBe(source.calibration_source.sha256);
      expect(frame.prediction.kind).toBe('observer_ephemeris_prediction');expect(frame.prediction.source).toMatchObject({url:source.prediction.source.url,sha256:source.prediction.source.sha256,observer_id:'-163182',target_id:targetId,epoch:source.date_avg});
      expect(frame.prediction.ra_deg).toBeCloseTo(source.prediction.ra_deg,9);expect(frame.prediction.dec_deg).toBeCloseTo(source.prediction.dec_deg,9);
      expect(frame.prediction.omitted).toContain('measured_centroid');expect(frame.prediction.omitted).toContain('motion_validation');
      expect(Date.parse(frame.metadata.date_avg+'Z')).not.toBe(Date.parse(before.clock!)); // Acquisition date is separate from model time.
      await expect(view).toContainText(source.date_avg);await expect(view.locator('canvas')).toHaveAttribute('width',String(frame.cutout.width));await expect(view.locator('canvas')).toHaveAttribute('height',String(frame.cutout.height));
      expect(frame.cutout.IMAGE).toHaveLength(frame.cutout.height);expect(frame.cutout.IMAGE.every(row=>row.length===frame.cutout.width&&row.every(value=>value===null||Number.isFinite(value)))).toBe(true);
      expect(frame.cutout.FLAGS.every(row=>row.length===frame.cutout.width&&row.every(value=>Number.isInteger(value)&&value>=0))).toBe(true);
    }
    const disclosures=panel(page).getByTestId('registered-observation-disclosures');await expect(disclosures).toContainText(registeredObservationCopy('en').note);await expect(disclosures).toContainText(registeredObservationCopy('en').band);
    const hasNonfinite=comparison.frames.some(frame=>frame.quality.image_nonfinite>0),warning=page.getByTestId('observation-nonfinite-warning');
    if(id==='jupiter'||id==='saturn'){
      // These source products are diagnostic. Reuse the actual final JPL-marker
      // quality, never the old temporary-query-centre counts or a nice-image oracle.
      expect(comparison.frames.some(frame=>frame.cutout.IMAGE.some(row=>row.includes(null)))).toBe(true);expect(hasNonfinite).toBe(true);
    }
    if(hasNonfinite){await expect(warning).toContainText(observationPixelQualityNote('en'));for(const [index,frame] of comparison.frames.entries())await expect(warning).toContainText(`${index===0?'A':'B'} ${frame.quality.image_nonfinite}/${frame.quality.pixel_count}`);}
    else await expect(warning).toHaveCount(0);
    if(id==='jupiter'){
      for(const locale of locales){await page.getByTestId('language').selectOption(locale);await expect(warning).toContainText(observationPixelQualityNote(locale));await expect(disclosures).toContainText(registeredObservationCopy(locale).note);await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);}
      await page.getByTestId('language').selectOption('en');
    }
    await expect.poll(()=>viewState(page,id)).toEqual(before);
    results.push({object_id:id,result_id:comparison.result_id,observations:comparison.frames.map(frame=>({id:frame.observation_id,date:frame.metadata.date_avg,source_sha256:frame.provenance.sha256,nonfinite:frame.quality.image_nonfinite,pixels:frame.quality.pixel_count})),model_state_unchanged:true});
    await panel(page).getByRole('button',{name:'Return to space',exact:true}).click();await expect(panel(page)).toHaveCount(0);await expect.poll(()=>viewState(page,id)).toEqual(before);
  }
  const after=await page.request.get('/api/v1/appearance',{maxRetries:1});expect(after.ok()).toBe(true);expect(await after.json()).toEqual(appearanceBefore);
  await testInfo.attach('dev025-solar-source-diagnostics.json',{body:JSON.stringify({results,globe_appearance_manifest_unchanged:true,native_observations_are_not_globe_surface_maps:true}),contentType:'application/json'});
});
