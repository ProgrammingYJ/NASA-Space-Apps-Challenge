import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const words=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;

test('visible discovery opens an actual LMC star, reports acquired coverage and drills into real TRAPPIST-1 planets',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  await expect(page.getByTestId('catalog-discovery')).toBeVisible();
  await page.getByTestId('discover-extragalactic-star').click();
  const explorer=page.getByTestId('universe-catalog-explorer');await expect(explorer).toBeVisible();
  await expect(page.getByTestId('universe-parent-galaxy')).toHaveValue('galaxy-lmc');
  await expect(page.getByTestId('universe-catalog-map')).toHaveAttribute('data-selected-object','member-lmc-r136a1');
  await expect(page.getByTestId('universe-catalog-detail').getByRole('heading',{name:'R136a1',exact:true})).toBeVisible();
  await expect(page.getByTestId('catalog-galaxy-coverage')).toContainText('Acquired object records: 4');
  await expect(page.getByTestId('catalog-galaxy-coverage')).toContainText('Star / brown-dwarf / stellar-system records: 1');
  await expect(page.getByTestId('catalog-galaxy-coverage')).toContainText('Acquired confirmed-planet entries: 0');
  await expect(page.getByTestId('universe-catalog-detail').locator('a[href^="https://"]')).not.toHaveCount(0);
  await page.screenshot({path:'../var/qa/catalog-discovery-lmc.png'});
  await page.getByTestId('catalog-galaxy-m31').click();
  await expect(page.getByTestId('catalog-galaxy-coverage')).toContainText('Acquired object records: 1');
  await expect(page.getByTestId('catalog-galaxy-coverage')).toContainText('Star / brown-dwarf / stellar-system records: 0');
  await page.getByTestId('catalog-mode-planets').click();await expect(page.getByTestId('confirmed-extragalactic-empty')).toBeVisible();
  await expect(explorer.locator('[data-testid^="universe-entry-"]')).toHaveCount(0);
  await page.getByTestId('catalog-example-trappist').click();
  await expect(page.getByTestId('universe-parent-galaxy')).toHaveValue('galaxy-milky-way');
  const detail=page.getByTestId('universe-catalog-detail');await expect(detail.getByRole('heading',{name:'TRAPPIST-1',exact:true})).toBeVisible();
  await expect(detail.locator('[data-testid^="universe-child-"]')).toHaveCount(7);
  await detail.getByRole('button',{name:'TRAPPIST-1 f ↗',exact:true}).click();
  await expect(page.getByTestId('exoplanet-detail').getByRole('heading',{name:'TRAPPIST-1 f',exact:true})).toBeVisible();
  await expect(page.getByTestId('exoplanet-scene')).toHaveAttribute('data-camera-mode','focused');
  await expect(page.getByTestId('exoplanet-scene')).toHaveAttribute('data-surface-status','unresolved_illustration');
  expect(errors).toEqual([]);
});

test('catalog host directions are opt-in and discovery plus layer explanations are translated in all five locales',async({page})=>{
  test.setTimeout(90000);const catalogueRequests:string[]=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/api/v1/catalog/exoplanets')catalogueRequests.push(request.url());});await page.goto('/');const scene=page.getByTestId('universe-scene');
  await expect(page.getByTestId('object-label-earth')).toHaveCount(1);expect(catalogueRequests).toHaveLength(0);
  await expect(scene).toHaveAttribute('data-sky-star-count','0');
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const text=words(locale);await page.getByTestId('language').selectOption(locale);
    await expect(page.getByTestId('discover-stars-planets')).toContainText(text.catalogExploreTitle);
    await expect(page.getByTestId('discover-extragalactic-star')).toContainText(text.catalogVisitR136a1);
    await expect(page.getByTestId('open-historical-comets')).toHaveText(text.historicalComets);
    await page.getByTestId('settings-toggle').click();
    const toggle=page.getByTestId('catalog-star-toggle');await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId('catalog-star-layer-note')).toHaveText(text.catalogStarLayerNote);
    await toggle.check();await expect.poll(async()=>Number(await scene.getAttribute('data-sky-star-count'))).toBeGreaterThan(1000);
    await toggle.uncheck();await expect(scene).toHaveAttribute('data-sky-star-count','0');
    await page.getByTestId('settings-toggle').click();
  }
  await expect(page.locator('body')).not.toContainText(/catalogStarLayer|catalogExploreTitle|undefined|NaN/);
});

test('M31 focuses on its own centre with the sourced inclined disk and the host-direction overlay off',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');const scene=page.getByTestId('universe-scene');
  await expect(scene).toHaveAttribute('data-sky-star-count','0');
  await page.locator('#universe-search').fill('galaxy-m31');await page.getByTestId('search-galaxy-m31').click();
  await expect(scene).toHaveAttribute('data-camera-mode','focused');await expect(scene).toHaveAttribute('data-focused-object','galaxy-m31');
  const label=page.getByTestId('object-label-galaxy-m31');await expect(label).toHaveAttribute('data-galaxy-renderer','inclined_spiral');
  await expect(label).toHaveAttribute('data-inclination-deg','77');expect(Number(await label.getAttribute('data-axis-ratio'))).toBeLessThan(.4);
  const centre=(await label.getAttribute('data-world-position'))!.split(',').map(Number);
  const target=(await scene.getAttribute('data-camera-target'))!.split(',').map(Number);
  for(let axis=0;axis<3;axis++)expect(Math.abs(centre[axis]-target[axis])).toBeLessThan(.0001);
  await expect(scene).toHaveAttribute('data-sky-star-count','0');await expect(page.getByTestId('galaxy-panel')).toBeVisible();
  await page.screenshot({path:'../var/qa/catalog-discovery-m31-focused.png'});expect(errors).toEqual([]);
});

test('galaxy references and their setting survive year 2000, astronomical zero and 2500 without claiming past reconstruction',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const scene=page.getByTestId('universe-scene');const clock=page.locator('#model-epoch');
  await expect(clock).toBeEnabled();await expect(scene).toHaveAttribute('data-galaxy-count','9');
  await page.getByTestId('timeline-rate').selectOption('72');
  let reference='';
  for(const year of ['2000','0000','2500']){
    await clock.fill(year+'-01-01T00:00');await clock.press('Enter');
    await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source','simulation');
    await expect(scene).toHaveAttribute('data-galaxy-count','9');await expect(page.getByTestId('galaxies-fixed-reference-note')).toBeVisible();
    await page.locator('#universe-search').fill('galaxy-m31');await page.getByTestId('search-galaxy-m31').click();
    await expect(scene).toHaveAttribute('data-camera-mode','focused');await expect(scene).toHaveAttribute('data-focused-object','galaxy-m31');
    const label=page.getByTestId('object-label-galaxy-m31');await expect(label).toHaveAttribute('data-galaxy-renderer','inclined_spiral');
    const next=(await label.getAttribute('data-source-position-au'))!;if(reference)expect(next).toBe(reference);else reference=next;
    await expect(page.getByTestId('galaxy-fixed-reference-note')).toHaveText(words('en').galaxyFixedReferenceNote);
    await page.getByTestId('settings-toggle').click();await page.getByTestId('galaxies-toggle').uncheck();await expect(scene).toHaveAttribute('data-galaxy-count','0');
    await page.getByTestId('galaxies-toggle').check();await expect(scene).toHaveAttribute('data-galaxy-count','9');await page.getByTestId('settings-toggle').click();
    await expect(scene).toHaveAttribute('data-sky-star-count','0');
  }
  for(const locale of ['ko','en','ja','zh-Hant','fr']){await page.getByTestId('language').selectOption(locale);await expect(page.getByTestId('galaxy-fixed-reference-note')).toHaveText(words(locale).galaxyFixedReferenceNote);}
  await clock.fill('2026-11-14T00:00');await clock.press('Enter');await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source','ephemeris');
  await expect(scene).toHaveAttribute('data-galaxy-count','9');await expect(scene).toHaveAttribute('data-selected-object','galaxy-m31');await expect(page.getByTestId('timeline-rate')).toHaveValue('72');
  expect(await page.getByTestId('object-label-galaxy-m31').getAttribute('data-source-position-au')).toBe(reference);expect(errors).toEqual([]);
  await page.screenshot({path:'../var/qa/catalog-discovery-galaxies-time.png'});
});
