import {test,expect} from '@playwright/test';

test('DEV-028: a fresh Korean-browser desktop starts in English, permits a language choice and resets new sessions to English',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,locale:'ko-KR',viewport:{width:1440,height:1000}});
  try{
    const page=await context.newPage();await page.goto('/');
    await expect(page.getByTestId('language')).toHaveValue('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.getByTestId('language').selectOption('ko');await expect(page.locator('html')).toHaveAttribute('lang','ko');
    await page.getByRole('button',{name:'새 세션',exact:true}).click();
    await expect(page.getByTestId('language')).toHaveValue('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
  }finally{await context.close();}
});

test('DEV-028: a fresh mobile device starts with the English PC notice and can explicitly change its language',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,locale:'ko-KR',viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1'});
  try{
    const page=await context.newPage();await page.goto('/');
    await expect(page.getByTestId('mobile-platform-gate')).toBeVisible();
    await expect(page.getByTestId('platform-language')).toHaveValue('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
    await page.getByTestId('platform-language').selectOption('ko');await expect(page.locator('html')).toHaveAttribute('lang','ko');
    await expect(page.getByTestId('universe-scene')).toHaveCount(0);
  }finally{await context.close();}
});
