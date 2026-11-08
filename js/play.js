import { homeShown, contentShown } from "./analytics.js";
const stage = document.querySelector("#city-play");

const routes = [
  {
    name: "A · 沿街一直走",
    points: [
      [20, 80],
      [115, 80],
      [115, 20],
    ],
    stops: [
      "从入口一眼能看到前面的店。",
      "拐过一个弯，店面还沿着同一条路排开。",
      "走到尽头，回入口得沿原路走。",
    ],
  },
  {
    name: "B · 绕中庭一圈",
    points: [
      [20, 80],
      [20, 20],
      [115, 20],
      [115, 80],
      [20, 80],
    ],
    stops: [
      "进门有两个方向，你先沿中庭往左走。",
      "绕过中庭，背面出现几家刚才没看到的小店。",
      "继续走，又回到了入口附近。",
    ],
  },
];
const reasons = [
  ["一路知道往哪走", "这次逛街，你更看重方向清楚，走起来不用反复判断。"],
  ["走着走着有新发现", "这次逛街，你愿意给意料之外的小店留一点时间。"],
  ["走完好回到入口", "这次逛街，你也在意走完以后怎么回去。"],
  [
    "就是更想走这条",
    "你已经选出这次更想走的路。下次可以留意，是哪一段让你做了决定。",
  ],
];
let routeIndex = 0;
let stopIndex = 0;
let choice = 0;

function map(route, progress = 1, compact = false) {
  const path = route.points.map((point) => point.join(",")).join(" ");
  return `<figure class="play-map"><svg viewBox="0 0 135 100" aria-hidden="true">
    <polyline points="${path}" fill="none" stroke="#9a9b91" stroke-width="4" stroke-dasharray="4 5"/>
    <polyline points="${path}" pathLength="100" fill="none" stroke="#405646" stroke-width="5" stroke-linecap="round" stroke-dasharray="${progress * 100} 100"/>
    <circle cx="20" cy="80" r="5" fill="#405646"/>
    </svg><figcaption>${compact ? "" : route.name + "<br>"}示意路线，非真实地点</figcaption></figure>`;
}

function show(title, body, focus = true) {
  stage.closest("section").classList.remove("result-mode");
  document.querySelector("#record-entry").hidden = true;
  stage.innerHTML = `<h2 tabindex="-1">${title}</h2>${body}`;
  if (focus) stage.querySelector("h2").focus();
}

function walk() {
  const route = routes[routeIndex];
  const lastStop = stopIndex === route.stops.length - 1;
  const nextLabel = !lastStop
    ? "再往前走"
    : routeIndex === 0
      ? "去走 B 路线"
      : "选一条更想逛的路";
  show(
    `路线 ${routeIndex + 1}/2 · 第 ${stopIndex + 1} 站`,
    map(route, stopIndex / (route.stops.length - 1)) +
      `<p>${route.stops[stopIndex]}</p><div class="play-actions"><button class="primary" data-step="next">${nextLabel}</button></div>`,
  );
  contentShown();
}

function compare() {
  show(
    "哪条路你更想继续逛？",
    `<div class="play-maps">${routes.map((route) => map(route)).join("")}</div>
    <div class="play-actions"><button class="primary" data-step="route-a">选 A · 沿街走</button><button class="primary" data-step="route-b">选 B · 绕中庭</button></div>`,
  );
}

function chooseReason() {
  show(
    "什么让你选了这条路？",
    `<p>你选了 ${routes[choice].name}。</p><div class="play-actions">${reasons
      .map(
        ([label], index) =>
          `<button class="primary" data-step="reason-${index}">${label}</button>`,
      )
      .join("")}</div>
    <div class="play-actions"><button data-step="skip-reason">跳过理由</button><button data-step="compare">重新选路线</button></div>`,
  );
}

function result(index) {
  const label = index === null ? null : reasons[index][0];
  const differences = [
    ["一路知道往哪走", "回去要走原路"],
    ["绕一圈有新发现", "岔路多，要自己决定往哪走"],
  ];
  show(
    "我的逛街路线对照卡",
    `<p class="completion">这次路线选择已完成</p><div class="result-cards">${routes
      .map(
        (
          route,
          i,
        ) => `<article class="route-card ${choice === i ? "chosen" : ""}">
      <h3>${route.name}${choice === i ? '<span class="choice-tag">我选这条</span>' : ""}</h3>
      ${map(route, 1, true)}
      <p>好处：${differences[i][0]}</p><p>代价：${differences[i][1]}</p>
    </article>`,
      )
      .join("")}</div>
    <div class="play-result"><p>${label ? "我的理由：" + label : "这次跳过了理由"}</p><p>你选了 ${"AB"[choice]}${label ? `，因为这次你${index === 3 ? "就是更想走这条" : "更想" + label}` : ""}。</p></div>
    <div class="play-actions"><button class="primary" data-step="reason">换个原因再试一次</button></div>`,
  );
  stage.closest("section").classList.add("result-mode");
  document.querySelector("#record-entry").hidden = false;
  stage.scrollIntoView({ block: "start" });
}

stage.addEventListener("click", (event) => {
  const step = event.target.closest("button[data-step]")?.dataset.step;
  if (!step) return;
  if (step === "restart") {
    routeIndex = 0;
    stopIndex = 0;
    walk();
  } else if (step === "next") {
    if (stopIndex < routes[routeIndex].stops.length - 1) {
      stopIndex += 1;
      walk();
    } else if (routeIndex === 0) {
      routeIndex = 1;
      stopIndex = 0;
      walk();
    } else {
      compare();
    }
  } else if (step === "route-a" || step === "route-b") {
    choice = step === "route-a" ? 0 : 1;
    chooseReason();
  } else if (step === "reason") {
    chooseReason();
  } else if (step === "compare") {
    compare();
  } else if (step === "skip-reason") {
    result(null);
  } else if (step.startsWith("reason-")) {
    result(Number(step.slice("reason-".length)));
  }
});
show(
  "先走路线 A",
  '<div class="play-actions"><button class="primary" data-step="restart">开始走</button></div>',
  false,
);

homeShown();
