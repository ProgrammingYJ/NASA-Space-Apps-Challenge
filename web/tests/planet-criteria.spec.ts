import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
interface Criterion {id:string;status:string;reason_key:string;source:{url:string}}
interface Planet {object_id:string;official_classification:string;criteria:Criterion[];orbit:{semimajor_axis_au:number;eccentricity:number;perihelion_au:number;aphelion_au:number};mass:{earth_masses:number|null};system_mass?:{earth_masses:number;definition:string};clearing:{minimum_mass_earth:number;pi:number|null;model_classification:string}}
interface Catalogue {objects:Record<string,Planet>;source_manifest_sha256:string;model:{coefficient_earth_mass:number;semimajor_exponent:number;host_mass_solar:number;clearing_time_gyr:number;hill_zone_factor:number}}
const words=(locale:string)=>JSON.parse(readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8')) as Record<string,string>;
const dialog=(page:Page)=>page.getByTestId('planet-criteria-dialog');
async function catalogue(page:Page):Promise<Catalogue>{const response=await page.request.get('/api/v1/planet-criteria');expect(response.ok()).toBeTruthy();return await response.json() as Catalogue;}
async function choose(page:Page,id:string){await page.locator('#universe-search').fill(id);await page.getByTestId('search-'+id).click();await expect(page.getByTestId('planet-criteria-card')).toHaveAttribute('data-object-id',id);}
async function expand(page:Page,id:string){await choose(page,id);await page.getByTestId('open-planet-criteria').click();await expect(dialog(page)).toHaveAttribute('data-object-id',id);}
function minimumLine(planet:Planet,locale:string){const copy=words(locale),number=(value:number)=>value.toLocaleString(locale,{maximumSignificantDigits:5});return copy.criteriaMinimumMass.replace('{{minimum}}',number(planet.clearing.minimum_mass_earth)).replace('{{current}}',planet.mass.earth_masses===null?copy.criteriaMassUnknown:number(planet.mass.earth_masses)+' M⊕');}

test('source classifications, unknown primary masses and the conditional clearing formula remain distinct',async({page})=>{
  const data=await catalogue(page);expect(Object.keys(data.objects)).toHaveLength(17);expect(data.source_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);expect(data.model.coefficient_earth_mass).toBe(.001239);expect(data.model.semimajor_exponent).toBe(9/8);expect(data.model.host_mass_solar).toBe(1);expect(data.model.clearing_time_gyr).toBe(10);expect(data.model.hill_zone_factor).toBeCloseTo(2*Math.sqrt(3),12);
  for(const [id,planet] of Object.entries(data.objects)){
    const statuses=Object.fromEntries(planet.criteria.map(row=>[row.id,row.status]));expect(statuses.orbits_sun).toBe('met');
    if(['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'].includes(id)){expect(planet.official_classification).toBe('planet');expect(statuses.equilibrium_shape).toBe('met');expect(statuses.orbital_dominance).toBe('met');}
    else if(['pluto','ceres','haumea','makemake','eris'].includes(id)){expect(planet.official_classification).toBe('dwarf_planet');expect(statuses.equilibrium_shape).toBe('met');expect(statuses.orbital_dominance).toBe('not_met');}
    else {expect(planet.official_classification).toBe('dwarf_candidate');expect(statuses.equilibrium_shape).toBe('unknown');expect(statuses.orbital_dominance).toBe('unknown');}
    expect(planet.clearing.minimum_mass_earth).toBeCloseTo(.001239*planet.orbit.semimajor_axis_au**(9/8),10);
    if(planet.mass.earth_masses===null){expect(planet.clearing.pi).toBeNull();expect(planet.clearing.model_classification).toBe('unknown');}else expect(planet.clearing.pi).toBeCloseTo(planet.mass.earth_masses/planet.clearing.minimum_mass_earth,7);
  }
  for(const id of ['eris','gonggong','quaoar','orcus']){expect(data.objects[id].mass.earth_masses).toBeNull();expect(data.objects[id].system_mass?.definition).toBe('combined_primary_satellite_system');expect(data.objects[id].system_mass!.earth_masses).toBeGreaterThan(0);expect(data.objects[id].clearing.pi).toBeNull();}
  expect(data.objects.sedna.mass.earth_masses).toBeNull();expect(data.objects.sedna.clearing.pi).toBeNull();
});

test('planet, dwarf and candidate dialogs expose three sourced criteria, mass parentheses and a correctly focused ellipse',async({page})=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await page.getByTestId('language').selectOption('en');const data=await catalogue(page);
  for(const id of ['earth','pluto','sedna','eris']){
    const object=data.objects[id];await choose(page,id);await expect(page.getByTestId('planet-criteria-card').getByTestId('criteria-minimum-mass')).toHaveText(minimumLine(object,'en'));await expect(page.getByTestId('planet-criteria-card').getByTestId('criterion-orbital_dominance')).toContainText(words('en').criteriaModelLabel);await page.getByTestId('open-planet-criteria').click();await expect(dialog(page)).toHaveAttribute('data-object-id',id);await expect(dialog(page).getByTestId('criteria-official-class')).toHaveText(words('en')['criteriaClass_'+object.official_classification]);await expect(dialog(page).getByTestId('criteria-minimum-mass')).toHaveText(minimumLine(object,'en'));
    for(const criterion of object.criteria){const row=dialog(page).getByTestId('criterion-'+criterion.id);await expect(row).toHaveAttribute('data-status',criterion.status);await expect(row).toContainText(words('en')['criteriaReason_'+criterion.reason_key]);await expect(row.locator('p').filter({hasText:words('en')['criteriaReason_'+criterion.reason_key]}).getByRole('link')).toHaveAttribute('href',criterion.source.url);}
    await expect(dialog(page)).toContainText(words('en').criteriaDefinitionNote);await expect(dialog(page).getByTestId('criteria-clearing-model')).toContainText(words('en').criteriaModelNote);
    const diagram=dialog(page).getByTestId('criteria-orbit-diagram');await expect(diagram).toHaveAttribute('data-semimajor-au',String(object.orbit.semimajor_axis_au));const rx=Number(await diagram.locator('ellipse').getAttribute('rx'));expect(Number(await diagram.getAttribute('data-sun-focus-x'))).toBeCloseTo(-rx*object.orbit.eccentricity,10);await expect(diagram.locator('ellipse')).toHaveAttribute('cx','0');await expect(diagram.locator('path')).toHaveAttribute('d',/^M0 /);await expect(diagram).toContainText(words('en').criteriaSemimajorNote);
    if(object.mass.earth_masses===null)await expect(dialog(page).getByTestId('criteria-pi')).toContainText(words('en').criteria_model_unknown);
    if(object.system_mass)await expect(dialog(page)).toContainText(words('en').criteriaSystemMassNote);
    await page.screenshot({path:'../var/qa/dev010-criteria-'+id+'.png'});await page.keyboard.press('Escape');await expect(dialog(page)).toHaveCount(0);await expect(page.getByTestId('open-planet-criteria')).toBeFocused();await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object',id);
  }
  expect(errors).toEqual([]);
});

test('five locales preserve unknown candidate status and the IAU definition does not force moons or the Sun to fail',async({page})=>{
  test.setTimeout(120000);await page.goto('/');const data=await catalogue(page);
  for(const locale of ['ko','en','ja','zh-Hant','fr']){
    await page.getByTestId('language').selectOption(locale);await expand(page,'sedna');const copy=words(locale);await expect(dialog(page).getByRole('heading',{level:1})).toContainText(copy.criteriaTitle);await expect(dialog(page).getByTestId('criterion-equilibrium_shape')).toHaveAttribute('data-status','unknown');await expect(dialog(page).getByTestId('criterion-orbital_dominance')).toHaveAttribute('data-status','unknown');await expect(dialog(page).getByTestId('criteria-minimum-mass')).toHaveText(minimumLine(data.objects.sedna,locale));await expect(dialog(page)).toContainText(copy.criteriaModelNote);const diagram=dialog(page).getByTestId('criteria-orbit-diagram');await expect(diagram.locator('dd').nth(0)).toHaveText(data.objects.sedna.orbit.perihelion_au.toLocaleString(locale,{maximumSignificantDigits:5})+' au');await expect(diagram.locator('dd').nth(1)).toHaveText(data.objects.sedna.orbit.aphelion_au.toLocaleString(locale,{maximumSignificantDigits:5})+' au');await expect(dialog(page)).not.toContainText(/undefined|NaN|criteriaReason_|criteriaStatus_/);await page.screenshot({path:'../var/qa/dev010-criteria-sedna-'+locale+'.png'});await page.keyboard.press('Escape');
  }
  await page.getByTestId('language').selectOption('ko');await expand(page,'eris');await expect(dialog(page).getByTestId('criteria-minimum-mass')).toHaveText(minimumLine(data.objects.eris,'ko'));await expect(dialog(page).getByTestId('criterion-orbital_dominance')).toHaveAttribute('data-status','not_met');await expect(dialog(page).getByTestId('criteria-system-mass')).toContainText(words('ko').criteriaSystemMassNote);await page.screenshot({path:'../var/qa/dev010-criteria-eris-ko.png'});await page.keyboard.press('Escape');
  await page.getByTestId('language').selectOption('en');
  for(const id of ['sun','moon-301','epsilon-indi-b']){await choose(page,id);await expect(page.getByTestId('criteria-not-applicable')).toHaveText(words('en').criteriaNotApplicable);await expect(page.getByTestId('planet-criteria-card').locator('[data-testid^="criterion-"]')).toHaveCount(0);await expect(page.getByTestId('open-planet-criteria')).toHaveCount(0);}
});

test('unavailable criteria sources show an error and a real retry restores the source-backed rows',async({page})=>{
  let fail=true;await page.route('**/api/v1/planet-criteria',route=>fail?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({code:'source_unavailable',message_key:'source_unavailable',details:{},request_id:'qa-planet-criteria-source-failure'})}):route.continue());await page.goto('/');await page.getByTestId('language').selectOption('en');await choose(page,'earth');const card=page.getByTestId('planet-criteria-card');await expect(card.getByRole('alert')).toContainText(words('en').criteriaError);await expect(card.locator('[data-testid^="criterion-"]')).toHaveCount(0);fail=false;await card.getByRole('button',{name:words('en').retry,exact:true}).click();await expect(card.getByTestId('criterion-orbital_dominance')).toHaveAttribute('data-status','met');
});
