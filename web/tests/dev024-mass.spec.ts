import {test,expect,type Page,type Locator} from '@playwright/test';
import type {OuterTnoObject} from '../src/OuterTnoPanel';
import type {PlanetCriteriaCatalogue} from '../src/PlanetCriteriaAdapter';
import {approximateMassCopy} from '../src/ApproximateMassCopy';

// Run centrally against PLAYWRIGHT_BASE_URL with the existing single Chrome
// worker. Only the selected objects' existing detail responses are inspected.
const languages=['ko','en','ja','zh-Hant','fr'] as const;
const catalogueSha='6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1';
const algorithm='source-size-or-H-albedo-density-mass-v1';
const earthKg=5.97217e24,defaultDensity=1000,defaultAlbedo=.1;
const formulaSource='https://cneos.jpl.nasa.gov/tools/ast_size_est.html';
const massLine=(page:Page)=>page.getByTestId('planet-criteria-card').getByTestId('criteria-minimum-mass');
const details=(page:Page)=>page.getByTestId('planet-criteria-card').getByTestId('approximate-mass-details');
function numberInput(value:unknown):number|null{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string'||!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/.test(value.trim()))return null;
  const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;
}
// Independent expectation: H -> diameter in km -> spherical volume in m³.
function expectedFromSource(source:OuterTnoObject){
  const H=numberInput(source.source_fields?.H),rawAlbedo=numberInput(source.source_fields?.albedo);
  const albedo=rawAlbedo!==null&&rawAlbedo>0?rawAlbedo:defaultAlbedo;
  const diameter=source.physical.diameter_km??(H===null?null:1329/Math.sqrt(albedo)*Math.pow(10,-H/5));
  if(diameter===null)return null;
  const radiusMetres=diameter*500,massKg=defaultDensity*(4/3)*Math.PI*Math.pow(radiusMetres,3);
  return {H,albedo,diameter,massKg,massEarth:massKg/earthKg};
}
async function select(page:Page,id:string){
  await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);
}
async function selectedDetail(page:Page,id:string){
  const responsePromise=page.waitForResponse(response=>{
    const url=new URL(response.url());return response.request().method()==='GET'&&url.pathname==='/api/v1/catalog/outer-tno/object'&&url.searchParams.get('object_id')===id;
  });
  await select(page,id);const response=await responsePromise;expect(response.ok()).toBe(true);
  const source=await response.json() as OuterTnoObject;
  expect(source.object_id).toBe(id);expect(source.source_manifest_sha256).toBe(catalogueSha);
  await expect(page.getByTestId('outer-tno-id')).toContainText(id);return source;
}
async function expanded(element:Locator){
  if(await element.evaluate(node=>node instanceof HTMLDetailsElement&&!node.open))await element.locator(':scope > summary').click();
}
async function numericAttribute(element:Locator,name:string){
  const text=await element.getAttribute(name);expect(text,name).not.toBeNull();expect(text,name).not.toBe('');
  const value=Number(text);expect(Number.isFinite(value),name).toBe(true);return value;
}
async function unchangedCriteria(page:Page,source:PlanetCriteriaCatalogue['objects'][string]){
  for(const row of source.criteria)await expect(page.getByTestId('planet-criteria-card').getByTestId('criterion-'+row.id)).toHaveAttribute('data-status',row.status);
}

test('DEV-024: source H yields a labelled automatic estimate, with five-language assumptions and no stale mass after selection',async({page},testInfo)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.getByTestId('language').selectOption('en');
  const source=await selectedDetail(page,'sbdb-54199096');
  expect(numberInput(source.source_fields?.H)).toBe(7.45);expect(source.physical.mass_kg).toBeNull();expect(source.physical.diameter_km).toBeNull();
  const expected=expectedFromSource(source)!;expect(expected).not.toBeNull();expect(expected.massEarth).toBeGreaterThan(0);
  await expect(massLine(page)).toHaveAttribute('data-current-mass-kind','estimate');
  expect(await numericAttribute(massLine(page),'data-current-mass-earth')).toBeCloseTo(expected.massEarth,12);
  await expect(massLine(page)).toContainText('≈');
  const explanation=details(page);await expect(explanation).toHaveAttribute('data-algorithm-version',algorithm);
  await expect(explanation).toHaveAttribute('data-object-id',source.object_id);
  await expect(explanation).toHaveAttribute('data-size-origin','h_albedo');await expect(explanation).toHaveAttribute('data-mass-kind','estimate');
  await expanded(explanation);
  expect(await numericAttribute(explanation,'data-mass-kg')).toBeCloseTo(expected.massKg,-6);
  expect(await numericAttribute(explanation,'data-diameter-km')).toBeCloseTo(expected.diameter,8);
  expect(await numericAttribute(explanation,'data-density-kg-m3')).toBe(defaultDensity);
  expect(await numericAttribute(explanation,'data-absolute-magnitude')).toBe(7.45);
  expect(await numericAttribute(explanation,'data-albedo')).toBe(expected.albedo);
  await expect(explanation.locator('code').filter({hasText:'1329'})).toContainText('−H/5');
  await expect(explanation.locator('code').filter({hasText:'M[kg]'})).toContainText('(D[km] × 1000)³');
  await expect(explanation.locator(`a[href="${formulaSource}"]`)).toHaveCount(1);
  await expect(explanation.locator(`a[href="${source.source_url}"]`)).toHaveCount(1);
  await expect(explanation).toContainText(catalogueSha);
  await expect(page.getByTestId('planet-criteria-card').getByTestId('criterion-equilibrium_shape')).toHaveAttribute('data-status','unknown');
  await expect(page.getByTestId('planet-criteria-card').getByTestId('criterion-orbital_dominance')).toHaveAttribute('data-status','unknown');
  const sourceFacts=page.getByTestId('outer-tno-source-facts');
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);const copy=approximateMassCopy(language);
    await expect(explanation).toContainText(copy.note);await expect(explanation).toContainText(copy.band);await expect(explanation).toContainText(copy.uncertainty);
    await expect(explanation).toContainText(copy.estimate);await expect(explanation).toContainText(copy.density);await expect(explanation).toContainText(copy.H);
    await expect(explanation).not.toContainText(/undefined|NaN/);await expect(sourceFacts).toContainText(source.object_id);
    await expect(sourceFacts.getByRole('link').filter({hasText:'JPL SBDB'})).toHaveAttribute('href',source.source_url);
  }
  await page.getByTestId('language').selectOption('en');
  const nextSource=await selectedDetail(page,'sbdb-54538127'),nextExpected=expectedFromSource(nextSource)!;
  expect(nextSource.physical.mass_kg).toBeNull();expect(nextExpected.massEarth).not.toBe(expected.massEarth);
  await expect(massLine(page)).toHaveAttribute('data-current-mass-kind','estimate');
  expect(await numericAttribute(massLine(page),'data-current-mass-earth')).toBeCloseTo(nextExpected.massEarth,12);
  await expect(page.getByTestId('planet-criteria-card')).toHaveAttribute('data-object-id',nextSource.object_id);
  await expect(details(page)).toHaveAttribute('data-object-id',nextSource.object_id);
  await expect(details(page)).toHaveAttribute('data-absolute-magnitude',String(nextExpected.H));
  await testInfo.attach('dev024-mass-source-estimates.json',{body:JSON.stringify({catalogue_sha256:catalogueSha,algorithm,first:{object_id:source.object_id,source_H:source.source_fields?.H,original_mass_kg:source.physical.mass_kg,...expected},next:{object_id:nextSource.object_id,original_mass_kg:nextSource.physical.mass_kg,...nextExpected}}),contentType:'application/json'});
});

test('DEV-024: missing H and size stay unavailable, while Earth measured mass and Sedna classification keep source priority',async({page},testInfo)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});
  const criteriaPromise=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname==='/api/v1/planet-criteria');
  await page.goto('/');await page.getByTestId('language').selectOption('en');
  const criteriaResponse=await criteriaPromise;expect(criteriaResponse.ok()).toBe(true);const criteria=await criteriaResponse.json() as PlanetCriteriaCatalogue;
  const missing=[];
  for(const id of ['sbdb-50255373','sbdb-54316819']){
    const source=await selectedDetail(page,id);expect(source.physical.mass_kg).toBeNull();expect(source.physical.diameter_km).toBeNull();
    expect(numberInput(source.source_fields?.H)).toBeNull();expect(expectedFromSource(source)).toBeNull();
    await expect(massLine(page)).toHaveAttribute('data-current-mass-kind','unavailable');await expect(massLine(page)).toHaveAttribute('data-current-mass-earth','');
    const explanation=details(page);await expect(explanation).toHaveAttribute('data-mass-kind','unavailable');await expanded(explanation);
    await expect(explanation).toHaveAttribute('data-object-id',id);
    await expect(explanation).toContainText(approximateMassCopy('en').no_size_or_h);await expect(explanation.getByTestId('approximate-mass-value')).toHaveCount(0);
    await expect(explanation).toHaveAttribute('data-mass-kg','');await expect(explanation).toHaveAttribute('data-diameter-km','');
    missing.push({id,source_H:source.source_fields?.H??null,original_mass_kg:source.physical.mass_kg,rendered_mass:'unavailable'});
  }
  await select(page,'earth');await expect(massLine(page)).toHaveAttribute('data-current-mass-kind','measured');
  await expect(massLine(page)).toHaveAttribute('data-current-mass-earth','1');expect(criteria.objects.earth.mass.earth_masses).toBe(1);
  await expect(details(page)).toHaveCount(0);await unchangedCriteria(page,criteria.objects.earth);
  await select(page,'sedna');expect(criteria.objects.sedna.mass.earth_masses).toBeNull();
  await expect(massLine(page)).toHaveAttribute('data-current-mass-kind','estimate');
  const sednaDetails=details(page);await expect(sednaDetails).toHaveAttribute('data-size-origin','physical_radius');await expanded(sednaDetails);
  const diameter=await numericAttribute(sednaDetails,'data-diameter-km');expect(diameter).toBe(995);
  const sednaExpected=defaultDensity*(4/3)*Math.PI*Math.pow(497500,3)/earthKg;
  expect(await numericAttribute(massLine(page),'data-current-mass-earth')).toBeCloseTo(sednaExpected,12);
  await expect(sednaDetails).toContainText(approximateMassCopy('en').physical_radius);
  await expect(sednaDetails.locator('code').filter({hasText:'1329'})).toHaveCount(0);
  await unchangedCriteria(page,criteria.objects.sedna);
  await page.getByTestId('open-planet-criteria').click();const dialog=page.getByTestId('planet-criteria-dialog');await expect(dialog).toBeVisible();
  expect(criteria.objects.sedna.official_classification).toBe('dwarf_candidate');await expect(dialog.getByTestId('criteria-official-class')).toHaveText('Dwarf-planet candidate');
  await expect(dialog.getByTestId('criteria-pi')).not.toContainText('NaN');
  await testInfo.attach('dev024-mass-missing-and-source-priority.json',{body:JSON.stringify({missing,earth:{source_mass_earth:criteria.objects.earth.mass.earth_masses,classification:criteria.objects.earth.official_classification},sedna:{source_mass_earth:criteria.objects.sedna.mass.earth_masses,classification:criteria.objects.sedna.official_classification,assumed_density_kg_m3:defaultDensity,radius_km:497.5,expected_mass_earth:sednaExpected}}),contentType:'application/json'});
});
