import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const BASE = process.env.TEST_URL || "http://127.0.0.1:4173";
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(BASE);
await page.locator('[data-space="0"][data-field="name"]').fill("上海·城市庭院");
await page.locator('[data-space="1"][data-field="name"]').fill("北京·街区");
await page.locator('[data-space="0"][data-field="date"]').fill("2026-11-07");
for (const t of ["入口", "途经", "停留", "出口"])
  await page.locator(`[data-add="${t}"]`).click();
assert.equal(await page.locator("#canvas .route-node").count(), 4);
await page.locator('[data-prop="label"]').nth(2).fill("中文咖啡停留");
await page
  .locator('[data-prop="note"]')
  .nth(2)
  .fill("光线柔和，我想在这里多停留。");
await page.locator('[data-note="route"]').fill("动线有转角，但我没有迷路。");
await page.locator('[data-note="selection"]').fill("书店与咖啡店相邻。");
await page.locator("#preference").selectOption("A");
await page.locator("#reason").fill("更喜欢庭院里的自然光。");
await page.locator("#canvas").scrollIntoViewIfNeeded();
const node = page.locator("#canvas .route-node").first();
let rect = await node.boundingBox();
await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
await page.mouse.down();
await page.mouse.move(
  rect.x + rect.width / 2 + 80,
  rect.y + rect.height / 2 + 50,
  { steps: 5 },
);
await page.mouse.up();
let d = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("ember-city-observation-v1")),
);
assert.ok(d.spaces[0].nodes[0].x > 100);
await page.locator("#canvas .route-node").first().focus();
const before = d.spaces[0].nodes[0].x;
await page.keyboard.press("ArrowRight");
d = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("ember-city-observation-v1")),
);
assert.equal(d.spaces[0].nodes[0].x, before + 5);
await page.locator('[data-order="-1"]').nth(2).click();
await page.locator("[data-delete]").nth(1).click();
assert.equal(await page.locator("#canvas .route-node").count(), 3);
assert.equal(
  (await page.locator("#canvas polyline").getAttribute("points")).split(" ")
    .length,
  3,
);
await page.locator('[data-active="1"]').click();
assert.equal(await page.locator("#canvas .route-node").count(), 0);
await page.locator('[data-add="出口"]').click();
await page.locator('[data-note="atmosphere"]').fill("街区更热闹。");
await page.reload();
assert.equal(await page.locator("#canvas .route-node").count(), 1);
await page.locator('[data-active="0"]').click();
assert.equal(await page.locator("#canvas .route-node").count(), 3);
assert.equal(
  await page.locator('[data-note="route"]').inputValue(),
  "动线有转角，但我没有迷路。",
);
const backup = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#backup").click(),
]);
await backup[0].saveAs("/tmp/city-backup.json");
const saved = JSON.parse(await fs.readFile("/tmp/city-backup.json", "utf8"));
assert.equal(saved.spaces[1].notes.atmosphere, "街区更热闹。");
await page
  .locator("#import")
  .setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
assert.match(await page.locator("#message").textContent(), /导入失败/);
await page.locator("#reset").click();
await page.locator("#accept").click();
assert.equal(await page.locator("#canvas .route-node").count(), 0);
await page.locator("#import").setInputFiles("/tmp/city-backup.json");
await page.locator("#accept").click();
assert.equal(await page.locator("#canvas .route-node").count(), 3);
await page.locator("#png").scrollIntoViewIfNeeded();
const [png] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#png").click(),
]);
await png.saveAs("/tmp/city-card.png");
const bytes = await fs.readFile("/tmp/city-card.png");
assert.equal(bytes.subarray(1, 4).toString(), "PNG");
console.log(
  "PNG",
  bytes.readUInt32BE(16),
  bytes.readUInt32BE(20),
  bytes.length,
);
for (const width of [320, 390, 700, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `overflow at ${width}`,
  );
  await page.screenshot({ path: `/tmp/city-${width}.png`, fullPage: true });
}
assert.deepEqual(errors, []);
console.log(
  "PASS desktop: CRUD, drag, keyboard, isolation, persistence, JSON, PNG, Chinese input, four widths, no console errors",
);
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mp = await mobile.newPage();
await mp.goto(BASE);
await mp.locator('[data-add="入口"]').tap();
await mp.locator("#canvas").scrollIntoViewIfNeeded();
rect = await mp.locator("#canvas .route-node").boundingBox();
const session = await mobile.newCDPSession(mp);
const x = rect.x + rect.width / 2,
  y = rect.y + rect.height / 2;
await session.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x, y }],
});
await session.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: x + 65, y: y + 40 }],
});
await session.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
d = await mp.evaluate(() =>
  JSON.parse(localStorage.getItem("ember-city-observation-v1")),
);
assert.ok(d.spaces[0].nodes[0].x > 150);
const sy = await mp.evaluate(() => scrollY);
await session.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: 330, y: 500 }],
});
await session.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: 330, y: 300 }],
});
await session.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await mp.waitForTimeout(200);
assert.ok((await mp.evaluate(() => scrollY)) > sy);
console.log("PASS emulated touch drag and blank-area scroll");
// Storage denial must remain editable and offer JSON backup.
const denied = await browser.newContext();
await denied.addInitScript(() => {
  Storage.prototype.setItem = function () {
    throw new DOMException("Quota exceeded", "QuotaExceededError");
  };
});
const dp = await denied.newPage();
await dp.goto(BASE);
await dp
  .locator('[data-space="0"][data-field="name"]')
  .fill("存储失败仍可编辑");
assert.match(await dp.locator("#save-status").textContent(), /未能自动保存/);
const [db] = await Promise.all([
  dp.waitForEvent("download"),
  dp.locator("#backup").click(),
]);
assert.equal(db.suggestedFilename(), "city-observation.json");
const corrupt = await browser.newContext();
await corrupt.addInitScript(() =>
  localStorage.setItem("ember-city-observation-v1", "{broken"),
);
const cp = await corrupt.newPage();
await cp.goto(BASE);
assert.match(await cp.locator("#message").textContent(), /数据损坏/);
assert.equal(
  await cp.evaluate(() => localStorage.getItem("ember-city-observation-v1")),
  "{broken",
);
// User input is rendered as text; long Chinese content expands the PNG.
await page
  .locator('[data-space="0"][data-field="name"]')
  .fill("<img src=x onerror=alert(1)>");
assert.equal(await page.locator("#comparison img").count(), 0);
await page
  .locator('[data-note="stay"]')
  .fill("这里的光线让我愿意停留。".repeat(80));
const [longPng] = await Promise.all([
  page.waitForEvent("download"),
  page.locator("#png").click(),
]);
await longPng.saveAs("/tmp/city-long-card.png");
const longBytes = await fs.readFile("/tmp/city-long-card.png");
assert.ok(longBytes.readUInt32BE(20) > bytes.readUInt32BE(20));
console.log(
  "PASS storage failure, corrupt storage preservation, escaped HTML, long Chinese PNG",
);
await browser.close();
