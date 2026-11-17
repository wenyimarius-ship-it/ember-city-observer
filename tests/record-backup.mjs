import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRecord } from '../js/route-record.js';
import { exportRecords, maxBackupBytes } from '../js/route-backup.js';

const key='ember-city-route-records-v1', base='http://127.0.0.1:4173/record.html';
function sample(name='原路线') {
  const r=createRecord(name); r.completed=true;
  r.space.nodes=[{id:'a',label:'入口',type:'入口',note:'',x:100,y:100},{id:'b',label:'出口',type:'出口',note:'',x:600,y:100}];
  r.space.markers=[{id:'m',kind:'like',x:300,y:100,note:'中文感受'}];
  return r;
}
async function upload(page, data) {
  await page.locator('#route-file').setInputFiles({name:'routes.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});
  await page.waitForFunction(()=>document.querySelector('#route-file').value==='');
}
const stored=page=>page.evaluate(key=>localStorage.getItem(key),key);
const message=page=>page.locator('#record-message').textContent();

export async function testRecordBackup(browser) {
  for (const width of [375,1440]) {
    const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
    const page=await context.newPage();
    const original=sample(), raw=JSON.stringify([original]);
    await page.goto(base);
    await page.evaluate(({key,raw})=>{localStorage.setItem(key,raw);localStorage.setItem('ember-city-observation-v1','unmodified advanced data');},{key,raw});
    await page.reload();
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#export-routes').click()]);
    const path=`/tmp/city-route-export-${width}.json`; await download.saveAs(path);
    const backup=JSON.parse(await fs.readFile(path,'utf8'));
    assert.deepEqual(backup.records,[original]);
    assert.equal(backup.schema,'ember-city-route-records'); assert.equal(backup.version,1);
    assert.ok(Number.isFinite(Date.parse(backup.exportedAt)));
    const fresh=await browser.newContext({viewport:{width,height:900}}), restored=await fresh.newPage();
    await restored.goto(base); await upload(restored,backup);
    await restored.locator('#route-import-dialog').waitFor({state:'visible'});
    assert.match(await restored.locator('#route-import-summary').textContent(),/将导入 1 条路线，跳过 0 条/);
    assert.equal(await stored(restored),null);
    await restored.locator('#confirm-route-import').click();
    assert.deepEqual(JSON.parse(await stored(restored)),[original]);
    await restored.reload();
    await restored.locator('[data-open]').click();
    assert.equal(await restored.locator('#result .marker').count(),1);
    assert.match(await restored.locator('#result').textContent(),/中文感受/);
    await fresh.close();

    const incoming=sample('<img src=x onerror="window.injected=true">');
    incoming.space.markers[0].note='<script>window.injected=true</script>';
    incoming.unknown='drop'; incoming.space.unknown='drop'; incoming.space.nodes[0].unknown='drop';
    incoming.space.markers[0].unknown='drop'; incoming.space.notes.unknown='drop';
    const collision=structuredClone(original); collision.space.name='must not replace';
    const mergedBackup={...backup,records:[collision,incoming,incoming]};
    await upload(page,mergedBackup); await page.locator('#route-import-dialog').waitFor({state:'visible'});
    assert.match(await page.locator('#route-import-summary').textContent(),/将导入 1 条路线，跳过 2 条/);
    await page.locator('#cancel-route-import').click(); assert.equal(await stored(page),raw);
    await upload(page,mergedBackup); await page.locator('#route-import-dialog').waitFor({state:'visible'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    for(const id of ['export-routes','import-routes','confirm-route-import','cancel-route-import']) {
      assert.ok((await page.locator('#'+id).boundingBox()).height>=44);
    }
    await page.locator('#confirm-route-import').click();
    assert.match(await message(page),/2 条已存在，已跳过/);
    const mergedRaw=await stored(page), merged=JSON.parse(mergedRaw);
    assert.deepEqual(merged[0],original); assert.equal(merged.length,2);
    for (const obj of [merged[1],merged[1].space,merged[1].space.nodes[0],merged[1].space.markers[0],merged[1].space.notes]) assert.ok(!Object.hasOwn(obj,'unknown'));
    await page.locator(`[data-open="${incoming.id}"]`).click();
    assert.equal(await page.locator('#result img, #result script, #saved-records img').count(),0);
    assert.match(await page.locator('#result').textContent(),/<img src=x/);
    assert.match(await page.locator('#result').textContent(),/<script>/);
    assert.equal(await page.evaluate(()=>window.injected),undefined);
    await page.reload(); assert.equal(await stored(page),mergedRaw);
    assert.equal(await page.evaluate(()=>localStorage.getItem('ember-city-observation-v1')),'unmodified advanced data');

    const tooMany=sample(); tooMany.space.nodes=Array.from({length:101},(_,i)=>({...tooMany.space.nodes[0],id:String(i)}));
    const badCoordinate=sample(); badCoordinate.space.nodes[0].x=1000;
    for (const invalid of ['not JSON',{...backup,schema:'wrong'},{...backup,version:2},{...backup,records:[tooMany]},{...backup,records:[badCoordinate]},' '.repeat(maxBackupBytes+1)]) {
      await upload(page,invalid);
      await page.waitForFunction(()=>document.querySelector('#record-message').textContent.startsWith('导入失败'));
      assert.equal(await stored(page),mergedRaw);
      assert.equal(await page.locator('#route-import-dialog').isVisible(),false);
    }
    const next=sample('存储失败时不能出现');
    await upload(page,exportRecords([next])); await page.locator('#route-import-dialog').waitFor({state:'visible'});
    await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ember-city-route-records-v1')throw new DOMException('quota','QuotaExceededError');return window.originalSet.call(this,k,v);};});
    await page.locator('#confirm-route-import').click();
    assert.match(await message(page),/写入失败.*请勿刷新/);
    assert.equal(await stored(page),mergedRaw); assert.equal(await page.locator(`[data-open="${next.id}"]`).count(),0);
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalSet;});

    // A change in another tab while the confirmation is open must also survive.
    await upload(page,exportRecords([next])); await page.locator('#route-import-dialog').waitFor({state:'visible'});
    const otherRaw=JSON.stringify([original]);
    await page.evaluate(({key,otherRaw})=>localStorage.setItem(key,otherRaw),{key,otherRaw});
    await page.locator('#confirm-route-import').click();
    assert.match(await message(page),/其他页面已修改存储/); assert.equal(await stored(page),otherRaw);
    await page.evaluate(({key})=>localStorage.setItem(key,'corrupt raw data'),{key}); await page.reload();
    await upload(page,backup);
    await page.waitForFunction(()=>document.querySelector('#record-message').textContent.startsWith('导入失败'));
    assert.equal(await stored(page),'corrupt raw data');
    console.log(`PASS backup ${width}px: export/import round trip + markers, confirmation/cancel, duplicate merge, text safety, validation/size failures, quota/read/cross-tab protection and reload persistence`);
    await context.close();
  }
}
