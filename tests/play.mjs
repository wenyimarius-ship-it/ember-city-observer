import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://localhost:4173/");
await page.locator('[data-step="restart"]').click();
for (let i = 0; i < 6; i++) await page.locator('[data-step="next"]').click();
for (const choice of ["a", "b"]) {
  await page.locator(`[data-step="route-${choice}"]`).click();
  await page.locator('[data-step="reason-0"]').click();
  assert.equal(await page.locator(".route-card").count(), 2);
  assert.equal(await page.getByText("我选这条", { exact: true }).count(), 1);
  assert.match(
    await page.locator(".route-card.chosen h3").textContent(),
    new RegExp(choice.toUpperCase()),
  );
  assert.match(
    await page.locator(".route-card").nth(0).textContent(),
    /回去要走原路/,
  );
  assert.match(
    await page.locator(".route-card").nth(1).textContent(),
    /岔路多，要自己决定往哪走/,
  );
  assert.equal(
    await page.getByText("示意路线，非真实地点", { exact: true }).count(),
    2,
  );
  assert.equal(
    await page
      .locator(".play-result")
      .textContent()
      .then((t) =>
        t.includes(
          `你选了 ${choice.toUpperCase()}，因为这次你更想一路知道往哪走`,
        ),
      ),
    true,
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  const boxes = await page.locator(".route-card").all();
  const a = await boxes[0].boundingBox(),
    b = await boxes[1].boundingBox();
  assert.ok(b.y >= a.y + a.height);
  await page.locator('[data-step="reason"]').click();
  await page.locator('[data-step="reason-1"]').click();
  assert.match(
    await page.locator(".play-result").textContent(),
    /走着走着有新发现/,
  );
  await page.screenshot({
    path: `/tmp/city-result-${choice}-375.png`,
    fullPage: true,
  });
  await page.locator('[data-step="reason"]').click();
  await page.locator('[data-step="compare"]').click();
}
assert.deepEqual(errors, []);
console.log(
  "PASS A/B selection, equal comparison cards, changed reason, 375px stacking and no overflow",
);
await browser.close();
