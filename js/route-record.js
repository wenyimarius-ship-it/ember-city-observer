import { blankSpace, initial, validate } from "./state.js";
export const recordKey = "ember-city-route-records-v1";
export const feelings = [
  { id: "like", icon: "♥", label: "喜欢这里", color: "#a34257" },
  { id: "lost", icon: "↝", label: "有点绕", color: "#9b650d" },
  { id: "shop", icon: "✦", label: "发现有趣的店", color: "#366f78" },
  { id: "more", icon: "→", label: "想继续逛", color: "#3c704d" },
];
export function createRecord(name, city = "", type = "商场", date = "") {
  return {
    id: crypto.randomUUID(),
    completed: false,
    space: { ...blankSpace(), name, city, type, date, markers: [] },
  };
}
export function checkRecords(raw) {
  if (!Array.isArray(raw) || raw.length > 500)
    throw Error("路线记录格式不正确");
  const ids = new Set();
  for (const r of raw) {
    if (
      !r ||
      typeof r.id !== "string" ||
      !/^[a-f0-9-]{36}$/.test(r.id) ||
      ids.has(r.id) ||
      typeof r.completed !== "boolean"
    )
      throw Error("路线记录无效");
    ids.add(r.id);
    const d = initial();
    d.spaces[0] = r.space;
    validate(d);
    const marks = r.space.markers;
    if (
      !Array.isArray(marks) ||
      marks.length > 100 ||
      new Set(marks.map((m) => m.id)).size !== marks.length ||
      marks.some(
        (m) =>
          !m ||
          typeof m.id !== "string" ||
          !feelings.some((f) => f.id === m.kind) ||
          !Number.isFinite(m.x) ||
          !Number.isFinite(m.y) ||
          m.x < 20 ||
          m.x > 780 ||
          m.y < 20 ||
          m.y > 480 ||
          typeof m.note !== "string" ||
          m.note.length > 500,
      )
    )
      throw Error("感受标记无效");
  }
  return structuredClone(raw);
}
export function closestPoint(nodes, p) {
  let best = null;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1],
      b = nodes[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = dx * dx + dy * dy;
    const t = len
      ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
      : 0;
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = Math.hypot(p.x - q.x, p.y - q.y);
    if (!best || distance < best.distance) best = { ...q, distance };
  }
  return best;
}
export function review(r) {
  const s = r.space,
    stops = s.nodes.filter((n) => n.type === "停留").length;
  const counts = feelings
    .map((f) => {
      const n = s.markers.filter((m) => m.kind === f.id).length;
      return n ? `${f.label} ${n} 处` : "";
    })
    .filter(Boolean);
  return `你在${s.name}记下了 ${s.nodes.length} 个路线节点${stops ? `、${stops} 个停留点` : ""}${counts.length ? `，标记了${counts.join("、")}` : "，这次没有添加感受标记"}。`;
}
