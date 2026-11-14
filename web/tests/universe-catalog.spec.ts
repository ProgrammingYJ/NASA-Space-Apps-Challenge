import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs/promises';

const explorer=(page:Page)=>page.getByTestId('universe-catalog-explorer');
const map=(page:Page)=>page.getByTestId('universe-catalog-map');
const detail=(page:Page)=>page.getByTestId('universe-catalog-detail');
const solar=(page:Page)=>page.getByTestId('universe-scene');
const galaxyIds=['galaxy-m31','galaxy-m33','galaxy-m81','galaxy-m87','galaxy-lmc','galaxy-smc','galaxy-m51','galaxy-m104','galaxy-centaurus-a'];
async function open(page:Page,galaxy='galaxy-milky-way'){
  await page.getByTestId('open-universe-catalog').click();await expect(explorer(page)).toBeVisible();
  await page.getByTestId('universe-parent-galaxy').selectOption(galaxy);
  await expect(explorer(page).getByRole('option',{selected:true})).not.toHaveCount(0);
}
async function view(page:Page){return JSON.parse((await map(page).getAttribute('data-view'))!) as {x:number;y:number;width:number;height:number};}
async function select(page:Page,id:string){await page.getByTestId(`universe-entry-${id}`).click();await expect(map(page)).toHaveAttribute('data-selected-object',id);}

test('source-backed G1 selection zooms to its own sky direction and preserves unknown depth in five languages',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await open(page,'galaxy-m31');
  const response=await page.request.get('/api/v1/catalog/universe?galaxy_id=galaxy-m31');expect(response.ok()).toBeTruthy();
  const catalog=await response.json();const g1=catalog.objects.find((o:{object_id:string})=>o.object_id==='member-m31-g1');
  // NASA's release metadata repeats the M31 center. The adopted separate SIMBAD
  // source must instead put G1 in its known 00h32m/+39d35 sky region.
  expect(g1.coordinate.ra_deg).toBeGreaterThan(8.19);expect(g1.coordinate.ra_deg).toBeLessThan(8.20);
  expect(g1.coordinate.dec_deg).toBeGreaterThan(39.57);expect(g1.coordinate.dec_deg).toBeLessThan(39.59);
  expect(g1.galaxy_relative_position_pc).toBeNull();expect(g1.distance_pc).toBeNull();expect(g1.image).toBeNull();expect(g1.appearance).toBeNull();
  await page.locator('#universe-type').selectOption('globular_cluster');await expect(page.getByTestId('universe-entry-member-m31-g1')).toBeVisible();
  const before=await view(page);await select(page,'member-m31-g1');
  await expect(detail(page)).toContainText('8.193885°');await expect(detail(page)).toContainText('39.577918°');await expect(detail(page)).toContainText('ICRS J2000');
  await expect(detail(page).locator(`a[href="${g1.source.url}"]`)).toBeVisible();
  await expect.poll(async()=>{const v=await view(page);const [x,y]=(await map(page).getAttribute('data-target'))!.split(',').map(Number);return Math.abs(v.x+v.width/2-x)+Math.abs(v.y+v.height/2+y);}).toBeLessThan(.000001);
  expect((await view(page)).width).toBeLessThan(before.width*.2);
  const focused=await view(page);await map(page).hover({position:{x:700,y:280}});await page.mouse.wheel(0,-120);
  await expect.poll(async()=>(await view(page)).width).toBeLessThan(focused.width);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    const words=JSON.parse(await fs.readFile(`src/locales/${locale}.json`,'utf8'));await page.getByTestId('language').selectOption(locale);
    await expect(detail(page)).toContainText(words.universeSymbolNote);await expect(detail(page)).toContainText(words.universeDistanceUnknown);
    await expect(explorer(page)).toContainText(words.universeProjectionNote);await expect(page.locator('#universe-type option:checked')).toHaveText(words.universeKind_globular_cluster);
    await detail(page).locator('summary').click();await expect(detail(page)).toContainText(words.universeCompletenessNote);await detail(page).locator('summary').click();
    await expect(explorer(page)).not.toContainText(/universeKind_|undefined|NaN/);
  }
  await page.getByTestId('language').selectOption('en');await page.screenshot({path:'../var/qa/dev008-universe-g1.png'});expect(errors).toEqual([]);
});

test('Milky Way host drilldown exposes seven actual TRAPPIST-1 catalog planets and forwards the chosen planet into its system',async({page})=>{
  test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await open(page);
  const response=await page.request.get('/api/v1/catalog/universe?galaxy_id=galaxy-milky-way');expect(response.ok()).toBeTruthy();
  const catalog=await response.json();const hosts=catalog.objects.filter((o:{kind:string})=>o.kind==='exoplanet_host_system');expect(hosts).toHaveLength(4862);
  const host=hosts.find((o:{name:string})=>o.name==='TRAPPIST-1');expect(host.catalog_reference.planet_count).toBe(7);expect(host.distance_pc).toBeNull();
  await page.getByTestId('universe-catalog-search').fill('TRAPPIST-1');await select(page,host.object_id);await expect(detail(page)).toContainText('Unknown');
  const childrenResponse=await page.request.get(`/api/v1/catalog/universe?parent_id=${host.object_id}`);expect(childrenResponse.ok()).toBeTruthy();
  const children=(await childrenResponse.json()).objects;expect(children.map((o:{name:string})=>o.name).sort()).toEqual(['b','c','d','e','f','g','h'].map(s=>`TRAPPIST-1 ${s}`));
  await expect(detail(page).locator('[data-testid^="universe-child-"]')).toHaveCount(7);
  const target=children.find((o:{name:string})=>o.name==='TRAPPIST-1 f');expect(target.coordinate).toBeNull();
  await page.getByTestId(`universe-child-${target.object_id}`).click();await expect(explorer(page)).not.toBeVisible();
  await expect(page.getByTestId('exoplanet-explorer')).toBeVisible();await expect(page.getByTestId('exoplanet-detail').getByRole('heading',{name:'TRAPPIST-1 f',exact:true})).toBeVisible();
  const scene=page.getByTestId('exoplanet-scene');await expect(scene).toHaveAttribute('data-selected-object',target.object_id);
  await expect(scene).toHaveAttribute('data-camera-mode','focused');await expect(scene).toHaveAttribute('data-focused-object',target.object_id);
  await expect(scene).toHaveAttribute('data-surface-status','unresolved_illustration');await expect(page.getByTestId(`exo-label-${target.object_id}`)).toHaveAttribute('aria-pressed','true');
  await expect(page.getByTestId('exoplanet-detail')).toContainText('illustrative');await page.screenshot({path:'../var/qa/dev008-universe-trappist-f.png'});expect(errors).toEqual([]);
});

test('all nine galaxy member maps disclose symbolic/reference roles and epsilon returns to unchanged actual exposures',async({page})=>{
  test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.getByTestId('language').selectOption('en');await open(page);
  await page.getByTestId('universe-catalog-search').fill('epsilon-indi-b');await select(page,'epsilon-indi-b');await expect(detail(page)).toContainText('Brown-dwarf binary');
  await page.getByTestId('universe-open-system').click();await expect(explorer(page)).not.toBeVisible();await expect(solar(page)).toHaveAttribute('data-selected-object','epsilon-indi-b');
  await expect(solar(page)).toHaveAttribute('data-camera-mode','focused');await page.getByTestId('open-object-observations').click();let panel=page.getByTestId('observation-panel');
  await panel.getByRole('button',{name:'Open comparison',exact:true}).click();await expect(page.getByTestId('result-id')).toBeVisible();
  const result=await page.getByTestId('result-id').innerText(),epoch=await solar(page).getAttribute('data-model-epoch');
  const original=await (await page.request.get(`/api/v1/comparisons/${result}/manifest`)).json();const quality=await panel.getByRole('table').innerText();
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();const judgment='Catalog member symbols and reference directions do not measure SPHEREx source association.';await panel.locator('#assessment').fill(judgment);
  await open(page);
  for(const galaxy of galaxyIds){
    const response=await page.request.get(`/api/v1/catalog/universe?galaxy_id=${galaxy}`);expect(response.ok()).toBeTruthy();const members=(await response.json()).objects;
    expect(members.length).toBeGreaterThan(0);expect(members.every((o:{kind:string})=>o.kind!=='exoplanet')).toBe(true);
    await page.getByTestId('universe-parent-galaxy').selectOption(galaxy);const member=members[0];await select(page,member.object_id);
    await expect(detail(page)).toContainText('Symbols distinguish object types');await expect(detail(page)).toContainText('Unknown');
    await expect(detail(page).locator(`a[href="${member.source.url}"]`)).toBeVisible();expect(member.galaxy_relative_position_pc).toBeNull();expect(member.image).toBeNull();
    if(member.coordinate.role==='host_nucleus_reference')await expect(detail(page)).toContainText('not an independent individual black-hole position');
    if(member.coordinate.role==='embedded_cluster_reference')await expect(detail(page)).toContainText('embedded cluster');
  }
  await page.getByTestId('universe-parent-galaxy').selectOption('galaxy-milky-way');await page.getByTestId('universe-catalog-search').fill('epsilon-indi-b');await select(page,'epsilon-indi-b');
  await page.getByTestId('universe-open-system').click();await page.getByTestId('open-object-observations').click();await expect(page.getByTestId('result-id')).toHaveText(result);
  panel=page.getByTestId('observation-panel');await panel.getByRole('button',{name:'Quality',exact:true}).click();expect(await panel.getByRole('table').innerText()).toBe(quality);
  await expect(page.getByTestId('frame-A')).toContainText('2025-04-30T02:06:28.716');await expect(page.getByTestId('frame-B')).toContainText('2026-09-23T17:21:46.185');
  expect(await (await page.request.get(`/api/v1/comparisons/${result}/manifest`)).json()).toEqual(original);expect(await solar(page).getAttribute('data-model-epoch')).toBe(epoch);
  await panel.getByRole('button',{name:'Evidence',exact:true}).click();await expect(panel.locator('#assessment')).toHaveValue(judgment);
  await page.screenshot({path:'../var/qa/dev008-universe-epsilon-return.png',fullPage:true});expect(errors).toEqual([]);
});
