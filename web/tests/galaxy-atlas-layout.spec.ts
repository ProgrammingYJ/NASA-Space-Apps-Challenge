import {test,expect} from '@playwright/test';

for(const viewport of [{width:1920,height:1080},{width:1440,height:1000},{width:390,height:844}]){
  test(`global tools remain legible and the atlas leaves accessible canvas at ${viewport.width}px`,async({page})=>{
    await page.setViewportSize(viewport);await page.goto('/');
    const entry=page.getByTestId('open-galaxy-atlas'),header=entry.locator('../..');
    await expect(entry).toBeVisible();
    const layout=await header.evaluate(element=>{
      const brand=element.firstElementChild!,word=brand.querySelector('div')!,range=document.createRange();range.selectNode(word.firstChild!);
      return {logoLines:range.getClientRects().length,buttons:[...element.querySelectorAll('button')].map(button=>({nowrap:getComputedStyle(button).whiteSpace,height:button.getBoundingClientRect().height}))};
    });
    expect(layout.logoLines).toBe(1);for(const button of layout.buttons){expect(button.nowrap).toBe('nowrap');expect(button.height).toBeLessThan(55);}
    const gear=page.getByTestId('settings-toggle');await expect(gear).toBeVisible();const gearBox=await gear.boundingBox();expect(gearBox!.x).toBeGreaterThan(viewport.width-90);expect(gearBox!.y).toBeLessThan(70);
    await entry.click();const atlas=page.getByTestId('galaxy-atlas-explorer');await expect(atlas).toHaveAttribute('data-record-count','53162');
    const headerBox=await header.boundingBox(),atlasBox=await atlas.boundingBox();expect(headerBox!.y+headerBox!.height).toBeLessThanOrEqual(atlasBox!.y);
    await page.getByTestId('galaxy-atlas-search').fill('UGC12889');await page.getByTestId('galaxy-atlas-row-gwgc-pgc-2').click();await expect(page.getByTestId('universe-scene')).toHaveAttribute('data-camera-mode','focused');
    if(viewport.width<761){await expect(atlas).toHaveAttribute('data-compact','true');const compact=await atlas.boundingBox(),detail=await page.getByTestId('galaxy-atlas-detail').boundingBox();expect(detail!.y-(compact!.y+compact!.height)).toBeGreaterThan(75);}
    await gear.click();await expect(page.getByTestId('galaxy-atlas-settings-toggle')).toBeVisible();
    await page.screenshot({path:`../var/qa/dev016-atlas-layout-${viewport.width}.png`});
  });
}
