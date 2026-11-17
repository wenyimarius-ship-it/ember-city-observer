import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecord } from '../js/route-record.js';
import { exportRecords, parseRecordBackup, mergeRecords, maxBackupBytes } from '../js/route-backup.js';
import { createFeedback } from '../js/feedback.js';
import { createPostHogSender } from '../js/posthog-transport.js';
import { createFunnel } from '../js/funnel.js';

function sample() {
  const r = createRecord('庭院');
  r.completed = true;
  r.space.nodes = [
    {id:'a', label:'入口', type:'入口', note:'<b>文字</b>', x:20, y:20},
    {id:'b', label:'出口', type:'出口', note:'', x:780, y:480},
  ];
  r.space.markers = [{id:'m', kind:'like', x:400, y:250, note:'<img src=x onerror=alert(1)>'}];
  return r;
}

test('backup round trip preserves every known record field and markers without mutating originals', () => {
  const records = [sample(), createRecord('未完成')], before = structuredClone(records);
  const backup = exportRecords(records);
  assert.equal(backup.schema, 'ember-city-route-records');
  assert.equal(backup.version, 1);
  assert.ok(Number.isFinite(Date.parse(backup.exportedAt)));
  const incoming = parseRecordBackup(JSON.stringify(backup));
  assert.deepEqual(mergeRecords([], incoming).records, records);
  assert.deepEqual(records, before);
});

test('import drops unknown fields at each level; ID collisions keep local versions and skip duplicates within a file', () => {
  const local = sample(), incoming = sample(), collision = structuredClone(local);
  collision.space.name = 'must not replace local';
  incoming.extra = 'ignored'; incoming.space.extra = 'ignored';
  incoming.space.notes.extra = 'ignored'; incoming.space.nodes[0].extra = 'ignored';
  incoming.space.markers[0].extra = 'ignored';
  const raw = JSON.stringify({...exportRecords([collision, incoming]), extra:'ignored'});
  const parsed = parseRecordBackup(raw);
  const merged = mergeRecords([local], [...parsed, parsed[1]]);
  assert.equal(merged.added, 1); assert.equal(merged.skipped, 2);
  assert.equal(merged.records[0], local);
  assert.equal(merged.records[0].space.name, '庭院');
  const r = merged.records[1];
  for (const o of [r, r.space, r.space.notes, r.space.nodes[0], r.space.markers[0]]) assert.ok(!Object.hasOwn(o, 'extra'));
  assert.equal(r.space.markers[0].note, incoming.space.markers[0].note);
});

test('invalid backup, version, limits, fields and coordinates fail before touching local records', () => {
  const local = [sample()], before = structuredClone(local);
  for (const mutate of [
    b=>b.schema='wrong', b=>b.version=2, b=>b.records=null,
    b=>b.records[0].space.nodes=Array.from({length:101},(_,i)=>({...b.records[0].space.nodes[0],id:String(i)})),
    b=>b.records[0].space.nodes[0].x=19,
    b=>b.records[0].space.nodes[0].y=481,
    b=>b.records[0].space.markers[0].x=800,
    b=>b.records[0].space.markers[0].kind='unknown',
    b=>b.records[0].space.markers=[null],
  ]) {
    const backup=exportRecords(local); mutate(backup);
    assert.throws(()=>parseRecordBackup(JSON.stringify(backup)));
    assert.deepEqual(local,before);
  }
  for (const text of ['not JSON','null','[]',' '.repeat(maxBackupBytes+1),'中'.repeat(maxBackupBytes/3+1)]) assert.throws(()=>parseRecordBackup(text));
  const full=Array.from({length:500},()=>sample());
  assert.throws(()=>mergeRecords(full,[sample()]), /500/);
  assert.deepEqual(local,before);
});

test('feedback accepts only one rating per result; new result permits feedback; errors never block UI', () => {
  const calls=[], emit=rating=>calls.push(rating), result=createFeedback(emit);
  assert.equal(result('not-a-rating'),false);
  assert.equal(result('accurate'),true);
  assert.equal(result('partial'),false);
  assert.equal(createFeedback(emit)('off'),true);
  assert.deepEqual(calls,['accurate','off']);
  assert.equal(createFeedback(()=>{throw Error('offline');})('partial'),true);
});

test('feedback transport whitelists only rating, site, traffic and fixed protocol properties', async () => {
  for (const traffic of ['test','live']) {
    const calls=[];
    const send=createPostHogSender({site:'city',traffic,projectToken:'phc_test',apiHost:'https://us.i.posthog.com',send:async(url,opts)=>{calls.push({url,opts,body:JSON.parse(opts.body)});return {ok:true};}});
    await send('city_feedback',{rating:'partial',source:'wechat_moments',route:'A',reason:'private',notes:'secret'});
    await send('city_feedback',{rating:'invalid'});
    assert.equal(calls.length,1);
    assert.equal(calls[0].body.event,'city_feedback');
    assert.deepEqual(calls[0].body.properties,{distinct_id:'ember-funnel-aggregate',site:'city',rating:'partial',traffic,$process_person_profile:false,$geoip_disable:true});
    assert.equal(calls[0].opts.credentials,'omit');
    assert.equal(calls[0].opts.referrerPolicy,'no-referrer');
  }
});

test('existing session funnel still deduplicates source events and ignores feedback', () => {
  const calls=[], record=createFunnel({search:'?utm_source=wechat_moments',emit:(...a)=>calls.push(a)});
  assert.equal(record('city_open'),true); assert.equal(record('city_open'),false);
  assert.equal(record('city_feedback'),false);
  assert.deepEqual(calls,[['city_open',{source:'wechat_moments'}]]);
});
