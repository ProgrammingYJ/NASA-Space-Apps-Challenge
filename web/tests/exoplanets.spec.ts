import {test,expect} from '@playwright/test';

test('all public exoplanets are searchable and a seven-planet system has explicit illustrative surfaces',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon'))errors.push(message.text());});
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  await page.getByTestId('open-exoplanet-catalog').click();const explorer=page.getByTestId('exoplanet-explorer');await expect(explorer).toBeVisible();
  await expect(explorer).toContainText('6470 public entries');
  const index=await(await page.request.get('/api/v1/catalog/exoplanets')).json();expect(index.objects).toHaveLength(6470);
  await page.locator('#exo-search').fill('TRAPPIST-1');await expect(explorer.getByRole('option')).toHaveCount(7);
  const selected=index.objects.find((row:{name:string})=>row.name==='TRAPPIST-1 e');
  await page.getByTestId(`catalog-${selected.object_id}`).click();const detail=page.getByTestId('exoplanet-detail');await expect(detail.getByRole('heading')).toHaveText('TRAPPIST-1 e');
  await expect(page.getByTestId('exoplanet-scene')).toHaveAttribute('data-selected-object',selected.object_id);
  await expect(page.getByTestId('exoplanet-scene')).toHaveAttribute('data-surface-status','unresolved_illustration');
  await expect(detail).toContainText('not observed surfaces');await expect(detail).toContainText('phase are assumed');await expect(detail).toContainText('6.101013');
  await expect(page.locator('[data-testid^=exo-label-]')).toHaveCount(7);
  await page.waitForTimeout(1500);await page.screenshot({path:'../var/browser-results/exoplanet-trappist-1-e.png'});
  const before=Date.parse((await page.getByTestId('exoplanet-scene').getAttribute('data-model-epoch'))!);await page.getByTestId('timeline-play-toggle').click();
  await expect.poll(async()=>Date.parse((await page.getByTestId('exoplanet-scene').getAttribute('data-model-epoch'))!)).toBeGreaterThan(before+3600000);await page.getByTestId('timeline-play-toggle').click();
  await explorer.getByRole('button',{name:'Return to Solar System',exact:true}).click();await expect(explorer).toBeHidden();await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-scene-active','true');
  expect(errors.filter(message=>!message.includes('Failed to load resource: the server responded with a status of 404'))).toEqual([]);
});
