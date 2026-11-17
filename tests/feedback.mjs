import assert from 'node:assert/strict';

export async function testFeedback(browser) {
  for (const width of [375,1440]) {
    for (const [origin, query, traffic] of [
      ['https://city.mariustang.com','','live'],
      ['https://city.mariustang.com','?analytics_test=1','test'],
      ['http://127.0.0.1:4173','?analytics_test=1',null],
      ['https://preview.example.test','?analytics_test=1',null],
    ]) {
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      const events=[];
      await context.route('https://us.i.posthog.com/**', async route=> {
        events.push(route.request().postDataJSON());
        await route.fulfill({status:200,contentType:'application/json',body:'{}'});
      });
      if (origin !== 'http://127.0.0.1:4173') await context.route(origin+'/**',async route=> {
        const url=new URL(route.request().url());
        const response=await fetch('http://127.0.0.1:4173'+url.pathname+url.search);
        await route.fulfill({status:response.status,contentType:response.headers.get('content-type'),body:Buffer.from(await response.arrayBuffer())});
      });
      // Explicit test links must remain test traffic even in an existing live tab.
      if (traffic==='test') await context.addInitScript(()=>sessionStorage.setItem('city.funnel.traffic.v1','live'));
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(origin+'/'+query);
      await page.locator('[data-step="restart"]').click();
      for (let i=0;i<6;i++) await page.locator('[data-step="next"]').click();
      await page.locator('[data-step="route-a"]').click();
      await page.locator('[data-step="reason-0"]').click();
      const feedback=page.locator('.play-feedback');
      assert.equal(await feedback.locator('button').count(),3);
      for (const box of await feedback.locator('button').evaluateAll(els=>els.map(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})))) {
        assert.ok(box.w>=44 && box.h>=44);
      }
      const before=await feedback.boundingBox();
      const first=page.getByRole('button',{name:'说中了',exact:true});
      await first.focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator('.feedback-status').textContent(),'谢谢你的反馈');
      assert.equal(await feedback.locator('button:disabled').count(),3);
      await page.locator('[data-rating="off"]').dispatchEvent('click');
      assert.equal((await feedback.boundingBox()).height,before.height);
      assert.equal(await page.locator('#record-entry a').isVisible(),true);
      await page.locator('[data-step="reason"]').click();
      await page.locator('[data-step="reason-1"]').click();
      assert.equal(await page.locator('.feedback-status').textContent(),'');
      assert.equal(await page.locator('[data-rating]:disabled').count(),0);
      await page.getByRole('button',{name:'有点偏',exact:true}).click();
      await page.waitForLoadState('networkidle');
      const captures=events.filter(e=>e.event==='city_feedback');
      assert.equal(captures.length,traffic?2:0);
      for (let i=0;i<captures.length;i++) assert.deepEqual(captures[i].properties,{
        distinct_id:'ember-funnel-aggregate',site:'city',rating:['accurate','partial'][i],traffic,
        $process_person_profile:false,$geoip_disable:true,
      });
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(errors,[]);
      console.log(`PASS feedback ${width}px ${origin}${query}: keyboard, once per result, reset, stable layout, origin gate and exact event properties`);
      await context.close();
    }
  }
}
