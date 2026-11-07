const stage = document.querySelector("#city-play");
const intro = document.querySelector("#play-intro");
const more = document.querySelector("#city-more");
const routes = [
  {
    name: "A · 沿街一直走",
    points: "20,80 115,80 115,20",
    explanation: "这条路沿街展开，回入口时要走原路。",
  },
  {
    name: "B · 绕中庭一圈",
    points: "20,80 20,20 115,20 115,80 20,80",
    explanation: "这条路绕中庭一圈，又回到入口附近。",
  },
];
function map(route) {
  return `<svg viewBox="0 0 135 100" aria-hidden="true"><polyline points="${route.points}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="80" r="5" fill="currentColor"/></svg>`;
}
function focusTitle() {
  stage.querySelector("h2").focus();
}
function choose() {
  intro.hidden = true;
  more.hidden = true;
  stage.innerHTML = `<h2 tabindex="-1">点一条你想走的路</h2><div class="route-options">${routes.map((r, i) => `<button class="route-option" data-choice="${i}" aria-label="选择 ${r.name}">${map(r)}<span>${r.name}</span></button>`).join("")}</div><p class="map-caption">示意路线，非真实地点</p>`;
  focusTitle();
}
stage.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "start" || button.dataset.action === "again") {
    choose();
    return;
  }
  if (button.dataset.choice === undefined) return;
  const route = routes[Number(button.dataset.choice)];
  if (!route) return;
  stage.innerHTML = `<article class="simple-result"><p class="finished">这次体验完成了</p><h2 tabindex="-1">你选了 ${route.name}</h2>${map(route)}<p>${route.explanation}</p></article><button class="primary" data-action="again">换条路试试</button>`;
  more.hidden = false;
  focusTitle();
});
