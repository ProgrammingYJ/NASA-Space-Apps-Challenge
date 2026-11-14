import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {NASA_REPRESENTATIVE_MAPS} from '../src/NASARepresentativeMaps';
import {appearanceCopy} from '../src/AppearanceCopy';

interface SourceMap {texture_url:string;sha256:string;bytes:number;kind:string;source:{url:string};observation_period:string}
interface Appearance {source_manifest_sha256:string;objects:Record<string,SourceMap>}
const languages=['ko','en','ja','zh-Hant','fr'] as const;
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const scene=(page:Page)=>page.getByTestId('universe-scene');
async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}

test('DEV-022: NASA representative Uranus and Neptune survive rotation while original OPAL bytes remain available',async({page},testInfo)=>{
  test.setTimeout(150000);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('render-preset')).toHaveValue('balanced');
  await page.getByTestId('outer-tno-toggle').uncheck();await page.getByTestId('settings-toggle').click();
  await expect(scene(page)).toHaveAttribute('data-outer-tno-visible','false');
  await expect(scene(page)).toHaveAttribute('data-render-fps-limit','30');
  await expect(scene(page)).toHaveAttribute('data-render-dpr-limit','1.25');
  const response=await page.request.get('/api/v1/appearance',{timeout:15000});expect(response.ok()).toBe(true);
  const before=await response.json() as Appearance;
  const evidence=[];
  for(const id of ['uranus','neptune'] as const){
    const representative=NASA_REPRESENTATIVE_MAPS[id],original=before.objects[id];
    expect(representative.source_url).toBe(`https://science.nasa.gov/resource/${id}-3d-model/`);
    expect(representative.texture_url).not.toBe(original.texture_url);
    // Hash each adopted asset independently, rather than treating a GPU-ready
    // state as proof that the intended published file was served.
    const displayFile=await page.request.get(representative.texture_url,{timeout:15000});expect(displayFile.ok()).toBe(true);
    const displayBytes=await displayFile.body();expect(displayBytes.length).toBe(representative.bytes);expect(hash(displayBytes)).toBe(representative.sha256);await displayFile.dispose();
    const rawFile=await page.request.get(original.texture_url,{timeout:15000});expect(rawFile.ok()).toBe(true);
    const rawBytes=await rawFile.body();expect(rawBytes.length).toBe(original.bytes);expect(hash(rawBytes)).toBe(original.sha256);await rawFile.dispose();
    await choose(page,id);const label=page.getByTestId('object-label-'+id);
    await expect(page.getByTestId('appearance-coverage')).toHaveValue('representative');
    await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
    await expect(label).toHaveAttribute('data-appearance-kind','illustration');
    await expect(label).toHaveAttribute('data-coverage-mode','representative');
    await expect(label).toHaveAttribute('data-coverage-overlay','not_applicable');
    const meshRadius=Number(await label.getAttribute('data-mesh-world-radius'));
    const physicalRadius=Number(await label.getAttribute('data-physical-reference-radius-km'));
    expect(meshRadius).toBeGreaterThan(0);expect(physicalRadius).toBeGreaterThan(0);
    await expect(page.getByTestId('source-map-note').getByRole('link')).toHaveAttribute('href',representative.source_url);
    const cameraAngles=[];
    for(const [angle,dx,dy] of [['front',0,0],['side',145,12],['tilted',-85,105]] as const){
      if(dx||dy){
        const canvas=page.getByTestId('universe-canvas'),box=(await canvas.boundingBox())!;
        const prior=await scene(page).getAttribute('data-camera-position'),x=box.x+box.width*.34,y=box.y+box.height*.48;
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:10});await page.mouse.up();
        await expect(scene(page)).not.toHaveAttribute('data-camera-position',prior!);
      }
      await expect(label).toHaveAttribute('data-appearance-state','ready');
      await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');
      await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');
      expect(Number(await label.getAttribute('data-mesh-world-radius'))).toBeCloseTo(meshRadius,7);
      expect(Number(await label.getAttribute('data-physical-reference-radius-km'))).toBe(physicalRadius);
      cameraAngles.push({angle,position:await scene(page).getAttribute('data-camera-position')});
      // Explicit visual regression evidence, generated only when root executes
      // this spec in normal Chrome; no browser is launched while writing it.
      await page.screenshot({path:testInfo.outputPath(`${id}-representative-${angle}.png`)});
    }
    await page.getByTestId('appearance-coverage').selectOption('original');
    await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
    await expect(label).toHaveAttribute('data-coverage-mode','original');
    await expect(label).toHaveAttribute('data-appearance-kind',original.kind);
    await expect(page.getByTestId('source-map-note').getByRole('link')).toHaveAttribute('href',original.source.url);
    await expect(page.getByTestId('appearance-coverage-policy')).toContainText(appearanceCopy('en').originalNote);
    expect(Number(await label.getAttribute('data-mesh-world-radius'))).toBeCloseTo(meshRadius,7);
    expect(Number(await label.getAttribute('data-physical-reference-radius-km'))).toBe(physicalRadius);
    await page.getByTestId('appearance-coverage').selectOption('representative');
    await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
    await expect(label).toHaveAttribute('data-appearance-kind','illustration');
    await expect(label).toHaveAttribute('data-coverage-overlay','not_applicable');
    for(const language of languages){
      await page.getByTestId('language').selectOption(language);const copy=appearanceCopy(language);
      await expect(page.getByTestId('appearance-coverage')).toHaveValue('representative');
      await expect(page.getByTestId('appearance-coverage-policy')).toContainText(copy.representativeNote);
      await expect(page.getByTestId('source-map-note')).toContainText(copy.representativeNote);
      await expect(page.getByTestId('appearance-info')).not.toContainText(/undefined|NaN/);
    }
    await page.getByTestId('language').selectOption('en');
    await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');
    await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');
    expect(Number(await label.getAttribute('data-mesh-world-radius'))).toBeCloseTo(meshRadius,7);
    const unchanged=await page.request.get('/api/v1/appearance',{timeout:15000});expect(unchanged.ok()).toBe(true);
    const after=await unchanged.json() as Appearance;
    expect(after.source_manifest_sha256).toBe(before.source_manifest_sha256);expect(after.objects[id]).toEqual(original);
    evidence.push({id,representative,original,meshRadius,physicalRadius,cameraAngles});
  }
  expect(errors).toEqual([]);
  await testInfo.attach('dev022-representative-and-original-provenance.json',{body:JSON.stringify({manifest_sha256:before.source_manifest_sha256,balanced:true,tno_layer:false,evidence,errors}),contentType:'application/json'});
});
