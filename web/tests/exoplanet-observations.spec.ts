import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
interface Photo {object_id:string;planet_name:string;observation_id:string;image_url:string;publication_date:string;credit:string;source:{url:string};license:{url:string;name:string}}
const photos=(JSON.parse(readFileSync(new URL('../../data/manifests/exoplanet_observations.json',import.meta.url),'utf8')) as {observations:Photo[]}).observations;
const words=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
const panel=(page:Page)=>page.getByTestId('exoplanet-observations');
async function open(page:Page){await page.goto('/');await page.getByTestId('language').selectOption('en');await page.getByTestId('open-exoplanet-catalog').click();await expect(page.getByTestId('exoplanet-explorer')).toBeVisible();}
async function choose(page:Page,name:string,id:string){await page.locator('#exo-search').fill(name);await page.getByTestId('catalog-'+id).click();await expect(page.getByTestId('exoplanet-detail').getByRole('heading',{level:2})).toHaveText(name);await expect(panel(page)).toHaveAttribute('data-object-id',id);}
async function loaded(page:Page){const image=panel(page).getByTestId('exoplanet-observation-image');await expect(image).toBeVisible();await expect.poll(()=>image.evaluate(node=>(node as HTMLImageElement).complete&&(node as HTMLImageElement).naturalWidth>0)).toBe(true);return image;}

test('three adopted telescope images load with exact credit and rights, remain unresolved surfaces, and open a real image viewer',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await open(page);expect(photos).toHaveLength(3);
  for(const photo of photos){
    await choose(page,photo.planet_name,photo.object_id);const image=await loaded(page);await expect(image).toHaveAttribute('src',photo.image_url);
    await expect(panel(page)).toContainText(photo.credit);await expect(panel(page)).toContainText(photo.publication_date);await expect(panel(page)).toContainText(words('en').exoObservedNote);
    await expect(panel(page).locator('a[href="'+photo.source.url+'"]')).toBeVisible();await expect(panel(page).locator('a[href="'+photo.license.url+'"]')).toHaveText(photo.license.name+' ↗');
    await image.click();const viewer=page.getByTestId('exoplanet-observation-viewer');await expect(viewer).toBeVisible();await expect(viewer.getByTestId('exoplanet-observation-image')).toHaveAttribute('src',photo.image_url);await expect(viewer).toContainText(photo.credit);await expect(viewer).toContainText(words('en').exoObservedNote);
    await page.screenshot({path:'../var/qa/dev009-observed-'+photo.observation_id+'.png'});await page.keyboard.press('Escape');await expect(viewer).toHaveCount(0);await expect(panel(page).getByRole('button',{name:words('en').exoObservedExpand,exact:true})).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('non-adopted confirmed planets show an explicit empty state and five locales keep observation limits and model dates separate',async({page})=>{
  test.setTimeout(90000);await open(page);const photo=photos[0];await choose(page,photo.planet_name,photo.object_id);await loaded(page);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){await page.getByTestId('language').selectOption(locale);await expect(panel(page)).toContainText(words(locale).exoObservedNote);await expect(panel(page).getByRole('heading',{level:3})).toHaveText(words(locale).exoObservedTitle);}
  await page.getByTestId('language').selectOption('en');await expect(page.getByTestId('model-time-range')).toHaveAttribute('min',/^-/);await page.locator('#model-epoch').fill('2026-01-01T00:00');await page.locator('#model-epoch').press('Enter');
  await expect(page.getByTestId('unified-timeline')).toHaveAttribute('data-time-source','simulation');await expect(panel(page)).toContainText(photo.publication_date);await expect(panel(page).getByTestId('exoplanet-observation-image')).toHaveAttribute('src',photo.image_url);
  const catalog=await(await page.request.get('/api/v1/catalog/exoplanets')).json();const other=catalog.objects.find((row:{name:string})=>row.name==='TRAPPIST-1 f');await choose(page,other.name,other.object_id);
  await expect(page.getByTestId('exoplanet-observation-empty')).toHaveText(words('en').exoObservedEmpty);await expect(panel(page).getByTestId('exoplanet-observation-image')).toHaveCount(0);
  await page.screenshot({path:'../var/qa/dev009-observed-empty.png'});
});

test('an image network failure exposes retry and retrieves the same published asset without creating a substitute',async({page})=>{
  const photo=photos[0];let fail=true;await page.route('**'+photo.image_url+'*',route=>fail?route.abort('failed'):route.continue());
  await open(page);await choose(page,photo.planet_name,photo.object_id);await expect(panel(page).getByRole('alert')).toContainText(words('en').exoObservedError);await expect(panel(page).getByTestId('exoplanet-observation-image')).toHaveCount(0);
  fail=false;await panel(page).getByRole('button',{name:words('en').retry,exact:true}).click();const image=await loaded(page);await expect(image).toHaveAttribute('src',photo.image_url+'?retry=1');await expect(panel(page)).toContainText(photo.credit);
});

test('a delayed previous selection cannot display its image beneath the newly selected planet',async({page})=>{
  test.setTimeout(90000);const first=photos[0],second=photos[1];const response=await page.request.get('/api/v1/catalog/exoplanet-observations?object_id='+first.object_id);expect(response.ok()).toBeTruthy();const original=await response.json();
  let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});const request=page.waitForRequest(request=>request.url().endsWith('/catalog/exoplanet-observations?object_id='+first.object_id));
  await page.route('**/api/v1/catalog/exoplanet-observations?object_id='+first.object_id,async route=>{await held;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(original)});});
  try {await open(page);await choose(page,first.planet_name,first.object_id);await request;await choose(page,second.planet_name,second.object_id);await loaded(page);release();await expect(panel(page)).toHaveAttribute('data-object-id',second.object_id);await expect(panel(page).getByTestId('exoplanet-observation-image')).toHaveAttribute('src',second.image_url);await expect(panel(page)).not.toContainText(first.credit);}
  finally {release();}
});
