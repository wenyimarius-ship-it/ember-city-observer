import { chromium } from "playwright";
import assert from "node:assert/strict";
import { initial } from "../js/state.js";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await b.newContext({
  viewport: { width: 375, height: 812 },
  acceptDownloads: true,
});
const p = await context.newPage();
const base = process.env.TEST_URL || "http://localhost:4183/";
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const old = initial();
old.spaces[0].name = "旧地点不能覆盖";
old.spaces[0].notes.stay = "旧观察";
const raw = JSON.stringify(old);
await p.goto(base);
await p.evaluate(
  (raw) => localStorage.setItem("ember-city-observation-v1", raw),
  raw,
);
await p.goto(new URL("record.html", base).href);
await p.screenshot({ path: "/tmp/city-record-form-375.png", fullPage: true });
assert.equal(await p.locator("#quick-form input").count(), 1);
assert.equal(await p.locator("#quick-form textarea").count(), 1);
assert.equal(await p.getByText("对照这两个地方", { exact: true }).count(), 0);
assert.equal(await p.getByText("画一下路线", { exact: true }).count(), 0);
await p.locator("#place").fill("第一处街角");
const words = "  我想在这里多走一会儿。\n风很舒服。  ";
await p.locator("#feeling").fill(words);
await p.getByRole("button", { name: "生成我的小卡" }).click();
assert.equal(await p.locator(".small-card p").textContent(), words);
assert.equal(await p.getByText("对照这两个地方", { exact: true }).count(), 0);
assert.ok(await p.locator("#another").isVisible());
await p.screenshot({ path: "/tmp/city-single-card-375.png", fullPage: true });
await p.locator("[data-export]").click();
const [json] = await Promise.all([
  p.waitForEvent("download"),
  p.locator("[data-json]").click(),
]);
assert.equal(json.suggestedFilename(), "我的地点小卡.json");
const [png] = await Promise.all([
  p.waitForEvent("download"),
  p.locator("[data-png]").click(),
]);
await png.saveAs("/tmp/city-small-card.png");
await p.reload();
assert.equal(await p.locator(".small-card").count(), 1);
await p.getByRole("button", { name: "再记一个地方" }).click();
await p.locator("#place").fill("第二处中庭");
await p.locator("#feeling").fill("走起来有点绕。");
await p.getByRole("button", { name: "生成我的小卡" }).click();
assert.equal(await p.locator(".small-card").count(), 2);
assert.ok(await p.getByRole("button", { name: "对照这两个地方" }).isVisible());
assert.equal(
  await p.evaluate(() => localStorage.getItem("ember-city-observation-v1")),
  raw,
);
assert.ok(
  await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await p.screenshot({ path: "/tmp/city-record-375.png", fullPage: true });
await p.locator("[data-draw]").first().click();
await p.waitForURL("**/desk.html?session=*");
await p.locator('[data-add="停留"]').click();
await p.goto(new URL("record.html", base).href);
await p.locator("[data-draw]").first().click();
assert.equal(await p.locator("#canvas .route-node").count(), 1);
await p.goto(new URL("record.html", base).href);
await p.getByRole("button", { name: "对照这两个地方" }).click();
await p.waitForURL("**#compare");
assert.match(await p.locator("#comparison").textContent(), /第一处街角/);
assert.match(await p.locator("#comparison").textContent(), /第二处中庭/);
await p.goto(new URL("desk.html", base).href);
assert.equal(
  await p.locator('[data-field="name"]').first().inputValue(),
  "旧地点不能覆盖",
);
assert.equal(
  await p.evaluate(() => localStorage.getItem("ember-city-observation-v1")),
  raw,
);
assert.deepEqual(errors, []);
console.log(
  "PASS two-field card, verbatim text, second-card gating, 375px, reload, per-card routes, comparison, old data preserved",
);
await b.close();
