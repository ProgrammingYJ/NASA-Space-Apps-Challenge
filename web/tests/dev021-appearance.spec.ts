import {test,expect,type Locator,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';

interface MapSource {texture_url:string;sha256:string;bytes:number;map_color_type:string;source:{url:string}}
interface AppearanceResponse {source_manifest_sha256:string;objects:Record<string,MapSource>}
const cases=[
  {id:'neptune',sha:'2a02260a5f975535159f624810a8a1c13b50cdab4de0a54f3acd53652f4fa991'},
  {id:'uranus',sha:'2f21f8ff7733df38c0bd1b3b8c34ba39d82d8abc35a0166d9cde0413454be404'},
];
const policyCases=[
  {language:'ko',marked:'0채널도 유효한 자료일 수 있으며',original:'두 모드 모두 원본 이미지는 바꾸지 않습니다'},
  {language:'en',marked:'Zero channels can also be valid data',original:'The original image is unchanged in both modes'},
  {language:'ja',marked:'0のチャンネルにも有効なデータが含まれ得ます',original:'どちらのモードも原画像は変更しません'},
  {language:'zh-Hant',marked:'零通道也可能是有效資料',original:'兩種模式都不更改原始影像'},
  {language:'fr',marked:'Un canal nul peut être valide',original:'L’image originale reste inchangée dans les deux modes'},
];

async function selectBody(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId('search-'+id).click();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');
}

async function dimensions(label:Locator){
  return {
    physical:Number(await label.getAttribute('data-physical-reference-radius-km')),
    display:Number(await label.getAttribute('data-display-radius')),
    geometry:Number(await label.getAttribute('data-mesh-geometry-radius')),
    world:Number(await label.getAttribute('data-mesh-world-radius')),
  };
}

async function unchangedGeometry(label:Locator,before:Awaited<ReturnType<typeof dimensions>>){
  const after=await dimensions(label);
  expect(after.physical).toBe(before.physical);expect(after.display).toBe(before.display);
  expect(after.geometry).toBeCloseTo(before.geometry,9);expect(after.world).toBeCloseTo(before.world,7);
  await expect(label).toHaveAttribute('data-body-group-scale','1,1,1');
  await expect(label).toHaveAttribute('data-surface-mesh-scale','1,1,1');
}

for(const entry of cases){
  test(`${entry.id}: display caution and original modes preserve the published RGB source and body size in five languages`,async({page},testInfo)=>{
    test.setTimeout(120000);
    const errors:string[]=[],states:unknown[]=[];
    page.on('pageerror',error=>errors.push('pageerror: '+error.message));
    page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
    await page.emulateMedia({reducedMotion:'reduce'});
    const beforeResponse=await page.request.get('/api/v1/appearance');expect(beforeResponse.ok()).toBe(true);
    const before=await beforeResponse.json() as AppearanceResponse,source=before.objects[entry.id];
    expect(source.map_color_type).toBe('published_rgb_composite');expect(source.sha256).toBe(entry.sha);
    const originalResponse=await page.request.get(source.texture_url);expect(originalResponse.ok()).toBe(true);
    const originalBytes=await originalResponse.body();expect(originalBytes.length).toBe(source.bytes);
    expect(createHash('sha256').update(originalBytes).digest('hex')).toBe(entry.sha);
    await originalResponse.dispose();
    try{
      await page.goto('/');
      // Keep this visual QA to one balanced renderer with no 8,000-point layer.
      await page.getByTestId('settings-toggle').click();
      await expect(page.getByTestId('render-preset')).toHaveValue('balanced');
      await page.getByTestId('outer-tno-toggle').uncheck();
      await page.getByTestId('settings-toggle').click();
      await selectBody(page,entry.id);
      const label=page.getByTestId('object-label-'+entry.id),mode=page.getByTestId('appearance-coverage'),policy=page.getByTestId('appearance-coverage-policy');
      await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:45000});
      await mode.selectOption('marked');
      await expect(label).toHaveAttribute('data-coverage-overlay','ready');
      await expect(mode).toHaveValue('marked');await expect(label).toHaveAttribute('data-coverage-mode','marked');
      const size=await dimensions(label);for(const value of Object.values(size))expect(value).toBeGreaterThan(0);
      for(const words of policyCases){
        await page.getByTestId('language').selectOption(words.language);
        await mode.selectOption('original');await expect(label).toHaveAttribute('data-coverage-mode','original');
        await expect(policy).toContainText(words.original);await unchangedGeometry(label,size);
        states.push({language:words.language,mode:'original',policy:await policy.textContent(),size:await dimensions(label)});
        await mode.selectOption('marked');await expect(label).toHaveAttribute('data-coverage-mode','marked');
        await expect(label).toHaveAttribute('data-coverage-overlay','ready');
        await expect(policy).toContainText(words.marked);await expect(policy).not.toContainText(/undefined|NaN|coverageCopy\./);
        await unchangedGeometry(label,size);
        states.push({language:words.language,mode:'marked',policy:await policy.textContent(),size:await dimensions(label)});
      }
      await page.getByTestId('language').selectOption('en');
      await expect(policy).toContainText('this is not a scientific quality or missing-data mask');
      await expect(page.getByTestId('source-map-note').getByRole('link')).toHaveAttribute('href',source.source.url);
      await policy.scrollIntoViewIfNeeded();
      const screenshot=testInfo.outputPath(entry.id+'-display-caution.png');
      await page.screenshot({path:screenshot});await testInfo.attach(entry.id+'-display-caution.png',{path:screenshot,contentType:'image/png'});
      const afterResponse=await page.request.get('/api/v1/appearance');expect(afterResponse.ok()).toBe(true);
      const after=await afterResponse.json() as AppearanceResponse;
      expect(after.source_manifest_sha256).toBe(before.source_manifest_sha256);expect(after.objects[entry.id]).toEqual(source);
      const afterImage=await page.request.get(source.texture_url);expect(afterImage.ok()).toBe(true);
      expect(createHash('sha256').update(await afterImage.body()).digest('hex')).toBe(entry.sha);await afterImage.dispose();
      await expect(label).toHaveAttribute('data-appearance-state','ready');expect(errors).toEqual([]);
    }finally{
      await testInfo.attach(entry.id+'-coverage-source-and-geometry.json',{body:JSON.stringify({object_id:entry.id,source_sha256:entry.sha,appearance_manifest_sha256:before.source_manifest_sha256,states,errors,visual_review_required:'A person must inspect the attached PNG: hatching is a screen-space caution overlay, not observed atmospheric structure. Zero channels can be valid; no scientific missing-data classification is asserted.',visual_review_completed:false},null,2),contentType:'application/json'});
    }
  });
}
