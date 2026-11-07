import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 375, height: 667 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const base = process.env.TEST_URL || "http://localhost:4173/";
await page.goto(base);
const saved = '{"existing":"must remain unchanged"}';
await page.evaluate(
  (s) => localStorage.setItem("ember-city-observation-v1", s),
  saved,
);
assert.equal(
  await page.locator("h1").textContent(),
  "同样是逛街，你更想走哪条路？",
);
assert.equal(await page.getByRole("button").count(), 1);
assert.equal(
  await page.getByRole("link", { name: "记录我走过的地方 ↗" }).isVisible(),
  false,
);
await page.screenshot({ path: "/tmp/city-mini-home-375.png", fullPage: true });
let interactions = 0;
await page.getByRole("button", { name: "开始走", exact: true }).tap();
interactions++;
for (const choice of [0, 1]) {
  assert.equal(await page.locator(".route-option").count(), 2);
  assert.equal(await page.locator(".route-option svg").count(), 2);
  await page.screenshot({
    path: "/tmp/city-mini-choice-375.png",
    fullPage: true,
  });
  await page.locator(`[data-choice="${choice}"]`).tap();
  interactions++;
  assert.match(
    await page.locator(".simple-result h2").textContent(),
    new RegExp(`你选了 ${"AB"[choice]}`),
  );
  assert.ok(
    await page.getByText("这次体验完成了", { exact: true }).isVisible(),
  );
  assert.equal(await page.getByRole("button").count(), 1);
  assert.ok(
    await page
      .getByRole("button", { name: "换条路试试", exact: true })
      .isVisible(),
  );
  assert.ok(
    await page.getByRole("link", { name: "记录我走过的地方 ↗" }).isVisible(),
  );
  assert.equal(await page.locator("input,textarea,select,nav").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("ember-city-observation-v1"),
    ),
    saved,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    await page
      .getByRole("button", { name: "换条路试试" })
      .boundingBox()
      .then((b) => b.y + b.height <= 667),
  );
  await page.screenshot({
    path: `/tmp/city-mini-result-${choice}-375.png`,
    fullPage: true,
  });
  if (choice === 0) {
    assert.equal(interactions, 2);
    await page.getByRole("button", { name: "换条路试试" }).tap();
  }
}
await page.getByRole("link", { name: "记录我走过的地方 ↗" }).click();
await page.waitForURL("**/record.html");
assert.ok(
  await page.getByRole("heading", { name: "记下一个地方" }).isVisible(),
);
assert.deepEqual(errors, []);
// Keyboard users can finish through the same two controls.
await page.goto(base);
await page.getByRole("button", { name: "开始走" }).focus();
await page.keyboard.press("Enter");
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
assert.ok(await page.locator(".simple-result").isVisible());
console.log(
  "PASS 2-tap completion, A/B results, retry, 375px touch layout, optional deep-tool link, unchanged storage, keyboard, no console errors",
);
await browser.close();
