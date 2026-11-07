import { initial, validate } from "./state.js";
import { download, smallCardPNG } from "./export.js";
const $ = (s) => document.querySelector(s),
  collectionKey = "ember-city-small-cards-v1",
  legacyKey = "ember-city-observation-v1";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let cards = [],
  readable = true;
function tell(t) {
  $("#record-message").textContent = t;
}
try {
  if (localStorage.getItem(legacyKey)) $("#legacy").hidden = false;
  const raw = localStorage.getItem(collectionKey);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length > 1000 ||
      parsed.some(
        (c) =>
          !c ||
          typeof c.id !== "string" ||
          !/^[a-f0-9-]{36}$/.test(c.id) ||
          typeof c.name !== "string" ||
          typeof c.feeling !== "string" ||
          c.name.length > 200 ||
          c.feeling.length > 10000,
      ) ||
      new Set(parsed.map((c) => c.id)).size !== parsed.length
    )
      throw Error();
    cards = parsed;
  }
} catch {
  readable = false;
  tell(
    "浏览器记录暂时无法读取，原数据已保留。本次小卡仍可生成和导出，但暂不写入存储。",
  );
}
function sessionKey(id) {
  return "ember-city-card-session:" + id;
}
function stateFor(card) {
  try {
    const raw = localStorage.getItem(sessionKey(card.id));
    if (raw) return validate(JSON.parse(raw));
  } catch {}
  const d = initial();
  d.spaces[0].name = card.name;
  d.spaces[0].notes.route = card.feeling;
  return d;
}
function persist() {
  if (!readable) return false;
  try {
    localStorage.setItem(collectionKey, JSON.stringify(cards));
    return true;
  } catch {
    tell("自动保存失败，请先导出备份；原来的完整观察记录未修改。");
    return false;
  }
}
function render() {
  $("#small-cards").innerHTML = cards
    .map(
      (c) =>
        `<article class="small-card" data-card="${c.id}"><h2>${esc(c.name)}</h2><p>${esc(c.feeling)}</p><div class="tools"><button data-draw="${c.id}">画一下路线</button><button data-export="${c.id}">导出</button></div><div id="exports-${c.id}" hidden><button data-json="${c.id}">导出备份</button><button data-png="${c.id}">导出图片</button></div></article>`,
    )
    .join("");
  $("#after-card").hidden = !cards.length;
  $("#compare-link").innerHTML =
    cards.length >= 2
      ? `<p>最近记下的两个地方：${cards
          .slice(-2)
          .map((c) => esc(c.name))
          .join("、")}</p><button id="compare-two">对照这两个地方</button>`
      : "";
}
$("#quick-form").onsubmit = (e) => {
  e.preventDefault();
  const name = $("#place").value.trim(),
    feeling = $("#feeling").value;
  if (!name || !feeling.trim()) {
    tell("请写下地点和走起来的感觉。");
    return;
  }
  if (cards.length >= 1000) {
    tell("记录已满，请先导出已有小卡。");
    return;
  }
  const c = { id: crypto.randomUUID(), name, feeling };
  cards.push(c);
  persist();
  render();
  $("#quick-form").reset();
  $("#quick-form").hidden = true;
  const article = document.querySelector(`[data-card="${c.id}"]`);
  article.tabIndex = -1;
  article.focus();
};
$("#another").onclick = () => {
  $("#quick-form").hidden = false;
  $("#place").focus();
};
function openSession(id, d, hash = "route") {
  try {
    localStorage.setItem(sessionKey(id), JSON.stringify(d));
    location.href = `desk.html?session=${encodeURIComponent(id)}#${hash}`;
  } catch {
    tell("无法保存路线编辑会话，请先导出小卡备份。");
  }
}
$("#small-cards").onclick = async (e) => {
  const t = e.target,
    c = cards.find(
      (c) =>
        c.id ===
        (t.dataset.draw || t.dataset.export || t.dataset.json || t.dataset.png),
    );
  if (!c) return;
  if (t.dataset.draw) openSession(c.id, stateFor(c));
  if (t.dataset.export) {
    const menu = $(`#exports-${c.id}`);
    menu.hidden = !menu.hidden;
  }
  if (t.dataset.json)
    download(
      new Blob(
        [
          JSON.stringify(
            { version: 1, card: c, observation: stateFor(c) },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "我的地点小卡.json",
    );
  if (t.dataset.png) {
    t.disabled = true;
    try {
      download(await smallCardPNG(c, stateFor(c)), "我的地点小卡.png");
    } catch (err) {
      tell("图片导出失败：" + err.message);
    } finally {
      t.disabled = false;
    }
  }
};
$("#compare-link").onclick = (e) => {
  if (e.target.id !== "compare-two") return;
  const d = initial();
  d.spaces = cards.slice(-2).map((c) => stateFor(c).spaces[0]);
  openSession(crypto.randomUUID(), d, "compare");
};
render();
if (cards.length) $("#quick-form").hidden = true;
