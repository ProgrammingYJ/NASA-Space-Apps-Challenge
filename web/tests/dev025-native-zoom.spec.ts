import {test,expect,type Page} from '@playwright/test';
import {smallBodySimulationCopy} from '../src/SmallBodySimulationCopy';

const scene=(page:Page)=>page.getByTestId('universe-scene');
const label=(page:Page,id:string)=>page.getByTestId('object-label-'+id);
const marker=(page:Page,id:string)=>page.getByTestId('object-position-marker-'+id);
const vector=(value:string|null)=>value!.split(',').map(Number);
const distance=(a:number[],b:number[])=>Math.hypot(...a.map((value,index)=>value-b[index]));

async function choose(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(scene(page)).toHaveAttribute('data-selected-object',id);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
}

async function wheelOut(page:Page){
  const canvas=page.getByTestId('universe-canvas'),bounds=await canvas.boundingBox();expect(bounds).toBeTruthy();
  await page.mouse.move(bounds!.x+bounds!.width*.4,bounds!.y+bounds!.height*.45);
  for(let index=0;index<9;index++){
    await page.mouse.wheel(0,5000);
    if(await scene(page).evaluate(element=>{
      const a=element.getAttribute('data-camera-position')?.split(',').map(Number),b=element.getAttribute('data-camera-target')?.split(',').map(Number);
      return a&&b&&Math.hypot(...a.map((value,i)=>value-b[i]))>=2e6;
    }))break;
  }
  await expect(scene(page)).toHaveAttribute('data-camera-mode','manual');
  await expect.poll(async()=>distance(vector(await scene(page).getAttribute('data-camera-position')),vector(await scene(page).getAttribute('data-camera-target')))).toBeGreaterThanOrEqual(2e6);
}

test('DEV-025: wheel zoom-out keeps source-centred native position markers clickable without resizing bodies or camera-on-date rescaling',async({page},testInfo)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByTestId('language').selectOption('en');await choose(page,'eris');
  await expect(scene(page)).toHaveAttribute('data-distance-algorithm','parent-linear-distance-v1');
  await expect(scene(page)).toHaveAttribute('data-distance-origin-object-id','eris');
  const radiusBefore=await label(page,'eris').getAttribute('data-mesh-world-radius');
  await expect(marker(page,'eris')).toBeHidden();
  await wheelOut(page);
  await expect(marker(page,'eris')).toBeVisible();
  await expect(marker(page,'sun')).toBeVisible();
  await expect(page.getByTestId('native-position-marker-legend')).toBeVisible();
  await expect(page.getByTestId('native-position-marker-legend')).toContainText('not actual size or brightness');
  expect(Number(await marker(page,'eris').getAttribute('data-projected-body-diameter-px'))).toBeLessThan(3);
  expect(await label(page,'eris').getAttribute('data-mesh-world-radius')).toBe(radiusBefore);
  await expect(label(page,'eris')).toHaveAttribute('data-body-group-scale','1,1,1');
  await expect(scene(page)).toHaveAttribute('data-camera-far','100000000');

  const epochs=[];
  for(const date of ['1371-01-01T00:00:00','2035-01-01T00:00:00','3000-01-01T00:00:00']){
    // Wheel navigation cancelled follow: changing the date must not fit the
    // camera or switch the single linear coordinate scale behind the user.
    const cameraBefore=vector(await scene(page).getAttribute('data-camera-position'));
    const input=page.locator('#model-epoch');await input.fill(date);await input.press('Enter');
    await expect(input).toHaveAttribute('aria-invalid','false');
    await expect(scene(page)).toHaveAttribute('data-model-epoch',new Date(date+'Z').toISOString());
    const approximation=page.getByTestId('native-small-body-simulation-note');
    await expect(approximation).toHaveAttribute('data-source-kind','sbdb_osculating_elements');
    await expect(approximation).toHaveAttribute('data-source-epoch-jd-tdb','2461200.5');
    await expect(approximation).toHaveAttribute('data-source-sha256',/^[a-f0-9]{64}$/);
    await expect(approximation).toHaveAttribute('data-long-range-extrapolation',date.startsWith('2035')?'false':'true');
    await expect(page.getByTestId('selected-position-description')).toHaveText(smallBodySimulationCopy('en').tnoDescription);
    await expect(approximation).toContainText(smallBodySimulationCopy('en').note);
    await expect(approximation).toContainText('JD 2461200.5 TDB');
    if(date.startsWith('1371')){
      for(const locale of ['ko','en','ja','zh-Hant','fr'] as const){
        await page.getByTestId('language').selectOption(locale);
        await expect(approximation).toContainText(smallBodySimulationCopy(locale).note);
        await expect(approximation).toContainText(smallBodySimulationCopy(locale).extrapolated);
        await expect(page.getByTestId('selected-position-description')).toHaveText(smallBodySimulationCopy(locale).tnoDescription);
        await expect(approximation.locator('a')).toHaveText(smallBodySimulationCopy(locale).tnoSource+' ↗');
      }
      await page.getByTestId('language').selectOption('en');
    }
    await expect(marker(page,'eris')).toBeVisible();await expect(marker(page,'sun')).toBeVisible();
    await expect(scene(page)).toHaveAttribute('data-distance-scale-per-au','10000');
    expect(distance(cameraBefore,vector(await scene(page).getAttribute('data-camera-position')))).toBeLessThan(.001);
    expect(await label(page,'eris').getAttribute('data-mesh-world-radius')).toBe(radiusBefore);
    const origin=vector(await label(page,'eris').getAttribute('data-source-position-au'));
    const source=vector(await label(page,'sun').getAttribute('data-source-position-au'));
    const world=vector(await label(page,'sun').getAttribute('data-world-position'));
    const relative=source.map((value,index)=>value-origin[index]);
    [relative[0]*10000,relative[2]*10000,-relative[1]*10000].forEach((value,index)=>expect(Math.abs(value-world[index])).toBeLessThan(2e-6));
    epochs.push({date,camera:cameraBefore,origin,source,world});
  }

  // Real pointer input hits a glyph for another native planet. At crowded
  // centres names and keyboard buttons remain available, as in the TNO layer.
  const target=await page.locator('[data-kind="source_centre_navigation_marker"]').evaluateAll(elements=>{
    const planets=new Set(['venus','earth','mars','jupiter','saturn','uranus','neptune','pluto']);
    return elements.filter(element=>!element.hasAttribute('hidden')&&planets.has((element as HTMLElement).dataset.objectId??''))
      .find(element=>{const rect=element.getBoundingClientRect();return document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===element;})?.getAttribute('data-object-id')??null;
  });
  expect(target,'at least one source-centred planet glyph is directly pointer-selectable').toBeTruthy();
  await marker(page,target!).click();await expect(scene(page)).toHaveAttribute('data-selected-object',target!);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');
  await expect(marker(page,target!)).toBeHidden();
  await expect(label(page,target!)).toHaveAttribute('data-appearance-lighting','solar');
  await expect(label(page,target!)).toHaveAttribute('data-body-group-scale','1,1,1');
  // Ceres is not a TNO. Its separately pinned solar r/v model must likewise
  // provide a real source origin in the future, without a radius change.
  await choose(page,'ceres');await expect(scene(page)).toHaveAttribute('data-distance-origin-available','true');
  const ceresApproximation=page.getByTestId('native-small-body-simulation-note');
  await expect(ceresApproximation).toHaveAttribute('data-source-kind','horizons_solar_state_fit');
  await expect(ceresApproximation).toHaveAttribute('data-source-epoch-jd-tdb','2461357.500800726');
  await expect(ceresApproximation).toHaveAttribute('data-source-sha256','6851c4fd5c5389db14ca85944dd7a93c676fa3181a726845af13e3dfd0852d82');
  await expect(ceresApproximation).toHaveAttribute('data-long-range-extrapolation','true');
  await expect(page.getByTestId('selected-position-description')).toHaveText(smallBodySimulationCopy('en').ceresDescription);
  await expect(ceresApproximation).toContainText(smallBodySimulationCopy('en').note);
  await expect(ceresApproximation.locator('a')).toHaveText(smallBodySimulationCopy('en').ceresSource+' ↗');
  const ceresRadius=await label(page,'ceres').getAttribute('data-mesh-world-radius');
  await wheelOut(page);await expect(marker(page,'ceres')).toBeVisible();await expect(marker(page,'sun')).toBeVisible();
  // Matrix decomposition can differ by one floating-point ulp after a wheel
  // update. Compare the physical radius numerically, not its string spelling.
  expect(Number(await label(page,'ceres').getAttribute('data-mesh-world-radius'))).toBeCloseTo(Number(ceresRadius),12);
  await testInfo.attach('dev025-native-position-markers.json',{body:JSON.stringify({radius_before:radiusBefore,clicked_native_planet:target,epochs,marker_semantics:'source-centre navigation; fixed CSS pixels; not disk size, brightness or detection'}),contentType:'application/json'});
});
