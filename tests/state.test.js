import test from "node:test";
import assert from "node:assert/strict";
import { initial, addNode, moveNode, validate, demo } from "../js/state.js";
test("independent spaces and order survive JSON round trip", () => {
  const d = initial();
  addNode(d.spaces[0], "入口");
  addNode(d.spaces[0], "停留");
  d.spaces[0].nodes[1].note = "中文停留";
  d.spaces[0].nodes[0].x = 230;
  moveNode(d.spaces[0], 0, 1);
  d.spaces[0].notes.route = "折返";
  assert.equal(d.spaces[1].nodes.length, 0);
  const restored = validate(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(restored, d);
  assert.equal(restored.spaces[0].nodes[0].note, "中文停留");
  restored.spaces[0].nodes.splice(0, 1);
  assert.equal(restored.spaces[0].nodes.length, 1);
});
test("reject corrupt or malicious backups", () => {
  for (const mutate of [
    (d) => d.spaces.pop(),
    (d) => (d.spaces[0].notes = null),
    (d) => (d.active = 3),
    (d) =>
      d.spaces[0].nodes.push({
        id: "x",
        label: "a",
        note: "",
        type: "入口",
        x: Infinity,
        y: 50,
      }),
    (d) => (d.reason = 123),
    (d) => (d.preference = "C"),
  ]) {
    const d = initial();
    mutate(d);
    assert.throws(() => validate(d));
  }
  const d = demo();
  d.spaces[0].nodes[1].id = d.spaces[0].nodes[0].id;
  assert.throws(() => validate(d));
});
test("demo is explicitly marked and valid", () => {
  assert.equal(validate(demo()).demo, true);
});

import {
  createRecord,
  checkRecords,
  closestPoint,
  review,
} from "../js/route-record.js";
test("route records validate independently and recap only recorded events", () => {
  const r = createRecord("庭院");
  r.space.nodes = [
    { id: "a", label: "入口", type: "入口", note: "", x: 100, y: 100 },
    { id: "b", label: "停留", type: "停留", note: "", x: 500, y: 100 },
  ];
  r.space.markers = [{ id: "m", kind: "like", x: 300, y: 100, note: "" }];
  assert.deepEqual(checkRecords([r]), [r]);
  assert.match(review(r), /1 个停留点，标记了喜欢这里 1 处/);
  assert.deepEqual(closestPoint(r.space.nodes, { x: 250, y: 150 }), {
    x: 250,
    y: 100,
    distance: 50,
  });
  r.space.markers[0].kind = "invalid";
  assert.throws(() => checkRecords([r]));
});
