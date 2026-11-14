import {test,expect} from '@playwright/test';

test('a failed detail decode retains the verified overview and a later selection recovers',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await page.getByTestId('language').selectOption('en');
  const label=page.getByTestId('object-label-pluto');
  await expect(label).toHaveAttribute('data-appearance-state','ready');
  await expect(label).toHaveAttribute('data-texture-max-dimension','1024');
  const radius=await label.getAttribute('data-mesh-world-radius');
  await page.evaluate(()=>{
    const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src')!;
    let armed=true;
    Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value:string){
      if(armed&&value.startsWith('blob:')){armed=false;Object.defineProperty(HTMLImageElement.prototype,'src',descriptor);queueMicrotask(()=>this.dispatchEvent(new Event('error')));return;}
      descriptor.set!.call(this,value);
    }});
  });
  await page.locator('#universe-search').fill('pluto');await page.getByTestId('search-pluto').click();
  await expect(label).toHaveAttribute('data-lod-state','retained_after_error');
  await expect(label).toHaveAttribute('data-appearance-state','ready');
  await expect(label).toHaveAttribute('data-mesh-world-radius',radius!);
  await expect(page.getByRole('status').filter({hasText:'previous verified overview map'})).toContainText('previous verified overview map');
  await page.getByTestId('appearance-lighting').selectOption('solar');
  await expect(label).toHaveAttribute('data-appearance-lighting','solar');
  await page.getByTestId('unified-timeline').getByRole('button',{name:'Solar system overview',exact:true}).click();
  await expect(label).toHaveAttribute('data-texture-max-dimension','1024');
  await page.locator('#universe-search').fill('pluto');await page.getByTestId('search-pluto').click();
  await expect(label).toHaveAttribute('data-lod-state','ready');
  await expect(label).toHaveAttribute('data-display-texture-dimensions','4096,2048');
  await expect(label).toHaveAttribute('data-mesh-world-radius',radius!);
  await testInfo.attach('retained-map-recovery.json',{body:JSON.stringify({forced_failure:'one HTML image decode',retained_ready_overview:true,recovered_detail:true,unchanged_radius:radius}),contentType:'application/json'});
});

test('published Neptune and Saturn maps remain visually inspectable',async({page},testInfo)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  for(const id of ['neptune','saturn']){
    await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
    await expect(page.getByTestId('object-label-'+id)).toHaveAttribute('data-appearance-state','ready');
    await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');
    await page.screenshot({path:testInfo.outputPath(id+'-inspection.png')});
  }
});
