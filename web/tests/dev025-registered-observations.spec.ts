import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {registeredObservationCopy} from '../src/RegisteredObservationCopy';
import type {Comparison,Frame,Observation,ObservationList} from '../src/types';

// This is the authored registry source, independent of the runtime snapshot.
// The tests visit representative pairs, never loop through all 66 cache orders.
interface SourcePin{sha256:string;bytes:number;source_url:string}
interface RegisteredExposure{
  observation_id:string;object_id:string;source:SourcePin;calibration_source:SourcePin;
  release:string;detector:string;pipeline_version:string;date_avg:string;native_shape_yx:[number,number];
  calibration_family:string;calibration_verification_status:string;calibration_unavailable_reason?:string;
  calibration_datalink:{response_sha256:string|null};
  prediction:{kind:string;ra_deg:number;dec_deg:number;source:{url:string;sha256?:string;observer_id?:string}};
}
interface Registry{algorithm_version:string;objects:Record<string,{default_pair:string[]}>;exposures:Record<string,RegisteredExposure>;pairs:string[][]}
type Listing=Omit<ObservationList,'observations'>&{observations:(Observation&{sha256:string;source_url:string;bytes:number;quantitative_comparison_validated:boolean})[]};
type RegisteredFrame=Frame&{metadata:Frame['metadata']&{wavelength_status:string;source_extent_kind:string;wcs:Frame['metadata']['wcs']&{native_shape_yx:[number,number]}};
  calibration:Frame['calibration']&{applied_to_wavelength:boolean;unavailable_reason:string|null;datalink_response_sha256:string|null};
  prediction:Frame['prediction']&{source:Frame['prediction']['source']&{sha256?:string;observer_id?:string}}};
const registry=JSON.parse(readFileSync(new URL('../../data/manifests/observation_registry.json',import.meta.url),'utf8')) as Registry;
const defaults=[['barnards-star',['L002','L006']],['r-draconis',['L010','L012']],['rw-aurigae',['L015','L018']],['wise0855',['L023','L026']]] as const;
const locales=['ko','en','ja','zh-Hant','fr'] as const;
const panel=(page:Page)=>page.getByTestId('observation-panel');

async function start(page:Page){
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();await page.getByTestId('outer-tno-toggle').uncheck();await page.getByTestId('settings-toggle').click();
}
async function openTarget(page:Page,objectId:string){
  await page.locator('#universe-search').fill(objectId);await page.getByTestId('search-'+objectId).click();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',objectId);
  await page.getByTestId('open-object-observations').click();await expect(panel(page)).toBeVisible();
}
async function listingFor(page:Page,objectId:string){
  const response=await page.request.get('/api/v1/observations?object_id='+objectId);expect(response.ok()).toBe(true);const listing=await response.json() as Listing;
  expect(listing.object_id).toBe(objectId);expect(listing.default_pair).toEqual(registry.objects[objectId].default_pair);
  expect(listing.available_pairs).toEqual(registry.pairs.filter(ids=>registry.exposures[ids[0]].object_id===objectId));
  for(const observation of listing.observations){
    const source=registry.exposures[observation.observation_id];expect(source.object_id).toBe(objectId);
    expect(observation.sha256).toBe(source.source.sha256);expect(observation.source_url).toBe(source.source.source_url);
    expect(observation.bytes).toBe(source.source.bytes);expect(observation.date_avg).toBe(source.date_avg);expect(observation.detector).toBe(source.detector);
    expect(observation.quantitative_comparison_validated).toBe(false);
  }
  return listing;
}
function dateSelectors(page:Page,member:string):Locator{return panel(page).locator('select').filter({has:page.locator(`option[value="${member}"]`)});}
async function choosePair(page:Page,ids:readonly string[]){const selectors=dateSelectors(page,ids[0]);await expect(selectors).toHaveCount(2);await selectors.nth(0).selectOption(ids[0]);await selectors.nth(1).selectOption(ids[1]);}
async function runComparison(page:Page,objectId:string,ids:readonly string[]){
  await choosePair(page,ids);const created=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/comparison-jobs');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const bodyComplete=page.waitForResponse(response=>response.request().method()==='GET'&&/^\/api\/v1\/comparisons\/cmp_[a-f0-9]{24}\/manifest$/.test(new URL(response.url()).pathname),{timeout:60000}).then(async response=>{expect(response.ok()).toBe(true);expect(await response.finished()).toBeNull();return await response.json() as Comparison;});
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Actual registered comparison body did not complete within 60 seconds')),60000);});
  let comparison:Comparison;
  try{await panel(page).getByRole('button',{name:'Open comparison',exact:true}).click();comparison=await Promise.race([bodyComplete,deadline]);}finally{if(timer)clearTimeout(timer);}
  const response=await created;expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({observation_ids:[...ids]});const job=await response.json();
  await expect.poll(async()=>{const status=await page.request.get('/api/v1/jobs/'+job.job_id);expect(status.ok()).toBe(true);return (await status.json()).state;}).toBe('succeeded');
  const status=await (await page.request.get('/api/v1/jobs/'+job.job_id)).json();expect(status.object_id).toBe(objectId);
  await expect(page.getByTestId('result-id')).toHaveText(status.result_id);
  expect(comparison.result_id).toBe(status.result_id);
  expect(comparison.algorithm_version).toBe('spherex-registered-native-v1');expect(comparison.object_id).toBe(objectId);
  expect(comparison.scientific_status).toBe('association_insufficient');expect(comparison.frames.map(frame=>frame.observation_id)).toEqual(ids);
  for(const [index,raw] of comparison.frames.entries()){
    const frame=raw as RegisteredFrame,source=registry.exposures[frame.observation_id];
    expect(frame.provenance.sha256).toBe(source.source.sha256);expect(frame.provenance.bytes).toBe(source.source.bytes);expect(frame.provenance.source_url).toBe(source.source.source_url);
    expect(frame.metadata).toMatchObject({date_avg:source.date_avg,release:source.release,detector:source.detector,pipeline_version:source.pipeline_version,timesys:'UTC'});
    expect(frame.metadata.unit.replace(/\s/g,'')).toBe('MJy/sr'); // Preserve the original FITS spelling (for example “MJy / sr”).
    expect(frame.metadata.wcs.origin).toBe(0);expect(frame.metadata.wcs.native_shape_yx).toEqual(source.native_shape_yx);
    expect(frame.calibration.sha256).toBe(source.calibration_source.sha256);expect(frame.calibration.source_url).toBe(source.calibration_source.source_url);
    expect(frame.calibration.verification_status).toBe(source.calibration_verification_status);
    const verified=source.calibration_verification_status==='verified';expect(frame.calibration.verified).toBe(verified);expect(frame.calibration.applied_to_wavelength).toBe(verified);
    if(!verified){
      expect(frame.metadata.wavelength_um).toBeNull();expect(frame.metadata.bandwidth_um).toBeNull();expect(frame.metadata.wavelength_status).toBe('unverified_calibration_link');
      expect(frame.calibration.unavailable_reason).toBe(source.calibration_unavailable_reason);
    }
    expect(frame.prediction.kind).toBe(source.prediction.kind);expect(frame.prediction.source.url).toBe(source.prediction.source.url);
    const {width,height,native_origin:origin}=frame.cutout;expect(width).toBeGreaterThan(0);expect(height).toBeGreaterThan(0);
    expect(origin.x).toBeGreaterThanOrEqual(0);expect(origin.y).toBeGreaterThanOrEqual(0);
    expect(origin.x+width).toBeLessThanOrEqual(source.native_shape_yx[1]);expect(origin.y+height).toBeLessThanOrEqual(source.native_shape_yx[0]);
    for(const plane of [frame.cutout.IMAGE,frame.cutout.VARIANCE,frame.cutout.ZODI]){
      expect(plane).toHaveLength(height);expect(plane.every(row=>row.length===width&&row.every(value=>value===null||Number.isFinite(value)))).toBe(true);
    }
    expect(frame.cutout.FLAGS).toHaveLength(height);expect(frame.cutout.FLAGS.every(row=>row.length===width&&row.every(value=>Number.isInteger(value)&&value>=0))).toBe(true);
    if(source.release==='QR2'){
      // Independently read original L002/L010/L023 headers declare MP_TRANSIENT=0:
      // bit position zero must survive as the mask value 1, never vanish as falsy.
      expect(frame.quality.flag_definitions).toContainEqual(expect.objectContaining({name:'TRANSIENT',bit:0,value:1}));
      expect(frame.metadata.psf?.kind).toBe('legacy_psf_cube');expect(frame.metadata.epsf.rows).toBeNull();
    }
    const view=page.getByTestId(index===0?'frame-A':'frame-B');await expect(view).toContainText(frame.observation_id);await expect(view).toContainText(source.date_avg);
    await expect(view.locator('canvas')).toHaveAttribute('width',String(width));await expect(view.locator('canvas')).toHaveAttribute('height',String(height));
  }
  await expect(panel(page).getByTestId('registered-observation-disclosures')).toBeVisible();return comparison;
}

test('DEV-025 four official targets use registered real pairs, keep warnings in five languages, and reject unsupported detector/target combinations',async({page},testInfo)=>{
  test.setTimeout(180000);await start(page);const results:Record<string,string>={};
  for(const [objectId,ids] of defaults){
    const listing=await listingFor(page,objectId);expect(listing.default_pair).toEqual(ids);await openTarget(page,objectId);
    const comparison=await runComparison(page,objectId,ids);results[objectId]=comparison.result_id;
    if(objectId==='barnards-star'){
      for(const locale of locales){
        await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);const copy=registeredObservationCopy(locale);
        const disclosures=panel(page).getByTestId('registered-observation-disclosures');await expect(disclosures).toContainText(copy.note);await expect(disclosures).toContainText(copy.reference);await expect(disclosures).toContainText(copy.band);await expect(disclosures).toContainText(copy.version);
        await expect(page.getByTestId('unverified-spectral-calibration')).toHaveText(copy.wave);await expect(page.getByTestId('result-id')).toHaveText(comparison.result_id);
      }
      await page.getByTestId('language').selectOption('en');
      const crossDetector=['L001','L006'];expect(registry.exposures.L001.detector).not.toBe(registry.exposures.L006.detector);
      await choosePair(page,crossDetector);await expect(panel(page).getByRole('button',{name:'Open comparison',exact:true})).toBeDisabled();await expect(page.getByTestId('unsupported-observation-pair')).toHaveText(registeredObservationCopy('en').pair);await expect(page.getByTestId('frame-A')).toHaveCount(0);
      for(const unsupported of [crossDetector,['L002','L023']]){const rejected=await page.request.post('/api/v1/comparison-jobs',{data:{observation_ids:unsupported}});expect(rejected.status()).toBe(422);}
      const reverse=await runComparison(page,objectId,[ids[1],ids[0]]);expect(reverse.result_id).not.toBe(comparison.result_id);
      expect(reverse.frames.map(frame=>frame.provenance.sha256)).toEqual(comparison.frames.map(frame=>frame.provenance.sha256).reverse());
    }
    // Moving to the next target must replace both exposure selectors and frames;
    // it must not relabel a previous target's cached pixels as the new object.
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',objectId);
  }
  await testInfo.attach('dev025-official-registered-results.json',{body:JSON.stringify({results,default_pairs:defaults,five_language_warnings:true,unsupported_detector_and_target_rejected:true}),contentType:'application/json'});
});

test('DEV-025 Pluto S13 native edge geometry and verified provenance survive generic evidence export and one fresh-session restore',async({page,browser,baseURL},testInfo)=>{
  test.setTimeout(120000);await start(page);await listingFor(page,'pluto');await openTarget(page,'pluto');
  const comparison=await runComparison(page,'pluto',['S13','S14']),edge=comparison.frames[0] as RegisteredFrame;
  expect(edge.cutout.width).toBe(81);expect(edge.cutout.height).toBe(43);expect(edge.calibration.verified).toBe(true);
  expect(edge.metadata.wavelength_status).toBe('calibrated_sample');expect(edge.metadata.wavelength_um).toBeGreaterThan(0);expect(edge.metadata.bandwidth_um).toBeGreaterThan(0);
  // S13 has a verified calibration link. The separate native-only/null-wave
  // assertions above apply to L002/L010/L023, not this clipped full-detector input.
  expect(edge.prediction.source.sha256).toBe(registry.exposures.S13.prediction.source.sha256);
  expect(edge.prediction.source.observer_id).toBe('-163182');expect(edge.prediction.kind).toBe('observer_ephemeris_prediction');
  await panel(page).getByRole('button',{name:'Evidence',exact:true}).click();const judgment='DEV-025 native S13/S14: edge clipping and verified provenance preserved; no measured motion or calibrated flux claimed.';
  await panel(page).locator('#assessment').fill(judgment);await panel(page).getByRole('button',{name:'Save evidence',exact:true}).click();await expect(page.getByTestId('evidence-id')).toBeVisible();
  const evidenceId=await page.getByTestId('evidence-id').innerText(),downloadPromise=page.waitForEvent('download');await panel(page).getByRole('button',{name:'Export JSON',exact:true}).click();
  const download=await downloadPromise,stream=await download.createReadStream();expect(stream).toBeTruthy();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  const bytes=Buffer.concat(chunks),record=JSON.parse(bytes.toString('utf8'));expect(record.result_id).toBe(comparison.result_id);expect(record.session.observation_ids).toEqual(['S13','S14']);expect(record.comparison).toEqual(comparison);expect(record.judgment).toBe(judgment);
  const fresh=await browser.newContext({baseURL:baseURL??new URL(page.url()).origin,viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  try{
    const restored=await fresh.newPage();await restored.goto('/');await expect(restored.getByTestId('result-id')).toHaveCount(0);
    await restored.getByTestId('global-import-file').setInputFiles({name:'dev025-generic-pluto-S13-evidence.json',mimeType:'application/json',buffer:bytes});
    await expect(restored.getByTestId('result-id')).toHaveText(comparison.result_id);await expect(restored.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','pluto');
    await expect(restored.getByTestId('frame-A').locator('canvas')).toHaveAttribute('width','81');await expect(restored.getByTestId('frame-A').locator('canvas')).toHaveAttribute('height','43');
    await expect(restored.getByTestId('frame-A')).toContainText(registry.exposures.S13.date_avg);await expect(restored.getByTestId('frame-B')).toContainText(registry.exposures.S14.date_avg);
    await panel(restored).getByRole('button',{name:'Evidence',exact:true}).click();await expect(panel(restored).locator('#assessment')).toHaveValue(judgment);await expect(restored.getByTestId('evidence-id')).toHaveText(evidenceId);
    await testInfo.attach('dev025-generic-native-restore.json',{body:JSON.stringify({result_id:comparison.result_id,evidence_id:evidenceId,observation_ids:['S13','S14'],cutout_shape:[43,81],source_sha256:comparison.frames.map(frame=>frame.provenance.sha256),spectral_calibration_verified:true,restored_in_clean_context:true}),contentType:'application/json'});
  }finally{await fresh.close();}
});
