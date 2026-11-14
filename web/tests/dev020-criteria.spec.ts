import {test,expect,type Page} from '@playwright/test';

async function select(page:Page,id:string){
  await page.locator('#universe-search').fill(id);
  await page.getByTestId('search-'+id).click();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);
}

test('a generic observed TNO opens sourced criteria, orbit and missing mass without inventing a density or planet classification',async({page})=>{
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const calculations:string[]=[];
  page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/mass-scenarios/calculate'))calculations.push(request.postData()??'');});
  await select(page,'sbdb-54538127');
  await page.getByTestId('open-planet-criteria').click();
  const dialog=page.getByTestId('planet-criteria-dialog');
  await expect(dialog).toHaveAttribute('data-generic-tno','true');
  await expect(dialog.getByTestId('criteria-official-class')).toContainText('planet status unconfirmed');
  await expect(dialog.getByTestId('criterion-orbits_sun')).toHaveAttribute('data-status','met');
  for(const id of ['equilibrium_shape','orbital_dominance'])await expect(dialog.getByTestId('criterion-'+id)).toHaveAttribute('data-status','unknown');
  await expect(dialog.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','unavailable');
  await expect(dialog.getByTestId('criteria-pi')).toContainText('primary mass');
  await expect(dialog.getByTestId('criteria-mass-availability')).toContainText('diameter and bulk density are unavailable');
  await expect(dialog.getByTestId('mass-scenario-panel')).toHaveCount(0);
  await expect(dialog.getByTestId('criteria-orbit-diagram')).toBeVisible();
  await expect(dialog.getByTestId('criteria-mass-availability').getByRole('link')).toHaveAttribute('href',/ssd\.jpl\.nasa\.gov/);
  await expect(dialog.getByTestId('criteria-clearing-model').getByRole('link').filter({hasText:'Margot'})).toHaveAttribute('href','https://arxiv.org/html/2407.07590v1');
  for(const language of ['ko','en','ja','zh-Hant','fr']){
    await page.keyboard.press('Escape');
    await page.getByTestId('language').selectOption(language);
    await page.getByTestId('open-planet-criteria').click();
    await expect(dialog.getByTestId('criterion-equilibrium_shape')).toHaveAttribute('data-status','unknown');
    await expect(dialog).not.toContainText(/undefined|NaN|criteriaReason_r029|criteriaClass_small_body/);
    expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
  }
  expect(calculations).toEqual([]);
  await page.keyboard.press('Escape');await expect(page.getByTestId('open-planet-criteria')).toBeFocused();
});

test('a missing mean anomaly does not erase the independent solar-orbit evidence or its source ellipse',async({page})=>{
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const response=await page.request.get('/api/v1/catalog/outer-tno');
  const catalog=await response.json() as {objects:Array<{object_id:string;name:string;orbit:unknown}>};
  const missing=catalog.objects.find(row=>row.name.includes('2002 PD153'));
  expect(missing).toBeTruthy();expect(missing!.orbit).toBeNull();
  await select(page,missing!.object_id);await page.getByTestId('open-planet-criteria').click();
  const dialog=page.getByTestId('planet-criteria-dialog');
  await expect(dialog.getByTestId('criterion-orbits_sun')).toHaveAttribute('data-status','met');
  await expect(dialog.getByTestId('criterion-orbits_sun')).toContainText('missing orbital phase');
  await expect(dialog.getByTestId('criteria-orbit-diagram')).toHaveAttribute('data-eccentricity','0');
  await expect(dialog.getByTestId('criteria-minimum-mass')).toHaveAttribute('data-current-mass-kind','unavailable');
  await expect(dialog.getByTestId('criteria-pi')).toContainText('primary mass');
});
