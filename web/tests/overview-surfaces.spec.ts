import {test,expect,type Page} from '@playwright/test';

const scene=(page:Page)=>page.getByTestId('universe-scene');
async function geometry(page:Page,id:string){return page.getByTestId(`object-label-${id}`).evaluate(element=>({radius:element.getAttribute('data-display-radius'),physical:element.getAttribute('data-physical-reference-radius-km'),mesh:element.getAttribute('data-mesh-geometry-radius'),world:element.getAttribute('data-mesh-world-radius'),group:element.getAttribute('data-body-group-scale'),scale:element.getAttribute('data-surface-mesh-scale')}));}

test('unselected planets already display sourced overview maps and camera distance promotes detail without changing body size',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|GLSL|shader|CONTEXT_LOST/i.test(message.text()))errors.push(message.text());});
  await page.goto('/');await expect(scene(page)).toHaveAttribute('data-camera-mode','overview');
  for(const id of ['earth','jupiter','saturn']){
    const label=page.getByTestId(`object-label-${id}`);await expect(label).toHaveAttribute('aria-pressed','false');await expect(label).toHaveAttribute('data-surface-representation','published_map');await expect(label).toHaveAttribute('data-appearance-state','ready',{timeout:60000});await expect(label).toHaveAttribute('data-texture-lod','overview');
    const dimensions=(await label.getAttribute('data-display-texture-dimensions'))!.split(',').map(Number);expect(Math.max(...dimensions)).toBeLessThanOrEqual(1024);
  }
  const before=await geometry(page,'earth');
  await page.screenshot({path:'../var/qa/dev015-unselected-overview.png'});
  // A canvas wheel zoom changes camera distance while the selection stays empty.
  const earth=page.getByTestId('object-label-earth');const origin=(await earth.getAttribute('data-world-position'))!.split(',').map(Number);
  const eye=(await scene(page).getAttribute('data-camera-position'))!.split(',').map(Number);
  const target=(await scene(page).getAttribute('data-camera-target'))!.split(',').map(Number);
  await page.getByTestId('universe-canvas').hover();await page.mouse.wheel(0,-1800);
  await expect(scene(page)).toHaveAttribute('data-camera-mode','manual');await expect(earth).toHaveAttribute('aria-pressed','false');expect(await geometry(page,'earth')).toEqual(before);
  // Selection forces detailed samples, but can never change the mesh scale/radius.
  await page.locator('#universe-search').fill('earth');await page.getByTestId('search-earth').click();await expect(scene(page)).toHaveAttribute('data-camera-mode','focused');await expect(earth).toHaveAttribute('data-texture-lod','detail');await expect(earth).toHaveAttribute('data-appearance-state','ready');expect(await geometry(page,'earth')).toEqual(before);
  const dimensions=(await earth.getAttribute('data-display-texture-dimensions'))!.split(',').map(Number);expect(Math.max(...dimensions)).toBeLessThanOrEqual(4096);expect(Math.max(...dimensions)).toBeGreaterThan(1024);
  await testInfo.attach('overview-geometry.json',{body:JSON.stringify({before,selected:await geometry(page,'earth'),initialEye:eye,initialTarget:target,earthPosition:origin,dimensions}),contentType:'application/json'});expect(errors).toEqual([]);
});
