import {
  initial,
  validate,
  dimensions,
  types,
  addNode,
  moveNode,
  demo,
} from "./state.js";
import { download, cardPNG, summary } from "./export.js";
const $ = (s) => document.querySelector(s),
  key = "ember-city-observation-v1";
let data = initial(),
  selected = null,
  compare = "route",
  pending = null,
  storageFailed = false;
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function message(s) {
  $("#message").textContent = s;
}
try {
  const saved = localStorage.getItem(key);
  if (saved) data = validate(JSON.parse(saved));
} catch {
  message(
    "无法读取已保存记录：数据损坏或浏览器存储不可用。未覆盖原数据；可导入 JSON 恢复，或清空后开始。",
  );
  storageFailed = true;
}
function save() {
  try {
    if (storageFailed) throw Error();
    localStorage.setItem(key, JSON.stringify(data));
    $("#save-status").textContent =
      "已自动保存 · " + new Date().toLocaleTimeString("zh-CN");
  } catch {
    $("#save-status").textContent = "未能自动保存，请导出 JSON 备份";
  }
}
function routeSVG(s, interactive = false) {
  const points = s.nodes.map((n) => `${n.x},${n.y}`).join(" ");
  return `<polyline class="route-line" points="${points}"/>${s.nodes.map((n, i) => `<g class="route-node ${selected === n.id ? "selected" : ""}" data-id="${esc(n.id)}" data-type="${n.type}" ${interactive ? 'tabindex="0" role="button"' : ""} aria-label="${i + 1}. ${esc(n.label)}，${n.type}。方向键调整位置"><title>${esc(n.label)} / ${n.type}${n.note ? "：" + esc(n.note) : ""}</title>${interactive ? `<circle class="hit" cx="${n.x}" cy="${n.y}" r="55"/>` : ""}<circle cx="${n.x}" cy="${n.y}" r="${interactive ? 20 : 16}"/><text x="${n.x}" y="${n.y + 5}">${i + 1}</text></g>`).join("")}${!s.nodes.length ? '<text x="400" y="250" text-anchor="middle" fill="#6d746c" font-size="18">添加第一个节点，开始记录你的路线</text>' : ""}`;
}
function thumbnail(s) {
  return `<svg viewBox="0 0 800 500" role="img" aria-label="${esc(s.name || "未命名空间")}的抽象路线">${routeSVG(s)}</svg>`;
}
function forms() {
  $("#space-forms").innerHTML = data.spaces
    .map(
      (s, i) =>
        `<div class="space-form"><h3>SPACE ${"AB"[i]} ${data.demo ? " / DEMO · 虚构示例" : ""}</h3><label>地点名称<input data-space="${i}" data-field="name" maxlength="200" value="${esc(s.name)}" placeholder="给这次观察一个地点"></label><div class="field-row"><label>城市（可选）<input data-space="${i}" data-field="city" maxlength="200" value="${esc(s.city)}"></label><label>空间类型<select data-space="${i}" data-field="type">${["商场", "街区", "商业综合体", "其他"].map((t) => `<option ${s.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div><label>简短描述<textarea data-space="${i}" data-field="description" maxlength="10000">${esc(s.description)}</textarea></label><label>观察日期（可选）<input type="date" data-space="${i}" data-field="date" value="${s.date}"></label></div>`,
    )
    .join("");
}
function drawing() {
  const s = data.spaces[data.active];
  $("#space-tabs").innerHTML = data.spaces
    .map(
      (_, i) =>
        `<button data-active="${i}" aria-pressed="${data.active === i}" class="${data.active === i ? "active" : ""}">Space ${"AB"[i]}</button>`,
    )
    .join("");
  $("#active-caption").textContent =
    `正在编辑 Space ${"AB"[data.active]} / ${s.name || "未命名空间"}${data.demo ? " · Demo 虚构示例" : ""}`;
  $("#canvas").innerHTML = routeSVG(s, true);
  $("#node-count").textContent = `${s.nodes.length} NODES`;
  $("#add-tools").innerHTML = types
    .map(
      (t) =>
        `<button data-add="${t}" ${s.nodes.length >= 100 ? "disabled" : ""}>＋ ${t}</button>`,
    )
    .join("");
  list();
  $("#notes").innerHTML = dimensions
    .map(
      ([k, label]) =>
        `<label>${label}<textarea data-note="${k}" maxlength="10000" placeholder="写下你的观察，而不是标准答案…">${esc(s.notes[k])}</textarea></label>`,
    )
    .join("");
}
function list() {
  const s = data.spaces[data.active];
  $("#node-list").innerHTML =
    s.nodes
      .map(
        (n, i) =>
          `<div class="node-editor ${selected === n.id ? "selected" : ""}" data-editor="${esc(n.id)}"><div class="node-head"><strong>${String(i + 1).padStart(2, "0")} / ${n.type}</strong><button data-order="-1" data-id="${esc(n.id)}" ${i === 0 ? "disabled" : ""} aria-label="节点 ${i + 1} 上移">↑</button><button data-order="1" data-id="${esc(n.id)}" ${i === s.nodes.length - 1 ? "disabled" : ""} aria-label="节点 ${i + 1} 下移">↓</button><button data-delete="${esc(n.id)}" aria-label="删除节点 ${i + 1}">×</button></div><label>名称<input data-node="${esc(n.id)}" data-prop="label" maxlength="200" value="${esc(n.label)}"></label><label>节点类型<select data-node="${esc(n.id)}" data-prop="type">${types.map((t) => `<option ${n.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><div class="field-row">${["x", "y"].map((axis) => `<label>${axis.toUpperCase()} 坐标<input type="number" min="20" max="${axis === "x" ? 780 : 480}" data-node="${esc(n.id)}" data-prop="${axis}" value="${Math.round(n[axis])}"></label>`).join("")}</div><label>${n.type === "停留" ? "停留观察" : "节点记录"}<textarea data-node="${esc(n.id)}" data-prop="note" maxlength="10000">${esc(n.note)}</textarea></label></div>`,
      )
      .join("") ||
    '<p class="hint">路线尚为空。添加入口、途经、停留或出口节点。</p>';
}
const filters = [
  ["route", "Route / 动线"],
  ["selection", "Selection / 选品"],
  ["atmosphere", "Atmosphere / 氛围"],
  ["orientation", "Orientation / 方向感"],
  ["overall", "Overall Experience / 整体体验"],
];
function results() {
  $("#compare-tabs").innerHTML = filters
    .map(
      ([k, label]) =>
        `<button data-compare="${k}" class="${compare === k ? "active" : ""}" aria-pressed="${compare === k}">${label}</button>`,
    )
    .join("");
  $("#comparison").innerHTML = data.spaces
    .map(
      (s, i) =>
        `<article class="compare-panel"><h3>SPACE ${"AB"[i]} ${data.demo ? " / DEMO" : ""}</h3><h2>${esc(s.name || "未命名空间")}</h2><p>${esc(s.city)} ${esc(s.date)}</p>${thumbnail(s)}${(compare === "overall" ? dimensions : dimensions.filter(([k]) => k === compare)).map(([k, label]) => `<small>${label}</small><p>${esc(s.notes[k] || "尚未记录")}</p>`).join("")}${compare === "route" ? s.nodes.map((n, j) => `<p>${j + 1}. ${esc(n.label)} / ${n.type}${n.note ? " — " + esc(n.note) : ""}</p>`).join("") : ""}</article>`,
    )
    .join("");
  $("#card-preview").innerHTML =
    `<div class="card-brand">EMBER LAB / FIELD NOTES ${data.demo ? " / DEMO · 虚构示例" : ""}</div><div class="card-title">How a City Moves You</div><div class="two-col">${data.spaces.map((s, i) => `<article class="card-space"><h3>${"AB"[i]} / ${esc(s.name || "未命名空间")}</h3><p>${esc(s.city || "城市未填写")} · ${s.type} · ${s.date || "观察日期未填写"}</p><p>${esc(s.description)}</p>${thumbnail(s)}${dimensions.map(([k, label]) => `<div class="card-dim"><b>${label}</b><p>${esc(s.notes[k] || "尚未记录")}</p></div>`).join("")}</article>`).join("")}</div><p class="card-summary">${esc(summary(data))}</p><p class="hint">个人主观记录 · 抽象路线不代表真实平面比例或测量距离</p>`;
}
function render() {
  forms();
  drawing();
  results();
  $("#preference").value = data.preference;
  $("#reason").value = data.reason;
}
function changed() {
  save();
  results();
}
$("#space-forms").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.field) {
    data.spaces[+t.dataset.space][t.dataset.field] = t.value;
    $("#active-caption").textContent =
      `正在编辑 Space ${"AB"[data.active]} / ${data.spaces[data.active].name || "未命名空间"}${data.demo ? " · Demo 虚构示例" : ""}`;
    changed();
  }
});
$("#space-tabs").onclick = (e) => {
  const b = e.target.closest("[data-active]");
  if (!b) return;
  data.active = +b.dataset.active;
  selected = null;
  drawing();
  save();
};
$("#add-tools").onclick = (e) => {
  if (!e.target.dataset.add) return;
  try {
    addNode(data.spaces[data.active], e.target.dataset.add);
    selected = data.spaces[data.active].nodes.at(-1).id;
    drawing();
    changed();
  } catch (err) {
    message(err.message);
  }
};
$("#node-list").onclick = (e) => {
  const t = e.target;
  const s = data.spaces[data.active];
  if (t.dataset.delete) {
    s.nodes = s.nodes.filter((n) => n.id !== t.dataset.delete);
    selected = null;
    drawing();
    changed();
  }
  if (t.dataset.order) {
    moveNode(
      s,
      s.nodes.findIndex((n) => n.id === t.dataset.id),
      +t.dataset.order,
    );
    drawing();
    changed();
  }
};
$("#node-list").addEventListener("input", (e) => {
  const t = e.target,
    n = data.spaces[data.active].nodes.find((n) => n.id === t.dataset.node);
  if (!n) return;
  const k = t.dataset.prop;
  if (k === "x" || k === "y") {
    if (t.value === "" || !Number.isFinite(+t.value)) return;
    n[k] = Math.max(20, Math.min(k === "x" ? 780 : 480, +t.value));
  } else n[k] = t.value;
  $("#canvas").innerHTML = routeSVG(data.spaces[data.active], true);
  changed();
});
$("#node-list").addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.prop === "type") list();
  if (["x", "y"].includes(t.dataset.prop)) {
    const n = data.spaces[data.active].nodes.find(
      (n) => n.id === t.dataset.node,
    );
    t.value = Math.round(n[t.dataset.prop]);
  }
});
$("#notes").addEventListener("input", (e) => {
  if (e.target.dataset.note) {
    data.spaces[data.active].notes[e.target.dataset.note] = e.target.value;
    changed();
  }
});
$("#compare-tabs").onclick = (e) => {
  if (e.target.dataset.compare) {
    compare = e.target.dataset.compare;
    results();
  }
};
$("#preference").onchange = (e) => {
  data.preference = e.target.value;
  changed();
};
$("#reason").oninput = (e) => {
  data.reason = e.target.value;
  changed();
};
let drag = null;
const canvas = $("#canvas");
function coords(e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    canvas.getScreenCTM().inverse(),
  );
  return {
    x: Math.max(20, Math.min(780, p.x)),
    y: Math.max(20, Math.min(480, p.y)),
  };
}
canvas.onpointerdown = (e) => {
  const g = e.target.closest("[data-id]");
  if (!g) return;
  e.preventDefault();
  selected = g.dataset.id;
  drag = { id: selected, pointer: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
  g.focus();
};
canvas.onpointermove = (e) => {
  if (!drag || drag.pointer !== e.pointerId) return;
  const n = data.spaces[data.active].nodes.find((n) => n.id === drag.id);
  Object.assign(n, coords(e));
  canvas.innerHTML = routeSVG(data.spaces[data.active], true);
};
function finishDrag(e) {
  if (!drag || drag.pointer !== e.pointerId) return;
  const id = drag.id;
  drag = null;
  list();
  changed();
  canvas.querySelector(`[data-id="${CSS.escape(id)}"]`)?.focus();
}
canvas.onpointerup = finishDrag;
canvas.onpointercancel = finishDrag;
canvas.onlostpointercapture = finishDrag;
canvas.onkeydown = (e) => {
  const g = e.target.closest("[data-id]");
  if (
    !g ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  const n = data.spaces[data.active].nodes.find((n) => n.id === g.dataset.id);
  const step = e.shiftKey ? 20 : 5;
  const axis = ["ArrowUp", "ArrowDown"].includes(e.key) ? "y" : "x";
  n[axis] = Math.max(
    20,
    Math.min(
      axis === "x" ? 780 : 480,
      n[axis] + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -step : step),
    ),
  );
  selected = n.id;
  canvas.innerHTML = routeSVG(data.spaces[data.active], true);
  canvas.querySelector(`[data-id="${CSS.escape(n.id)}"]`).focus();
  list();
  changed();
};
function backup() {
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    "city-observation.json",
  );
  message("JSON 备份已生成。");
}
function confirmReplace(title, action) {
  pending = action;
  $("#confirm-title").textContent = title;
  $("#confirm").showModal();
}
$("#accept").onclick = () => {
  pending?.();
  pending = null;
  $("#confirm").close();
};
$("#cancel").onclick = () => {
  $("#confirm").close();
  pending = null;
};
$("#confirm").oncancel = () => {
  pending = null;
};
function replace(d) {
  data = d;
  selected = null;
  storageFailed = false;
  render();
  save();
  message(
    data.demo
      ? "Demo 示例：虚构空间，仅演示工具，不代表真实地点评价。"
      : "当前记录已更新。",
  );
}
$("#demo").onclick = () =>
  confirmReplace("载入 Demo 示例？", () => replace(demo()));
for (const s of ["#reset", "#new"])
  $(s).onclick = () =>
    confirmReplace("清空当前记录并新建？", () => replace(initial()));
for (const s of ["#backup", "#card-json"]) $(s).onclick = backup;
$("#import").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw Error("文件超过 2 MB");
    const d = validate(JSON.parse(await file.text()));
    confirmReplace("导入备份并替换当前记录？", () => replace(d));
  } catch (err) {
    message("导入失败：" + err.message + "。原记录保持不变。");
  }
};
$("#png").onclick = async () => {
  const b = $("#png");
  b.disabled = true;
  try {
    const blob = await cardPNG(structuredClone(data));
    download(blob, "city-observation-card.png");
    message("PNG 观察卡已生成，包含路线、中文笔记与个人偏好。");
  } catch (err) {
    message(err.message);
  } finally {
    b.disabled = false;
  }
};
$("#edit").onclick = () => $("#route").scrollIntoView({ behavior: "smooth" });
render();
if (storageFailed)
  $("#save-status").textContent = "存储读取失败 · 请导出备份或导入恢复";

$("#import-button").onclick = () => $("#import").click();
