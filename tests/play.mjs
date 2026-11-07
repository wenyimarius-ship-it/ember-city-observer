import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
for (const width of [375, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 812 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(process.env.TEST_URL || "http://localhost:4173/");
  await page.locator('[data-step="restart"]').click();
  for (let i = 0; i < 6; i++) {
    assert.match(
      await page.locator("#city-play h2").textContent(),
      new RegExp(`路线 ${i < 3 ? 1 : 2}/2 · 第 ${(i % 3) + 1} 站`),
    );
    await page.locator('[data-step="next"]').click();
  }
  for (const choice of ["a", "b"]) {
    await page.locator(`[data-step="route-${choice}"]`).click();
    await page.locator('[data-step="reason-0"]').click();
    assert.ok(
      await page.getByText("这次路线选择已完成", { exact: true }).isVisible(),
    );
    assert.ok(
      await page.getByRole("link", { name: "记下一个地方 ↗" }).isVisible(),
    );
    assert.equal(
      await page.locator("#city-play .play-actions button").count(),
      1,
    );
    assert.ok(await page.locator("#record-entry").isVisible());
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
    const [a, b] = await page.locator(".route-card").evaluateAll((cards) =>
      cards.map((card) => {
        const r = card.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    assert.ok(width === 375 ? b.y >= a.y + a.height : b.x >= a.x + a.width);
    await page.locator('[data-step="reason"]').click();
    await page.locator('[data-step="reason-1"]').click();
    assert.match(
      await page.locator(".play-result").textContent(),
      /走着走着有新发现/,
    );
    await page.screenshot({
      path: `/tmp/city-result-${choice}-${width}.png`,
      fullPage: true,
    });
    await page.locator('[data-step="reason"]').click();
    await page.locator('[data-step="skip-reason"]').click();
    assert.match(
      await page.locator(".play-result").textContent(),
      /这次跳过了理由/,
    );
    assert.ok(
      !(await page.locator(".play-result").textContent()).includes("因为"),
    );
    await page.locator('[data-step="reason"]').click();
    await page.locator('[data-step="compare"]').click();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS A/B selection, equal comparison cards, changed reason, 375px stacking and no overflow",
  );
  await page.close();
}
await browser.close();
