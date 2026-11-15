import {test,expect,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {creditsCopy} from '../src/CreditsCopy';
const releaseMetadata=JSON.parse(readFileSync(new URL('../src/generated/releaseMetadata.json',import.meta.url),'utf8'));

// Run centrally in the existing single real Chrome worker. No fake PDF, mocked
// source response, external-provider click, or extra scientific computation.
const languages=['ko','en','ja','zh-Hant','fr'] as const;
const repository='https://github.com/ProgrammingYJ/NASA-Space-Apps-Challenge';
const people=[
  {id:'science',names:['송내고교 1학년 윤서진']},
  {id:'testers',names:['SNHS Alpha 전원 참여']},
  {id:'design',names:['송내고교 1학년 김민정']},
  {id:'backend',names:['송내고교 1학년 이용진']},
  {id:'management',names:['송내고교 2학년 유영준','송내고교 1학년 박형섭']},
  {id:'leader',names:['송내고교 1학년 이용진']},
] as const;
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value)?value.toLowerCase():null;

async function openCredits(page:Page){
  const settings=page.locator('#universe-settings');
  if(!await settings.isVisible())await page.getByTestId('settings-toggle').click();
  const opener=page.getByTestId('open-credits');await opener.click();
  const dialog=page.getByTestId('credits-dialog');await expect(dialog).toBeVisible();
  await expect(page.getByTestId('credits-close')).toBeFocused();return {dialog,opener};
}

test('DEV-025 credits: exact approved contributors, five-language roles, direct sources and keyboard focus',async({page},testInfo)=>{
  test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  const keys=Object.keys(creditsCopy('en')).sort();
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);const copy=creditsCopy(language);
    expect(Object.keys(copy).sort()).toEqual(keys);for(const value of Object.values(copy))expect(value.trim().length).toBeGreaterThan(0);
    const {dialog,opener}=await openCredits(page);
    await expect(dialog).toHaveAccessibleName(copy.title);
    await expect(dialog.getByTestId('credits-title')).toHaveText(copy.title);
    await expect(dialog.getByTestId('credits-team')).toHaveText('2026 SNHS Alpha');
    const top=await dialog.getByTestId('credits-team').boundingBox();const creators=await dialog.getByTestId('credits-creators').boundingBox();
    expect(top).not.toBeNull();expect(creators).not.toBeNull();expect(top!.y).toBeLessThan(creators!.y);
    await expect(dialog.getByTestId('credits-creators').locator(':scope > div')).toHaveCount(6);
    for(const row of people){
      const credit=dialog.getByTestId('credits-role-'+row.id);await expect(credit.locator('dt')).toHaveText(copy[row.id]);
      const names=credit.locator('dd > span');await expect(names).toHaveText([...row.names]);
      for(const name of await names.all())await expect(name).toHaveAttribute('lang','ko');
    }
    // Independent literal checks of the approved Korean role spellings.
    if(language==='ko'){
      await expect(dialog.getByTestId('credits-role-science').locator('dt')).toHaveText('수/과학 검산');
      await expect(dialog.getByTestId('credits-role-management').locator('dt')).toHaveText('문서 관리 및 일정 관리');
      await expect(dialog.getByTestId('credits-role-leader').locator('dt')).toHaveText('프로젝트 리더');
    }
    await expect(dialog.getByTestId('credits-advisor')).toContainText('김민세');
    await expect(dialog.getByTestId('credits-advisor')).toContainText(copy.advisor);
    await expect(dialog.getByTestId('credits-venue')).toHaveText('송내고교');
    await expect(dialog.getByTestId('credits-data-pdf')).toHaveAttribute('href',releaseMetadata.data_spec_url);
    await expect(dialog.getByTestId('credits-data-pdf')).toContainText(copy.download);
    await expect(dialog.getByTestId('credits-notices')).toHaveAttribute('href',repository+'/blob/main/THIRD_PARTY_NOTICES.md');
    await expect(dialog.getByTestId('credits-ai-usage')).toHaveAttribute('href',repository+'/blob/main/docs/ai_usage.md');
    await expect(dialog.getByTestId('credits-repository')).toHaveAttribute('href',repository);
    await expect(dialog.getByTestId('credits-provider-nasa')).toHaveAttribute('href','https://science.nasa.gov/');
    await expect(dialog.getByTestId('credits-provider-jpl')).toHaveAttribute('href','https://ssd.jpl.nasa.gov/horizons/');
    await expect(dialog.getByTestId('credits-provider-irsa')).toHaveAttribute('href','https://irsa.ipac.caltech.edu/Missions/spherex.html');
    await expect(dialog.getByTestId('credits-provider-noirlab')).toHaveAttribute('href','https://noirlab.edu/public/images/geminiann04016a/');
    await expect(dialog.getByTestId('credits-provider-gemini')).toHaveAttribute('href','https://www.gemini.edu/');
    await expect(dialog).toContainText(copy.aiNote);
    await expect(dialog.getByTestId('credits-release')).toHaveAttribute('data-release-version',releaseMetadata.version);
    await expect(dialog.getByTestId('credits-release')).toHaveAttribute('data-release-updated-at',releaseMetadata.updated_at);
    await expect(dialog).not.toContainText(/undefined|NaN|Invalid Date/);
    await page.getByTestId('credits-close').focus();await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByTestId('credits-repository')).toBeFocused();
    await page.keyboard.press('Tab');await expect(page.getByTestId('credits-close')).toBeFocused();
    if(language==='ko')await page.screenshot({path:testInfo.outputPath('credits-ko.png')});
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
  }
  expect(errors).toEqual([]);
});

test('DEV-025 credits: the download is an actual PDF whose bytes match the generated publication hash',async({page},testInfo)=>{
  await page.goto('/');const {dialog}=await openCredits(page);
  const link=dialog.getByTestId('credits-data-pdf');
  await expect(link).toHaveAttribute('href','/downloads/PlanetX_Data_Spec.pdf');
  const response=await page.request.get(releaseMetadata.data_spec_url,{timeout:30000});expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/pdf');const body=await response.body();
  expect(body.subarray(0,5).toString('ascii')).toBe('%PDF-');expect(body.length).toBeGreaterThan(1000);
  const expectedHash=hash(releaseMetadata.data_spec_sha256);
  if(expectedHash){
    expect(createHash('sha256').update(body).digest('hex')).toBe(expectedHash);
    await expect(link).toHaveAttribute('data-spec-sha256',expectedHash);
    await dialog.getByTestId('credits-data-integrity').locator('summary').click();
    await expect(dialog.getByTestId('credits-pdf-sha256')).toHaveText(expectedHash);
  }else{
    await expect(dialog.getByTestId('credits-pdf-sha256')).toHaveCount(0);
    expect(await link.getAttribute('data-spec-sha256')).toBeNull();
  }
  const sourceHash=hash(releaseMetadata.data_spec_source_sha256);
  if(sourceHash)await expect(link).toHaveAttribute('data-spec-source-sha256',sourceHash);
  else await expect(dialog.getByTestId('credits-data-source-sha256')).toHaveCount(0);
  const downloadPromise=page.waitForEvent('download');await link.click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('PlanetX_Data_Spec.pdf');const saved=testInfo.outputPath('PlanetX_Data_Spec.pdf');await download.saveAs(saved);
  const savedBody=await readFile(saved);expect(savedBody.equals(body)).toBe(true);
  await page.getByTestId('credits-close').click();await expect(dialog).not.toBeVisible();
});

test('DEV-025 credits: narrow Korean and French layouts scroll inside the dialog without horizontal overflow',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  for(const locale of ['ko','fr']){
    await page.getByTestId('language').selectOption(locale);const {dialog,opener}=await openCredits(page);
    const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(391);
    const content=dialog.getByTestId('credits-content');
    const metrics=await content.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth,height:element.clientHeight,scrollHeight:element.scrollHeight,wordBreak:getComputedStyle(element).wordBreak}));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width+1);expect(metrics.scrollHeight).toBeGreaterThan(metrics.height);expect(metrics.wordBreak).toBe('keep-all');
    if(locale==='ko')await page.screenshot({path:testInfo.outputPath('credits-mobile-top.png')});
    await dialog.getByTestId('credits-repository').scrollIntoViewIfNeeded();await expect(dialog.getByTestId('credits-repository')).toBeInViewport();
    expect(await content.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByTestId('credits-close')).toBeInViewport();
    if(locale==='ko')await page.screenshot({path:testInfo.outputPath('credits-mobile-bottom.png')});
    await page.getByTestId('credits-close').click();await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
  }
});
