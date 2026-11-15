import {test,expect,type Page} from '@playwright/test';
import type {OuterTnoCatalog} from '../src/OuterTnoPanel';

// Root runs this against PLAYWRIGHT_BASE_URL. The project config keeps one
// Chrome worker and screenshots only on failure. No mock API or archive calls.
const sourceSha='6dd683ace22417072aaba17ee3f61937aa926598265b6082edeea278bfd452c1';
const hypothesisFields={mass_earth:'6.14',a_au:'390.78',e:'0.139',i_deg:'16.32'};

async function unchangedHypothesis(page:Page){
  await expect(page.getByTestId('planet-nine-panel')).toBeVisible();
  await expect(page.getByTestId('p9-preset')).toHaveValue('caltech-row-2413');
  for(const [key,value]of Object.entries(hypothesisFields))await expect(page.getByTestId('p9-'+key)).toHaveValue(value);
  await expect(page.getByTestId('p9-sky-path')).toBeVisible();
  await expect(page.getByTestId('p9-orbit-analogue-table').locator('tbody tr')).toHaveCount(10);
}

for(const width of [1440,2542]){
  test(`DEV-024: P9 stays docked while real analogue names focus independent left-hand information at ${width}px`,async({page},testInfo)=>{
    test.setTimeout(120000);await page.setViewportSize({width,height:1180});
    await page.emulateMedia({reducedMotion:'reduce'});
    const predictions:Array<unknown>=[];
    page.on('request',request=>{if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/planet-nine/predict')predictions.push(request.postDataJSON());});
    const cataloguePromise=page.waitForResponse(response=>response.request().method()==='GET'&&new URL(response.url()).pathname==='/api/v1/catalog/outer-tno');
    await page.goto('/');await page.getByTestId('language').selectOption('en');
    const catalogueResponse=await cataloguePromise;expect(catalogueResponse.ok()).toBe(true);
    const catalogue=await catalogueResponse.json() as OuterTnoCatalog;
    expect(catalogue.objects).toHaveLength(8341);expect(catalogue.source_manifest_sha256).toBe(sourceSha);
    await page.getByTestId('open-planet-nine').click();
    await page.getByTestId('p9-goto-top-five').click();
    await page.getByTestId('p9-region-3682').click();
    const members=page.getByTestId('p9-members-dialog');await expect(members).toBeVisible();
    const predictionPromise=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/planet-nine/predict');
    await members.getByTestId('p9-row-2413').click(); // Sample selection runs automatically.
    const predictionResponse=await predictionPromise;expect(predictionResponse.ok()).toBe(true);
    const prediction=await predictionResponse.json() as {status:string;orbit:{mass_earth:number;a_au:number;e:number;i_deg:number};full_orbit_au:number[][]};
    expect(prediction.status).toBe('conditional_hypothesis');
    expect(prediction.orbit).toMatchObject({mass_earth:6.14,a_au:390.78,e:.139,i_deg:16.32});
    expect(prediction.full_orbit_au).toHaveLength(257);
    await expect(members).not.toBeVisible();await unchangedHypothesis(page);
    await page.getByTestId('p9-goto-analogues').click();
    const rows=page.getByTestId('p9-orbit-analogue-table').locator('tbody tr');
    const originalIds=await rows.evaluateAll(elements=>elements.map(element=>element.getAttribute('data-object-id')));
    expect(originalIds[0]).toBe('sbdb-20689335');expect(new Set(originalIds).size).toBe(10);
    const clock=await page.getByTestId('timeline-clock').innerText(),bounds=[];
    for(const rank of [1,2]){
      const row=page.getByTestId('p9-orbit-analogue-'+rank),id=await row.getAttribute('data-object-id');
      const object=catalogue.objects.find(body=>body.object_id===id);expect(object).toBeTruthy();
      const selectedId=object!.known_object_id??object!.object_id;
      await page.getByTestId('p9-analogue-name-'+rank).click();
      const scene=page.getByTestId('universe-scene');
      await expect(scene).toHaveAttribute('data-selected-object',selectedId);
      await expect(scene).toHaveAttribute('data-camera-mode','focused');
      await expect(scene).toHaveAttribute('data-focused-object',selectedId);
      await expect(scene).toHaveAttribute('data-follow-object',selectedId);
      await expect(row).toHaveAttribute('data-selected','true');
      await expect(page.getByTestId('p9-analogue-name-'+rank)).toHaveAttribute('aria-current','true');
      if(rank===2)await expect(page.getByTestId('p9-orbit-analogue-1')).toHaveAttribute('data-selected','false');
      const info=page.getByTestId(selectedId.startsWith('sbdb-')?'outer-tno-panel':'object-panel');
      await expect(info).toBeVisible();await expect(info.getByTestId('selected-object-name')).toContainText(object!.name);
      await expect(info.getByTestId('outer-tno-id')).toContainText(object!.object_id);
      await expect(info.getByTestId('outer-tno-source-facts').getByRole('link').filter({hasText:'JPL SBDB'})).toHaveAttribute('href',`https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${object!.spkid}`);
      await unchangedHypothesis(page);expect(predictions).toHaveLength(1);
      expect(await rows.evaluateAll(elements=>elements.map(element=>element.getAttribute('data-object-id')))).toEqual(originalIds);
      await expect(page.getByTestId('timeline-clock')).toHaveText(clock);
      const dockBox=await page.getByTestId('planet-nine-panel').boundingBox(),infoBox=await info.boundingBox(),sceneBox=await scene.boundingBox();
      expect(dockBox).not.toBeNull();expect(infoBox).not.toBeNull();expect(sceneBox).not.toBeNull();
      expect(infoBox!.x).toBeGreaterThanOrEqual(0);expect(infoBox!.x+infoBox!.width).toBeLessThan(width/2);
      expect(dockBox!.x).toBeGreaterThan(width/2);expect(dockBox!.x+dockBox!.width).toBeLessThanOrEqual(width+1);
      expect(infoBox!.x+infoBox!.width).toBeLessThanOrEqual(sceneBox!.x);
      expect(sceneBox!.x+sceneBox!.width).toBeLessThanOrEqual(dockBox!.x);
      expect(sceneBox!.width).toBeGreaterThan(100);expect(infoBox!.height).toBeGreaterThan(100);
      await expect.poll(()=>page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth)).toBeLessThanOrEqual(1);
      bounds.push({rank,object_id:object!.object_id,selected_id:selectedId,dock:dockBox,information:infoBox,scene:sceneBox});
    }
    await page.screenshot({path:testInfo.outputPath(`p9-dock-${width}.png`)});
    await testInfo.attach(`dev024-p9-dock-${width}.json`,{body:JSON.stringify({width,source_sha256:sourceSha,hypothesis:prediction.orbit,automatic_posts:predictions.length,analogue_ids:originalIds,bounds}),contentType:'application/json'});
  });
}
