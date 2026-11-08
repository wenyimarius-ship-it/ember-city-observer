import test from "node:test";
import assert from "node:assert/strict";
import { createFunnel, IDLE_MS, SESSION_KEY } from "../js/analytics.js";
function memory() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
}
test("two funnel nodes once per session, first source survives reload and second content", () => {
  const storage = memory(),
    events = [];
  let time = 100;
  const args = { storage, now: () => time, send: (...v) => events.push(v) };
  let f = createFunnel({ ...args, source: "wechat_moments" });
  assert.equal(f.shown("content"), false);
  f.shown("home");
  f.shown("content");
  f.shown("content");
  f = createFunnel({ ...args, source: "other" });
  f.shown("home");
  f.shown("content");
  assert.deepEqual(events, [
    ["city_home_session", { source: "wechat_moments" }],
    ["city_content_session", { source: "wechat_moments" }],
  ]);
  time += IDLE_MS;
  f.shown("home");
  f.shown("content");
  assert.deepEqual(events.slice(2), [
    ["city_home_session", { source: "other" }],
    ["city_content_session", { source: "other" }],
  ]);
});
test("activity extends the session; bad/unavailable storage does not break the app", () => {
  const storage = memory(),
    events = [];
  let time = 0;
  const f = createFunnel({
    storage,
    now: () => time,
    send: (...v) => events.push(v),
  });
  f.shown("home");
  time += IDLE_MS - 1;
  f.touch();
  time += IDLE_MS - 1;
  f.shown("home");
  assert.equal(events.length, 1);
  storage.setItem(SESSION_KEY, "{broken");
  f.shown("home");
  assert.equal(events.length, 1);
  const blocked = createFunnel({
    storage: {
      getItem() {
        throw Error("blocked");
      },
    },
    send() {
      throw Error("must not send");
    },
  });
  assert.equal(blocked.shown("home"), false);
});
