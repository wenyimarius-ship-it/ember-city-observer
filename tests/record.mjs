import { chromium } from "playwright";
import assert from "node:assert/strict";
import { initial } from "../js/state.js";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const base = process.env.TEST_URL || "http://localhost:4213/";
for (const width of [375, 1440]) {
  const c = await b.newContext({
    viewport: { width, height: 900 },
    hasTouch: width === 375,
    isMobile: width === 375,
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const old = initial();
  old.spaces[0].name = "旧地点";
  old.spaces[0].notes.route = "旧观察不能丢";
  old.spaces[0].nodes = [
    {
      id: "old-node",
      type: "入口",
      label: "旧节点",
      note: "旧停留",
      x: 100,
      y: 100,
    },
  ];
  const raw = JSON.stringify(old);
  const oldCards = JSON.stringify([
    {
      id: "12345678-1234-1234-1234-123456789012",
      name: "原小卡",
      feeling: "原话不能丢",
    },
  ]);
  await p.goto(base);
  await p.evaluate(
    ({ raw, oldCards }) => {
      localStorage.setItem("ember-city-observation-v1", raw);
      localStorage.setItem("ember-city-small-cards-v1", oldCards);
      localStorage.setItem(
        "ember-city-card-session:12345678-1234-1234-1234-123456789012",
        raw,
      );
    },
    { raw, oldCards },
  );
  await p.goto(new URL("record.html", base).href);
  await p.locator("#place").fill("真实到访·庭院");
  await p.getByRole("button", { name: "开始画路线", exact: true }).click();
  async function point(x, y) {
    const box = await p.locator("#record-canvas").boundingBox();
    await p.locator("#record-canvas")[width === 375 ? "tap" : "click"]({
      position: { x: (x / 800) * box.width, y: (y / 500) * box.height },
    });
  }
  for (const [x, y] of [
    [100, 100],
    [600, 100],
    [600, 380],
  ])
    await point(x, y);
  assert.equal(await p.locator("#record-canvas .node").count(), 3);
  await p.locator("#node-tools #toggle-stop").click();
  await p.locator("#record-canvas .node").first().scrollIntoViewIfNeeded();
  const beforeDrag = await p.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ember-city-route-records-v1"))[0].space
        .nodes[0].x,
  );
  let n = await p.locator("#record-canvas .node").first().boundingBox();
  if (width === 375) {
    const session = await c.newCDPSession(p);
    const x = n.x + n.width / 2,
      y = n.y + n.height / 2;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 15, y: y + 10 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await p.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
    await p.mouse.down();
    await p.mouse.move(n.x + n.width / 2 + 15, n.y + n.height / 2 + 10, {
      steps: 3,
    });
    await p.mouse.up();
  }
  assert.equal(await p.locator("#record-canvas .node").count(), 3);
  assert.ok(
    (await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ember-city-route-records-v1"))[0].space
          .nodes[0].x,
    )) > beforeDrag,
  );
  await p.locator("#accessible-nodes").locator("..").locator("summary").click();
  await p.locator('[data-coordinate="x"]').first().fill("100");
  await p.locator('[data-coordinate="x"]').first().dispatchEvent("change");
  await p.locator('[data-coordinate="y"]').first().fill("100");
  await p.locator('[data-coordinate="y"]').first().dispatchEvent("change");
  await p.locator("#mark-mode").click();
  await p.locator('[data-feeling="like"]').click();
  await point(300, 100);
  await p.locator('[data-feeling="shop"]').click();
  await point(600, 250);
  assert.equal(await p.locator("#record-canvas .marker").count(), 2);
  // Editing and deleting feelings must update the map immediately.
  await p.locator("[data-marker-kind]").first().selectOption("lost");
  assert.match(
    await p
      .locator("#record-canvas .marker")
      .first()
      .getAttribute("aria-label"),
    /有点绕/,
  );
  assert.equal(
    await p.locator("#record-canvas .marker text").first().textContent(),
    "↝",
  );
  await p.locator("[data-remove-marker]").first().click();
  assert.equal(await p.locator("#record-canvas .marker").count(), 1);
  await p.locator('[data-feeling="like"]').click();
  await point(300, 100);
  // A drag on a route in marking mode is not a tap / extra feeling.
  await p.locator("#record-canvas").scrollIntoViewIfNeeded();
  const box = await p.locator("#record-canvas").boundingBox();
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.2;
  if (width === 375) {
    const session = await c.newCDPSession(p);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 35, y: y + 20 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await p.mouse.move(x, y);
    await p.mouse.down();
    await p.mouse.move(x + 35, y + 20, { steps: 3 });
    await p.mouse.up();
  }
  assert.equal(await p.locator("#record-canvas .marker").count(), 2);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({
    path: `/tmp/city-route-editor-${width}.png`,
    fullPage: true,
  });
  await p.locator("#finish").click();
  assert.match(await p.locator("#result").textContent(), /这条路线已记下/);
  assert.match(
    await p.locator("#result").textContent(),
    /喜欢这里 1 处、发现有趣的店 1 处/,
  );
  assert.ok(
    await p.getByRole("button", { name: "继续编辑", exact: true }).isVisible(),
  );
  assert.equal(
    await p.getByRole("button", { name: "再记一个地方", exact: true }).count(),
    1,
  );
  assert.ok(
    await p
      .getByRole("link", { name: "返回 City 首页", exact: true })
      .isVisible(),
  );
  assert.equal(await p.locator("#result svg .node").count(), 3);
  assert.equal(await p.locator("#result svg .marker").count(), 2);
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({
    path: `/tmp/city-route-card-${width}.png`,
    fullPage: true,
  });
  await p.reload();
  await p.locator("[data-open]").click();
  assert.equal(await p.locator("#result .marker").count(), 2);
  await p.locator("#edit-route").click();
  await p.locator("#record-canvas .node").first().focus();
  await p.keyboard.press("ArrowRight");
  await p.locator("#delete-node").click();
  assert.equal(await p.locator("#record-canvas .node").count(), 2);
  assert.equal(
    (await p.locator("#record-canvas polyline").getAttribute("points")).split(
      " ",
    ).length,
    2,
  );
  await p.locator("#finish").click();
  await p.locator("#new-place").click();
  await p.locator("#place").fill("第二处街区");
  await p.getByRole("button", { name: "开始画路线", exact: true }).click();
  await point(120, 120);
  await point(650, 360);
  await p.locator("#finish").click();
  assert.match(
    await p.locator("#result").textContent(),
    /这次没有添加感受标记/,
  );
  assert.equal(await p.locator("#result .marker").count(), 0);
  assert.ok(await p.locator("#graphic-compare").isVisible());
  await p.locator("#graphic-compare").click();
  assert.equal(await p.locator(".graphic-pair .route-card").count(), 2);
  await p.locator(".advanced summary").click();
  await p.locator("#advanced-record").click();
  await p.waitForURL("**/desk.html?session=*#route");
  assert.equal(
    await p.locator('[data-field="name"]').first().inputValue(),
    "第二处街区",
  );
  assert.equal(await p.locator("#canvas .route-node").count(), 2);
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ember-city-observation-v1")),
    raw,
  );
  assert.equal(
    await p.evaluate(() => localStorage.getItem("ember-city-small-cards-v1")),
    oldCards,
  );
  await p.goto(new URL("desk.html", base).href);
  assert.equal(
    await p.locator('[data-field="name"]').first().inputValue(),
    "旧地点",
  );
  assert.equal(await p.locator("#canvas .route-node").count(), 1);
  await p.goto(new URL("record.html", base).href);
  await p.locator(".advanced summary").click();
  await p.getByRole("link", { name: "打开原小卡路线 →" }).click();
  assert.equal(
    await p.locator('[data-field="name"]').first().inputValue(),
    "旧地点",
  );
  assert.equal(await p.locator("#canvas .route-node").count(), 1);
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${width}px B/C/D: create, SVG add/drag/delete/coordinates, 2 feelings, review, skip, restore, optional graphical comparison, old data unchanged`,
  );
  await c.close();
}
await b.close();
