import { initial, validate } from "./state.js";
import { download } from "./export.js";
import { exportRecords, parseRecordBackup, mergeRecords, maxBackupBytes } from "./route-backup.js";
import {
  recordKey,
  feelings,
  createRecord,
  checkRecords,
  closestPoint,
  review,
} from "./route-record.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let records = [],
  current = null,
  selected = null,
  mode = "draw",
  kind = "like",
  readable = true;
let storedSnapshot = null;
const sessionKey = (id) => "ember-city-card-session:" + id;
function tell(text) {
  $("#record-message").textContent = text;
}
try {
  const raw = localStorage.getItem(recordKey);
  storedSnapshot = raw;
  if (raw) records = checkRecords(JSON.parse(raw));
} catch {
  readable = false;
  tell("路线存储无法读取，原数据已保留；本次修改仅留在页面中，请勿刷新。");
}
function persist() {
  if (!readable) return;
  try {
    const raw = JSON.stringify(records);
    localStorage.setItem(recordKey, raw);
    storedSnapshot = raw;
    tell("已自动保存");
  } catch {
    tell("未能自动保存，请勿刷新；可以先截取路线卡，旧记录未修改。");
  }
}

let pendingImport = null, fileRead = 0;
const importDialog = $("#route-import-dialog");
$("#export-routes").onclick = () => {
  try {
    if (!readable && !records.length) throw Error("原始存储无法读取，无法生成路线备份；原始值未修改。");
    const backup = exportRecords(records);
    download(new Blob([JSON.stringify(backup, null, 2)], {type:"application/json"}), "city-routes.json");
    tell("已导出全部路线记录（含未完成路线和感受标记）。");
  } catch (error) { tell(`导出失败：${error.message}`); }
};
$("#import-routes").onclick = () => $("#route-file").click();
$("#route-file").onchange = async (event) => {
  const request = ++fileRead, file = event.target.files[0];
  pendingImport = null;
  if (!file) return;
  try {
    if (!readable) throw Error("路线存储无法读取，已停止写入并保留原始值；请先备份，勿刷新。");
    if (file.size > maxBackupBytes) throw Error("文件不能超过 2 MB。");
    const incoming = parseRecordBackup(await file.text());
    if (request !== fileRead) return;
    const plan = mergeRecords(records, incoming);
    pendingImport = incoming;
    $("#route-import-summary").textContent = `将导入 ${plan.added} 条路线，跳过 ${plan.skipped} 条。已存在的 id 保留本地版本。`;
    importDialog.showModal();
  } catch (error) {
    if (request === fileRead) tell(`导入失败：${error.message} 现有记录未修改。`);
  } finally {
    if (request === fileRead) event.target.value = "";
  }
};
$("#cancel-route-import").onclick = () => importDialog.close();
importDialog.onclose = () => { pendingImport = null; };
$("#confirm-route-import").onclick = () => {
  if (!pendingImport) return;
  let plan;
  try {
    if (!readable) throw Error("存储无法读取，已停止写入并保留原始值。");
    let stored;
    try { stored = localStorage.getItem(recordKey); }
    catch { readable = false; throw Error("存储无法读取，已停止写入并保留原始值。"); }
    if (stored !== storedSnapshot) {
      readable = false;
      throw Error("其他页面已修改存储，本页已停止写入；请先导出本页路线，勿刷新。");
    }
    plan = mergeRecords(records, pendingImport);
    if (plan.added) {
      const raw = JSON.stringify(plan.records);
      // A single atomic write precedes any change to in-memory records or UI.
      try { localStorage.setItem(recordKey, raw); }
      catch { throw Error("存储写入失败，请勿刷新；可先导出本页路线备份。"); }
      records = plan.records;
      storedSnapshot = raw;
    }
  } catch (error) {
    importDialog.close();
    tell(`导入失败：${error.message} 现有记录未修改。`);
    return;
  }
  importDialog.close();
  listing();
  tell(`已导入 ${plan.added} 条路线；${plan.skipped} 条已存在，已跳过。`);
};
function syncMarkers() {
  const s = current.space;
  for (const m of s.markers) {
    const p = closestPoint(s.nodes, m);
    if (p) {
      m.x = p.x;
      m.y = p.y;
    }
  }
}
function svg(space, interactive = false) {
  return `<polyline class="record-path" points="${space.nodes.map((n) => `${n.x},${n.y}`).join(" ")}"/>${space.nodes.map((n, i) => `<g class="node ${selected === n.id ? "selected" : ""}" data-node="${esc(n.id)}" ${interactive ? 'tabindex="0" role="button"' : ""} aria-label="节点 ${i + 1}，${n.type}。方向键移动，Delete 删除"><title>${i + 1} / ${n.type}</title><circle class="hit" cx="${n.x}" cy="${n.y}" r="45"/><circle cx="${n.x}" cy="${n.y}" r="22"/><text x="${n.x}" y="${n.y + 7}">${i + 1}</text>${n.type === "停留" ? `<circle cx="${n.x + 19}" cy="${n.y - 19}" r="7"/>` : ""}</g>`).join("")}${space.markers
    .map((m) => {
      const f = feelings.find((f) => f.id === m.kind);
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.classList.add("marker");
      g.dataset.marker = m.id;
      if (interactive) { g.setAttribute("tabindex", "0"); g.setAttribute("role", "button"); }
      const label = f.label + (m.note ? "：" + m.note : "");
      g.setAttribute("aria-label", label);
      g.innerHTML = `<title></title><circle cx="${m.x}" cy="${m.y}" r="30" fill="${f.color}"/><text x="${m.x}" y="${m.y + 8}"></text>`;
      g.querySelector("title").textContent = label;
      g.querySelector("text").textContent = f.icon;
      return g.outerHTML;
    })
    .join("")}`;
}
function map(space) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.setAttribute("viewBox", "0 0 800 500");
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", space.name + "的个人记录路线");
  el.innerHTML = svg(space);
  return el.outerHTML;
}
function legend(space) {
  return `<div class="legend">${feelings
    .filter((f) => space.markers.some((m) => m.kind === f.id))
    .map(
      (f) =>
        `<span>${f.icon} ${f.label} ×${space.markers.filter((m) => m.kind === f.id).length}</span>`,
    )
    .join("")}</div>`;
}
function card(r) {
  const article = document.createElement("article");
  article.className = "route-card";
  article.innerHTML = `<h2></h2><p class="hint">我的真实到访记录 · 路线为个人示意，非测量平面图</p>${map(r.space)}${legend(r.space)}`;
  article.querySelector("h2").textContent = r.space.name;
  for (const text of [review(r), ...r.space.markers.filter(m=>m.note).map(m=>`${feelings.find(f=>f.id===m.kind).label}：${m.note}`)]) {
    const p = document.createElement("p"); p.textContent = text; article.append(p);
  }
  return article.outerHTML;
}
function listing() {
  const list = $("#saved-records");
  list.replaceChildren();
  if (!records.length) return;
  const title = document.createElement("h2");
  title.textContent = "我的路线记录";
  list.append(title);
  for (const r of records) {
    const row = document.createElement("div"), heading = document.createElement("h3"), button = document.createElement("button");
    row.className = "saved-row";
    heading.textContent = r.space.name;
    button.dataset.open = r.id;
    button.textContent = r.completed ? "查看路线卡" : "继续画路线";
    row.append(heading, button);
    list.append(row);
  }
  for (const [id, text, visible] of [
    ["graphic-compare", "看看最近两条路线（可选）", records.filter(r=>r.completed).length >= 2],
    ["new-place", "再记一个地方", $("#result").hidden],
  ]) {
    if (!visible) continue;
    const button = document.createElement("button");
    button.id = id; button.textContent = text; list.append(button);
  }
}
function draw() {
  const s = current.space;
  $("#record-canvas").innerHTML = svg(s, true);
  $("#node-tools").innerHTML =
    `<button id="add-node">＋ 路线节点</button><button id="toggle-stop" ${!selected ? "disabled" : ""}>${s.nodes.find((n) => n.id === selected)?.type === "停留" ? "取消停留" : "标为停留"}</button><button id="delete-node" ${!selected ? "disabled" : ""}>删除选中节点</button>`;
  $("#accessible-nodes").innerHTML = s.nodes
    .map(
      (n, i) =>
        `<div class="coordinate-row"><label>${i + 1} · 横坐标<input type="number" data-coordinate="x" data-id="${esc(n.id)}" min="20" max="780" value="${Math.round(n.x)}"></label><label>纵坐标<input type="number" data-coordinate="y" data-id="${esc(n.id)}" min="20" max="480" value="${Math.round(n.y)}"></label><button data-select="${esc(n.id)}">选中</button></div>`,
    )
    .join("");
  $("#marker-list").innerHTML = s.markers
    .map((m) => {
      const f = feelings.find((f) => f.id === m.kind);
      return `<div class="marker-item" id="marker-${esc(m.id)}"><label>感受<select data-marker-kind="${esc(m.id)}">${feelings.map((option) => `<option value="${option.id}" ${option.id === m.kind ? "selected" : ""}>${option.icon} ${option.label}</option>`).join("")}</select></label> <button data-remove-marker="${esc(m.id)}">删除标记</button><details><summary>补一句（可选）</summary><label>文字补充<textarea maxlength="500" data-marker-note="${esc(m.id)}"></textarea></label></details></div>`;
    })
    .join("");
  $("#marker-list").querySelectorAll("textarea").forEach(el => {
    el.value = s.markers.find(m=>m.id===el.dataset.markerNote).note;
  });
  $("#finish").disabled = s.nodes.length < 2;
}
function setMode(next) {
  mode = next;
  $("#draw-mode").setAttribute("aria-pressed", mode === "draw");
  $("#mark-mode").setAttribute("aria-pressed", mode === "mark");
  $("#feelings").hidden = mode !== "mark";
  $("#feelings").innerHTML = feelings
    .map(
      (f) =>
        `<button data-feeling="${f.id}" aria-pressed="${kind === f.id}">${f.icon} ${f.label}</button>`,
    )
    .join("");
  $("#canvas-hint").textContent =
    mode === "draw"
      ? "点空白处添加节点，拖动编号调整位置。"
      : "先选一种感受，再点路线上的位置；也可以直接完成。";
}
function open(r) {
  current = r;
  selected = null;
  $("#place-form").hidden = true;
  $("#result").hidden = true;
  $("#editor").hidden = false;
  $("#editing-name").textContent = r.space.name;
  setMode("draw");
  draw();
  $("#editing-name").tabIndex = -1;
  $("#editing-name").focus();
}
function result(r) {
  current = r;
  $("#place-form").hidden = true;
  $("#editor").hidden = true;
  $("#result").hidden = false;
  $("#result").innerHTML =
    `<h2 tabindex="-1">这条路线已记下</h2>${card(r)}<div class="tools"><button id="edit-route">继续编辑</button><button id="new-place">再记一个地方</button><a href="./" class="button">返回 City 首页</a></div>`;
  listing();
  $("#advanced-record").hidden = false;
  $("#result h2").focus();
}
$("#place-form").onsubmit = (e) => {
  e.preventDefault();
  const name = $("#place").value.trim();
  if (!name) {
    tell("请先写下地点名称。");
    return;
  }
  if (records.length >= 500) {
    tell("记录已满，请先使用进阶工具备份。");
    return;
  }
  const r = createRecord(
    name,
    $("#city").value.trim(),
    $("#type").value,
    $("#date").value,
  );
  records.push(r);
  persist();
  listing();
  open(r);
};
function addPoint(p) {
  if (current.space.nodes.length >= 100) {
    tell("最多记录 100 个路线节点。");
    return;
  }
  const n = {
    id: crypto.randomUUID(),
    label: "路线节点",
    type: current.space.nodes.length ? "途经" : "入口",
    note: "",
    x: p.x,
    y: p.y,
  };
  current.space.nodes.push(n);
  selected = n.id;
  syncMarkers();
  persist();
  draw();
}
function removeNode() {
  if (current.space.nodes.length <= 2 && current.space.markers.length) {
    tell("保留至少两个路线节点，或先删除感受标记。");
    return;
  }
  current.space.nodes = current.space.nodes.filter((n) => n.id !== selected);
  selected = null;
  syncMarkers();
  persist();
  draw();
}
$("#draw-mode").onclick = () => setMode("draw");
$("#mark-mode").onclick = () => setMode("mark");
$("#feelings").onclick = (e) => {
  if (e.target.dataset.feeling) {
    kind = e.target.dataset.feeling;
    setMode("mark");
  }
};
$("#node-tools").onclick = (e) => {
  if (e.target.id === "add-node") {
    const i = current.space.nodes.length;
    addPoint({
      x: 100 + (i % 5) * 140,
      y: 100 + (Math.floor(i / 5) % 3) * 140,
    });
  }
  if (e.target.id === "delete-node") removeNode();
  if (e.target.id === "toggle-stop") {
    const n = current.space.nodes.find((n) => n.id === selected);
    if (n) {
      n.type = n.type === "停留" ? "途经" : "停留";
      persist();
      draw();
    }
  }
};
$("#accessible-nodes").onclick = (e) => {
  if (e.target.dataset.select) {
    selected = e.target.dataset.select;
    draw();
  }
};
$("#accessible-nodes").onchange = (e) => {
  const t = e.target;
  if (!t.dataset.coordinate) return;
  const n = current.space.nodes.find((n) => n.id === t.dataset.id);
  const axis = t.dataset.coordinate;
  if (n && t.value !== "" && Number.isFinite(+t.value)) {
    n[axis] = Math.max(20, Math.min(axis === "x" ? 780 : 480, +t.value));
    syncMarkers();
    persist();
    draw();
  }
};
$("#marker-list").onclick = (e) => {
  if (e.target.dataset.removeMarker) {
    current.space.markers = current.space.markers.filter(
      (m) => m.id !== e.target.dataset.removeMarker,
    );
    persist();
    draw();
  }
};
$("#marker-list").onchange = (e) => {
  const id = e.target.dataset.markerKind;
  if (!id || !feelings.some((f) => f.id === e.target.value)) return;
  current.space.markers.find((m) => m.id === id).kind = e.target.value;
  persist();
  draw();
};
$("#marker-list").oninput = (e) => {
  if (e.target.dataset.markerNote) {
    current.space.markers.find(
      (m) => m.id === e.target.dataset.markerNote,
    ).note = e.target.value;
    persist();
  }
};
const canvas = $("#record-canvas");
function position(e) {
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
    canvas.getScreenCTM().inverse(),
  );
  return {
    x: Math.max(20, Math.min(780, p.x)),
    y: Math.max(20, Math.min(480, p.y)),
  };
}
function addMarker(p) {
  if (current.space.markers.length >= 100) {
    tell("最多添加 100 个感受标记。");
    return;
  }
  const q = closestPoint(current.space.nodes, p);
  if (!q || q.distance > 55) {
    tell("请点在已画好的路线附近。");
    return;
  }
  current.space.markers.push({
    id: crypto.randomUUID(),
    kind,
    x: q.x,
    y: q.y,
    note: "",
  });
  persist();
  draw();
}
let drag = null,
  tap = null,
  suppressClick = false;
canvas.onpointerdown = (e) => {
  suppressClick = false;
  tap = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    moved: false,
    touch: e.pointerType === "touch",
  };
  const g = e.target.closest("[data-node]");
  if (g && mode === "draw") {
    e.preventDefault();
    selected = g.dataset.node;
    drag = { id: selected, pointer: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  }
};
canvas.onpointermove = (e) => {
  if (
    tap &&
    tap.id === e.pointerId &&
    Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 10
  )
    tap.moved = true;
  if (!drag || e.pointerId !== drag.pointer) return;
  const n = current.space.nodes.find((n) => n.id === drag.id);
  Object.assign(n, position(e));
  canvas.innerHTML = svg(current.space, true);
};
function finishDrag(e) {
  if (!drag || e.pointerId !== drag.pointer) return;
  drag = null;
  suppressClick = true;
  syncMarkers();
  persist();
  draw();
}
canvas.onpointerup = (e) => {
  if (drag) {
    tap = null;
    finishDrag(e);
    return;
  }
  if (tap && tap.id === e.pointerId) {
    const moved = tap.moved,
      touch = tap.touch;
    tap = null;
    if (!moved && touch) handleTap(e);
    suppressClick = moved || touch;
  }
};
canvas.onpointercancel = (e) => {
  tap = null;
  finishDrag(e);
};
canvas.onlostpointercapture = finishDrag;
canvas.onclick = (e) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  handleTap(e);
};
function handleTap(e) {
  const marker = e.target.closest("[data-marker]");
  if (marker) {
    $(`#marker-${CSS.escape(marker.dataset.marker)}`)?.scrollIntoView({
      block: "nearest",
    });
    return;
  }
  if (mode === "mark") {
    addMarker(position(e));
    return;
  }
  if (e.target.closest("[data-node]")) return;
  addPoint(position(e));
}
canvas.onkeydown = (e) => {
  const g = e.target.closest("[data-node]");
  if (!g) return;
  selected = g.dataset.node;
  const n = current.space.nodes.find((n) => n.id === selected);
  if (e.key === "Delete") {
    e.preventDefault();
    removeNode();
    return;
  }
  if (mode === "mark" && ["Enter", " "].includes(e.key)) {
    e.preventDefault();
    addMarker(n);
    return;
  }
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    return;
  e.preventDefault();
  const axis = ["ArrowUp", "ArrowDown"].includes(e.key) ? "y" : "x";
  n[axis] = Math.max(
    20,
    Math.min(
      axis === "x" ? 780 : 480,
      n[axis] + (["ArrowUp", "ArrowLeft"].includes(e.key) ? -5 : 5),
    ),
  );
  syncMarkers();
  persist();
  draw();
  canvas.querySelector(`[data-node="${CSS.escape(selected)}"]`)?.focus();
};
$("#finish").onclick = () => {
  if (current.space.nodes.length < 2) return;
  current.completed = true;
  persist();
  result(current);
};
$("#result").onclick = (e) => {
  if (e.target.id === "edit-route") open(current);
  if (e.target.id === "new-place") newPlace();
};
$("#advanced-record").onclick = () => {
  try {
    const key = sessionKey(current.id),
      raw = localStorage.getItem(key);
    const d = raw ? validate(JSON.parse(raw)) : initial();
    const notes = d.spaces[0].notes;
    d.spaces[0] = { ...d.spaces[0], ...current.space, notes };
    localStorage.setItem(key, JSON.stringify(d));
    location.href = `desk.html?session=${current.id}#route`;
  } catch {
    tell("无法打开进阶会话，原始会话未修改，当前路线仍保留。");
  }
};
function newPlace() {
  $("#editor").hidden = true;
  $("#result").hidden = true;
  $("#place-form").hidden = false;
  $("#place-form").reset();
  $("#advanced-record").hidden = true;
  listing();
  $("#place").focus();
}

$("#saved-records").onclick = (e) => {
  const id = e.target.dataset.open;
  if (id) {
    const r = records.find((r) => r.id === id);
    r.completed ? result(r) : open(r);
  }
  if (e.target.id === "new-place") newPlace();
  if (e.target.id === "graphic-compare") {
    const pair = records.filter((r) => r.completed).slice(-2);
    $("#editor").hidden = true;
    $("#place-form").hidden = true;
    $("#result").hidden = false;
    $("#result").innerHTML =
      `<h2>两条路线（可选）</h2><div class="graphic-pair">${pair.map(card).join("")}</div>`;
    $("#result").scrollIntoView({ block: "start" });
  }
};
try {
  const old = JSON.parse(
    localStorage.getItem("ember-city-small-cards-v1") || "[]",
  );
  if (Array.isArray(old))
    $("#old-cards").innerHTML = old
      .filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          /^[a-f0-9-]{36}$/.test(c.id) &&
          typeof c.name === "string",
      )
      .map(
        (c) =>
          `<div class="saved-row"><h3>${esc(c.name)}</h3><p>${esc(c.feeling || "")}</p><a href="desk.html?session=${c.id}#route" data-old-id="${c.id}" data-old-name="${esc(c.name)}" data-old-feeling="${esc(c.feeling || "")}">打开原小卡路线 →</a></div>`,
      )
      .join("");
} catch {
  tell("旧小卡暂时无法读取，原始数据未修改，可在进阶工具检查备份。");
}
listing();
const draft = records.find((r) => !r.completed);
if (draft) open(draft);

$("#old-cards").onclick = (e) => {
  const a = e.target.closest("[data-old-id]");
  if (!a) return;
  try {
    const key = sessionKey(a.dataset.oldId);
    if (!localStorage.getItem(key)) {
      const d = initial();
      d.spaces[0].name = a.dataset.oldName;
      d.spaces[0].notes.route = a.dataset.oldFeeling;
      localStorage.setItem(key, JSON.stringify(d));
    }
  } catch {
    e.preventDefault();
    tell("无法打开原小卡，旧内容仍保留，请稍后重试。");
  }
};
