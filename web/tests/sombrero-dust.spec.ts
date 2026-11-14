import {test,expect} from '@playwright/test';

test('Sombrero dust remains an embedded disk from the source focus and after camera rotation',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.locator('#universe-search').fill('galaxy-m104');await page.getByTestId('search-galaxy-m104').click();
  const scene=page.getByTestId('universe-scene');await expect(scene).toHaveAttribute('data-camera-mode','focused');
  await expect(page.getByTestId('object-label-galaxy-m104')).toHaveAttribute('data-galaxy-renderer','edge_on_dust_disk');
  await page.screenshot({path:'../var/qa/dev015-sombrero-source-view.png'});
  const before=await scene.getAttribute('data-camera-position'),bounds=await scene.locator('canvas').boundingBox();expect(bounds).not.toBeNull();
  const x=bounds!.x+bounds!.width*.5,y=bounds!.y+bounds!.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+190,y+85,{steps:20});await page.mouse.up();
  await expect(scene).toHaveAttribute('data-camera-mode','manual');await expect.poll(()=>scene.getAttribute('data-camera-position')).not.toBe(before);
  await page.screenshot({path:'../var/qa/dev015-sombrero-rotated-view.png'});
  expect(errors).toEqual([]);
});
