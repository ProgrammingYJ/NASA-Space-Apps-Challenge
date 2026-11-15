import {test,expect} from '@playwright/test';
import {experienceCopy} from '../src/ExperienceCopy';

const languages=['ko','en','ja','zh-Hant','fr'] as const;
const android='Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const ipadDesktop='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15';

test('DEV-027 R041: mobile identities see a PC Chrome notice without loading the explorer or requesting science data',async({browser,baseURL},testInfo)=>{
  test.setTimeout(120000);const results=[];
  for(const [kind,userAgent,touchMac] of [['Android',android,false],['iPhone',iphone,false],['iPad desktop identity',ipadDesktop,true]] as const){
    const context=await browser.newContext({baseURL,userAgent,viewport:{width:kind==='Android'?320:390,height:844},isMobile:true,hasTouch:true});
    try{
      await context.addInitScript(({touchMac})=>{
        if(touchMac){Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});}
        const original=HTMLCanvasElement.prototype.getContext;let calls=0;
        Object.defineProperty(window,'__dev027WebGLCalls',{get:()=>calls});
        HTMLCanvasElement.prototype.getContext=function(...args:unknown[]){if(String(args[0]).startsWith('webgl'))calls++;return Reflect.apply(original,this,args); } as typeof original;
      },{touchMac});
      const page=await context.newPage(),requests:string[]=[];
      page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/'))requests.push(request.url());});
      await page.goto('/');const gate=page.getByTestId('mobile-platform-gate');await expect(gate).toBeVisible();
      await expect(page.getByTestId('universe-scene')).toHaveCount(0);
      for(const locale of languages){
        await page.getByTestId('platform-language').selectOption(locale);const copy=experienceCopy(locale);
        await expect(page.locator('html')).toHaveAttribute('lang',locale);
        await expect(gate.getByRole('heading',{level:1})).toHaveText(copy.mobileTitle);
        await expect(page.getByTestId('platform-recommended')).toHaveText(copy.recommended);
        await expect(page.getByTestId('platform-address')).toHaveText('https://nasaspaceappschallenge.marulee.dev/');
        await expect(page.getByTestId('platform-data-pdf')).toHaveAttribute('href','/downloads/PlanetX_Data_Spec.pdf');
        expect(await gate.evaluate(element=>element.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
      }
      expect(requests).toEqual([]);
      expect(await page.evaluate(()=>Reflect.get(window,'__dev027WebGLCalls'))).toBe(0);
      const scripts=await page.locator('script[src]').evaluateAll(elements=>elements.map(element=>element.getAttribute('src')));
      results.push({kind,science_requests:requests.length,WebGL_contexts:0,languages:languages.length,scripts});
    }finally{await context.close();}
  }
  await testInfo.attach('dev027-mobile-platform-boundary.json',{body:JSON.stringify(results),contentType:'application/json'});
});

test('DEV-027 guide: a narrow touch PC remains allowed and the five-language guide preserves the scene and keyboard focus',async({page},testInfo)=>{
  test.setTimeout(120000);await page.setViewportSize({width:720,height:1000});await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{Object.defineProperty(navigator,'platform',{get:()=> 'Win32'});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>10});});
  await page.goto('/');await expect(page.getByTestId('mobile-platform-gate')).toHaveCount(0);await expect(page.getByTestId('universe-scene')).toBeVisible();
  // A narrow desktop window is still a PC; exercise the guide at the normal
  // desktop viewport after checking this boundary, rather than claim phone UI.
  await page.setViewportSize({width:1440,height:1000});
  const opener=page.getByTestId('open-quick-guide');await expect(opener).toBeVisible();
  const scene=page.getByTestId('universe-scene');
  await expect(scene).toHaveAttribute('data-camera-mode','overview');
  await expect(page.getByTestId('object-label-earth')).toHaveAttribute('data-source-position-au',/.+/);
  const snapshot=()=>scene.evaluate(element=>Object.fromEntries(['data-model-epoch','data-selected-object','data-camera-position','data-camera-target','data-distance-algorithm'].map(name=>[name,element.getAttribute(name)])));
  const before=await snapshot();
  for(const locale of languages){
    await page.getByTestId('language').selectOption(locale);const copy=experienceCopy(locale);
    await expect(page.getByTestId('recommended-environment')).toHaveText(copy.recommended);
    await opener.click();const dialog=page.getByTestId('quick-guide-dialog');await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('open','');
    await expect(dialog.getByRole('heading',{level:1})).toHaveText(copy.guideTitle);
    await expect(page.getByTestId('quick-guide-steps').getByRole('listitem')).toHaveCount(5);
    for(const step of copy.guideSteps){await expect(dialog).toContainText(step.title);await expect(dialog).toContainText(step.body);}
    await expect(page.getByTestId('quick-guide-display-note')).toHaveText(copy.displayNote);
    await expect(page.getByTestId('quick-guide-close')).toBeFocused();
    await page.keyboard.press('Tab');await expect(page.getByTestId('quick-guide-close')).toBeFocused();
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
    await expect.poll(snapshot).toEqual(before);
  }
  await testInfo.attach('dev027-desktop-guide-state.json',{body:JSON.stringify({viewport_width:720,platform:'Win32',touch_points:10,allowed:true,languages:languages.length,scene_unchanged:true}),contentType:'application/json'});
});

test('DEV-027 PC headers: recommendation and guide remain accessible at narrow desktop widths in five languages',async({page},testInfo)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.getByTestId('mobile-platform-gate')).toHaveCount(0);
  const rectangles=[];
  for(const width of [1280,1024]){
    await page.setViewportSize({width,height:800});
    for(const language of languages){
      const selector=page.getByTestId('language');await selector.selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang',language);
      const recommendation=page.getByTestId('recommended-environment'),guide=page.getByTestId('open-quick-guide');
      await expect(recommendation).toHaveText(experienceCopy(language).recommended);
      for(const control of [recommendation,guide,selector]){
        await expect(control).toBeVisible();await expect(control).toBeInViewport({ratio:1});
        const box=await control.boundingBox();expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(-1);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
      if(language==='fr'){
        // Real pointer input catches a visible but obscured or unclickable help
        // control. The dialog stays in the top layer independently of sidebars.
        await guide.click();const dialog=page.getByTestId('quick-guide-dialog');await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading',{level:1})).toHaveText(experienceCopy(language).guideTitle);
        const box=await dialog.boundingBox();expect(box).toBeTruthy();
        expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
        await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(guide).toBeFocused();
      }
      rectangles.push({width,language,recommendation:await recommendation.boundingBox(),guide:await guide.boundingBox(),language_control:await selector.boundingBox()});
    }
  }
  await testInfo.attach('dev027-PC-header-language-layout.json',{body:JSON.stringify(rectangles),contentType:'application/json'});
});
