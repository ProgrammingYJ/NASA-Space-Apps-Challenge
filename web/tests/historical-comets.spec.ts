import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';

test('historical comet source windows, playback and five-language limits preserve the universe session',async({page,browser})=>{
  await page.goto('/');
  await page.locator('#universe-search').fill('earth');
  await page.getByTestId('search-earth').click();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','earth');
  await page.getByTestId('open-historical-comets').click();
  const explorer=page.getByTestId('historical-comet-explorer');await expect(explorer).toBeVisible();
  const select=page.getByTestId('historical-comet-select');await expect(select.locator('option')).toHaveCount(4);
  for(const [id,year] of [['comet-halley','1986'],['comet-hale-bopp','1997'],['comet-neowise','2020'],['comet-67p','2015']]){
    await select.selectOption(id);await expect(page.getByTestId('historical-comet-scene')).toHaveAttribute('data-object-id',id);
    await expect(page.getByTestId('historical-comet-time')).toContainText(year);await expect(page.getByTestId('historical-comet-time')).toContainText('TDB');
  }
  await select.selectOption('comet-halley');
  const slider=page.getByTestId('historical-comet-slider');await slider.fill('0.5');
  await expect(page.getByTestId('historical-comet-sampling')).toContainText('표시용 보간');
  const before=await slider.inputValue();await page.getByTestId('historical-comet-play').click();
  await expect.poll(()=>slider.inputValue()).not.toBe(before);await page.getByTestId('historical-comet-play').click();
  await page.getByTestId('historical-comet-tail').check();await expect(explorer).toContainText('설명 기호');
  for(const locale of ['en','ja','zh-Hant','fr','ko']){await page.getByTestId('language').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.getByTestId('historical-comet-time')).toContainText('TDB');await expect(explorer).not.toContainText('undefined');}
  await select.selectOption('comet-67p');await slider.fill('0.5');
  const savedDownload=page.waitForEvent('download');await page.getByTestId('historical-comet-save').click();const download=await savedDownload;const bytes=await fs.readFile((await download.path())!);const saved=JSON.parse(bytes.toString());
  expect(saved.object_id).toBe('comet-67p');expect(saved.sample_index).toBe(.5);expect(saved.source_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
  const fresh=await browser.newContext();const restored=await fresh.newPage();await restored.goto('/');await restored.getByTestId('open-historical-comets').click();await expect(restored.getByTestId('historical-comet-select').locator('option')).toHaveCount(4);
  await restored.getByTestId('historical-comet-import').setInputFiles({name:'setup.json',mimeType:'application/json',buffer:bytes});await expect(restored.getByTestId('historical-comet-select')).toHaveValue('comet-67p');await expect(restored.getByTestId('historical-comet-slider')).toHaveValue('0.5');
  const tampered={...saved,source_manifest_sha256:'0'.repeat(64)};await restored.getByTestId('historical-comet-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(tampered))});await expect(restored.getByRole('alert')).toBeVisible();await fresh.close();
  await page.getByTestId('historical-comet-close').click();await expect(explorer).toBeHidden();
  await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-selected-object','earth');
});
