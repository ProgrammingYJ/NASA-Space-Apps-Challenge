import {test,expect,type Locator} from '@playwright/test';

const languages=['ko','en','ja','zh-Hant','fr'];
const widths=[1440,2560];
const direct=(name:string)=>`#root>div>[class*="_${name}_"]`;
async function bounds(locator:Locator){await expect(locator).toBeVisible();return (await locator.boundingBox())!;}

for(const width of widths)test(`translated hero, return action and time notice remain separated at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:width===1440?1000:1440});
  await page.goto('/');await expect(page.getByTestId('project-logo')).toBeVisible();
  const rows=[];
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);
    const hero=page.locator(direct('intro')),heading=hero.locator('h1');await expect(heading).toBeVisible();
    const lines=await heading.evaluate(element=>{
      const node=element.firstChild!,text=node.textContent??'',lines:Record<string,string>={};
      for(let i=0;i<text.length;i++){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const y=range.getBoundingClientRect().y.toFixed(1);lines[y]=(lines[y]??'')+text[i];}
      return Object.values(lines).map(line=>line.trim()).filter(Boolean);
    });
    if(language==='ko')expect(lines.every(line=>line.length>1)).toBe(true);
    expect(await heading.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await page.getByTestId('open-planet-nine').click();const panel=page.getByTestId('planet-nine-workbench');
    const button=panel.locator('header button');await expect(button).toBeVisible();
    const spans=button.locator('span'),label=await bounds(spans.first()),icon=await bounds(spans.last()),buttonBox=await bounds(button);
    expect(Math.abs(label.y+label.height/2-icon.y-icon.height/2)).toBeLessThan(2);
    expect(buttonBox.height).toBeLessThanOrEqual(46);
    expect(await button.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    await button.click();
    rows.push({language,heading_lines:lines,button:buttonBox});
  }
  await page.getByTestId('language').selectOption('ko');await page.screenshot({path:`../var/browser-results/dev019-after-${width}-hero.png`});
  await page.locator('#model-epoch').fill('2500-01-01T00:00:00');await page.locator('#model-epoch').press('Enter');
  const notice=page.getByTestId('outer-tno-time-notice');await expect(notice).toBeVisible();
  for(const language of languages){
    await page.getByTestId('language').selectOption(language);
    const noticeBox=await bounds(notice),helpBox=await bounds(page.locator(direct('controlsHelp'))),representationBox=await bounds(page.locator(direct('representation'))),timelineBox=await bounds(page.getByTestId('unified-timeline'));
    expect(noticeBox.y+noticeBox.height+8).toBeLessThanOrEqual(helpBox.y);
    expect(helpBox.y+helpBox.height+8).toBeLessThanOrEqual(representationBox.y);
    expect(representationBox.y+representationBox.height+8).toBeLessThanOrEqual(timelineBox.y);
    expect(await notice.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    const heroBox=await bounds(page.locator(direct('intro')));expect(heroBox.y+heroBox.height+8).toBeLessThanOrEqual(noticeBox.y);
    rows.push({language,notice:noticeBox,help:helpBox,representation:representationBox,timeline:timelineBox});
  }
  await page.getByTestId('language').selectOption('ko');await page.screenshot({path:`../var/browser-results/dev019-after-${width}-notice.png`});
  await page.getByTestId('open-planet-nine').click();await page.screenshot({path:`../var/browser-results/dev019-after-${width}-p9.png`});
  await testInfo.attach('translated-layout.json',{body:JSON.stringify(rows,null,2),contentType:'application/json'});
});

test('the full TNO browser stays bounded and below its catalogue toggle',async({page},testInfo)=>{
  test.setTimeout(120000);await page.goto('/');await expect(page.getByTestId('open-tno-catalogue')).toBeEnabled();
  const rows=[];
  for(const viewport of [{width:1440,height:1000},{width:1024,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    for(const language of languages){
      await page.getByTestId('language').selectOption(language);
      const toggle=page.getByTestId('open-tno-catalogue'),toggleBox=await bounds(toggle),gatewayBox=await bounds(page.locator(direct('catalogGateway')));
      expect(toggleBox.y+toggleBox.height+8).toBeLessThanOrEqual(gatewayBox.y);
      await toggle.click();const panel=page.getByTestId('tno-catalogue-browser');await expect(panel).toBeVisible();
      const panelBox=await bounds(panel),listBox=await bounds(page.getByTestId('tno-catalogue-list'));
      expect(panelBox.x).toBeGreaterThanOrEqual(0);expect(panelBox.x+panelBox.width).toBeLessThanOrEqual(viewport.width);expect(panelBox.y+panelBox.height).toBeLessThanOrEqual(viewport.height);
      expect(listBox.height).toBeGreaterThan(70);
      expect(await panel.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
      await expect(page.getByTestId('tno-catalogue-page')).toBeInViewport();
      rows.push({viewport,language,toggle:toggleBox,gateway:gatewayBox,panel:panelBox,list:listBox});
      if(language==='fr')await page.screenshot({path:`../var/browser-results/dev019-after-${viewport.width}-catalogue-fr.png`});
      await panel.locator('button').first().click();
    }
  }
  await testInfo.attach('catalogue-layout.json',{body:JSON.stringify(rows,null,2),contentType:'application/json'});
});
