import {test,expect,type Page} from '@playwright/test';
import {scopeCopy} from '../src/solarScope';

const sidebar=(page:Page)=>page.getByTestId('exploration-sidebar');
const gateway=(page:Page)=>page.getByTestId('solar-scope-discovery');
const intro=(page:Page)=>page.getByTestId('solar-scope-intro');
async function checkFlow(page:Page){
  const geometry=await page.evaluate(()=>{
    const box=(element:Element)=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const side=document.querySelector<HTMLElement>('[data-testid="exploration-sidebar"]')!;
    const search=document.querySelector('[data-testid="exploration-search"]')!;
    const card=document.querySelector('[data-testid="solar-scope-discovery"]')!;
    const title=document.querySelector('[data-testid="solar-scope-intro"] h1')!;
    const note=document.querySelector('[data-testid="solar-scope-note"]')!;
    const cta=document.querySelector('[data-testid="open-p9-discovery"]')!;
    const intersection=(a:ReturnType<typeof box>,b:ReturnType<typeof box>)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
    const header=document.querySelector('header')!,timeline=document.querySelector('[data-testid="timeline-clock"]')!.closest('section')!;
    return {search:box(search),card:box(card),title:box(title),note:box(note),cta:box(cta),side:box(side),sideScroll:side.scrollHeight,sideHeight:side.clientHeight,
      searchCardOverlap:intersection(box(search),box(card)),titleNoteOverlap:intersection(box(title),box(note)),noteCtaOverlap:intersection(box(note),box(cta)),
      headerSidebarOverlap:intersection(box(header),box(side)),timelineSidebarOverlap:intersection(box(timeline),box(side)),
      horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sidebarHorizontalOverflow:side.scrollWidth-side.clientWidth};
  });
  expect(geometry.searchCardOverlap).toBe(0);expect(geometry.titleNoteOverlap).toBe(0);expect(geometry.noteCtaOverlap).toBe(0);
  expect(geometry.headerSidebarOverlap).toBe(0);expect(geometry.timelineSidebarOverlap).toBe(0);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);expect(geometry.sidebarHorizontalOverflow).toBeLessThanOrEqual(1);
  expect(geometry.card.y).toBeGreaterThanOrEqual(geometry.search.bottom);
  expect(geometry.title.bottom).toBeLessThanOrEqual(geometry.note.y);
  expect(geometry.note.bottom).toBeLessThanOrEqual(geometry.cta.y);
  expect(geometry.sideHeight).toBeGreaterThan(60);
  return geometry;
}

for(const viewport of [{width:1440,height:1000},{width:1280,height:720},{width:390,height:844}]){
  test(`DEV-025 introduction and 1000 AU actions stay in one scroll flow at ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
    test.setTimeout(90000);await page.setViewportSize(viewport);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
    for(const locale of ['ko','fr'] as const){
      await page.getByTestId('language').selectOption(locale);const copy=scopeCopy(locale);
      await expect(sidebar(page)).toBeVisible();const headline=intro(page).getByRole('heading',{name:copy.headline,exact:true});await headline.scrollIntoViewIfNeeded();await expect(headline).toBeInViewport();
      await expect(page.getByTestId('solar-scope-note')).toHaveText(copy.note);await expect(gateway(page)).toContainText(copy.title);
      await page.getByTestId('open-p9-discovery').scrollIntoViewIfNeeded();await expect(page.getByTestId('open-p9-discovery')).toBeInViewport();
      const geometry=await checkFlow(page);
      await gateway(page).locator('summary').click();await expect(gateway(page)).toContainText(copy.validationNote);
      await expect(gateway(page).getByTestId('validate-epsilon-indi-b')).toBeVisible();
      for(const id of ['barnards-star','wise0855','rw-aurigae','r-draconis'])await expect(gateway(page).getByTestId('validate-'+id)).toHaveCount(1);
      await gateway(page).locator('summary').click();await page.getByTestId('open-p9-discovery').scrollIntoViewIfNeeded();
      await page.screenshot({path:testInfo.outputPath(`intro-${viewport.width}-${locale}.png`)});
      await testInfo.attach(`intro-rects-${locale}.json`,{body:JSON.stringify(geometry),contentType:'application/json'});
    }
    await page.getByTestId('open-p9-discovery').click();await expect(page.getByTestId('planet-nine-workbench')).toBeVisible();await expect(sidebar(page)).toBeHidden();
  });
}

test('DEV-025 translated introduction remains accessible under 125 percent desktop CSS zoom stress',async({page},testInfo)=>{
  test.setTimeout(90000);await page.setViewportSize({width:1280,height:720});await page.goto('/');
  // CSS zoom explicitly stresses text/layout in Chromium; this does not claim
  // an operating-system/browser-toolbar zoom setting or change the 3D camera.
  await page.evaluate(()=>{document.documentElement.style.zoom='1.25';});
  for(const locale of ['ko','en','ja','zh-Hant','fr'] as const){
    await page.getByTestId('language').selectOption(locale);const copy=scopeCopy(locale);
    const headline=intro(page).getByRole('heading',{name:copy.headline,exact:true});await headline.scrollIntoViewIfNeeded();await expect(headline).toBeInViewport();
    await expect(page.getByTestId('solar-scope-note')).toHaveText(copy.note);
    await page.getByTestId('open-p9-discovery').scrollIntoViewIfNeeded();await expect(page.getByTestId('open-p9-discovery')).toBeInViewport();
    await checkFlow(page);
  }
  await page.screenshot({path:testInfo.outputPath('intro-desktop-css-zoom-125-fr.png')});
});
