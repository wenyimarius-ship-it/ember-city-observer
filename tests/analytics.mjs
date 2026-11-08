// Deployed-origin simulation with a mocked collector. This is NOT live Vercel ingestion.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const origin = "https://city-funnel-preview.vercel.app";
const root = process.cwd();
async function scenario(source) {
  const c = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const events = [],
    errors = [];
  let failContent = false;
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await c.route(origin + "/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/_vercel/insights/event") {
      events.push(JSON.parse(route.request().postData()));
      return route.fulfill({ status: 200, body: "{}" });
    }
    if (u.pathname === "/_vercel/insights/script.js")
      return route.fulfill({
        contentType: "text/javascript",
        body: `let beforeSend=e=>e;const handle=(type,arg)=>{if(type==='beforeSend')beforeSend=arg;if(type==='event'){const e=beforeSend({type:'event',url:location.href});if(e)fetch('/_vercel/insights/event',{method:'POST',body:JSON.stringify({name:arg.name,data:arg.data,url:e.url})});}};for(const args of window.vaq||[])handle(...args);window.va=handle;`,
      });
    if (failContent && u.pathname === "/js/play.js") return route.abort();
    const relative =
      u.pathname === "/"
        ? "index.html"
        : decodeURIComponent(u.pathname.slice(1));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep))
      return route.fulfill({ status: 404, body: "" });
    try {
      const body = await readFile(file);
      return route.fulfill({
        body,
        contentType: file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "text/html",
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await p.goto(origin + "/?utm_source=" + source + "&private_query=never_send");
  await p.waitForFunction(
    () =>
      window.va &&
      document.querySelector('script[src="/_vercel/insights/script.js"]'),
  );
  await p.waitForTimeout(100);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "city_home_session");
  await p.locator('[data-step="restart"]').click();
  assert.match(
    await p.locator("#city-play h2").textContent(),
    /路线 1\/2 · 第 1 站/,
  );
  await p.waitForTimeout(100);
  assert.equal(events.length, 2);
  // Return home without UTM and open route B successfully. Both nodes stay once.
  await p.goto(origin + "/");
  await p.locator('[data-step="restart"]').click();
  for (let i = 0; i < 3; i++) await p.locator('[data-step="next"]').click();
  assert.match(
    await p.locator("#city-play h2").textContent(),
    /路线 2\/2 · 第 1 站/,
  );
  await p.waitForTimeout(100);
  assert.equal(events.length, 2);
  await p.goto(origin + "/record.html");
  await p.locator("#place").fill("不要收集的个人地点");
  await p.getByRole("button", { name: "开始画路线", exact: true }).click();
  await p.goBack();
  await p.reload();
  await p.waitForTimeout(100);
  assert.equal(events.length, 2);
  assert.deepEqual(
    events.map((e) => ({ name: e.name, data: e.data })),
    [
      {
        name: "city_home_session",
        data: {
          source: source === "wechat_moments" ? "wechat_moments" : "other",
        },
      },
      {
        name: "city_content_session",
        data: {
          source: source === "wechat_moments" ? "wechat_moments" : "other",
        },
      },
    ],
  );
  assert.ok(events.every((e) => e.url === origin + "/"));
  assert.ok(!JSON.stringify(events).includes("private_query"));
  assert.ok(!JSON.stringify(events).includes("个人地点"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS",
    source,
    "home → A → return → B; 2 total events, source retained, no inputs/query",
  );
  await c.close();
  return events;
}
const moments = await scenario("wechat_moments"),
  other = await scenario("someone@example.com");
const all = [...moments, ...other];
const selected = all.filter((e) => e.data.source === "wechat_moments");
const home = selected.filter((e) => e.name === "city_home_session").length,
  content = selected.filter((e) => e.name === "city_content_session").length;
assert.equal(home, 1);
assert.equal(content, 1);
console.log(
  "PASS source filter: mocked Moments home=1, content=1, rate=100% (test fixture only, not live statistics)",
);
await browser.close();
