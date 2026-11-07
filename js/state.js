export const dimensions = [
  ["route", "Route Continuity / 动线连续性"],
  ["selection", "Store Selection / 选品与店铺分布"],
  ["atmosphere", "Spatial Atmosphere / 空间氛围"],
  ["orientation", "Orientation / 方向感"],
  ["stay", "Willingness to Stay / 停留意愿"],
];
export const types = ["入口", "途经", "停留", "出口"];
export function blankSpace() {
  return {
    name: "",
    city: "",
    type: "商场",
    description: "",
    date: "",
    nodes: [],
    notes: Object.fromEntries(dimensions.map(([k]) => [k, ""])),
  };
}
export function initial() {
  return {
    version: 1,
    demo: false,
    active: 0,
    spaces: [blankSpace(), blankSpace()],
    preference: "none",
    reason: "",
  };
}
export function validate(d) {
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.spaces) ||
    d.spaces.length !== 2 ||
    ![0, 1].includes(d.active) ||
    typeof d.demo !== "boolean" ||
    !["none", "A", "B", "equal"].includes(d.preference)
  )
    throw Error("备份格式或版本不正确");
  const str = (s, n = 10000) => {
    if (typeof s !== "string" || s.length > n)
      throw Error("文字字段无效或过长");
  };
  str(d.reason);
  for (const s of d.spaces) {
    for (const k of ["name", "city", "description", "date", "type"])
      str(s[k], k === "description" ? 10000 : 200);
    if (
      !["商场", "街区", "商业综合体", "其他"].includes(s.type) ||
      !/^$|^\d{4}-\d{2}-\d{2}$/.test(s.date) ||
      (s.date &&
        (Number.isNaN(Date.parse(s.date)) ||
          new Date(s.date).toISOString().slice(0, 10) !== s.date))
    )
      throw Error("空间字段无效");
    if (!Array.isArray(s.nodes) || s.nodes.length > 100)
      throw Error("节点数量无效");
    const ids = new Set();
    for (const n of s.nodes) {
      str(n.id, 100);
      str(n.label, 200);
      str(n.note);
      if (
        !n.id ||
        ids.has(n.id) ||
        !types.includes(n.type) ||
        !Number.isFinite(n.x) ||
        !Number.isFinite(n.y) ||
        n.x < 20 ||
        n.x > 780 ||
        n.y < 20 ||
        n.y > 480
      )
        throw Error("路线节点无效");
      ids.add(n.id);
    }
    for (const [k] of dimensions) str(s.notes?.[k]);
  }
  return structuredClone(d);
}
export function addNode(s, type) {
  if (s.nodes.length >= 100) throw Error("最多 100 个节点");
  const i = s.nodes.length;
  s.nodes.push({
    id: crypto.randomUUID(),
    type,
    label: type,
    note: "",
    x: 100 + (i % 5) * 140,
    y: 100 + (Math.floor(i / 5) % 3) * 140,
  });
}
export function moveNode(s, i, offset) {
  const j = i + offset;
  if (j >= 0 && j < s.nodes.length)
    [s.nodes[i], s.nodes[j]] = [s.nodes[j], s.nodes[i]];
}
export function demo() {
  const d = initial();
  d.demo = true;
  d.spaces.forEach((s, i) => {
    s.name = ["Demo · 转角庭院", "Demo · 环形街廊"][i];
    s.description = "虚构示例，仅演示操作，不代表真实地点评价。";
    s.nodes = ["入口", "途经", "停留", "出口"].map((type, j) => ({
      id: crypto.randomUUID(),
      type,
      label: ["入口", "转角", "咖啡停留", "出口"][j],
      note: j === 2 ? "这里的光线让我想多坐一会儿。" : "",
      x: [100, 350, 350, 680][j],
      y: i === 0 ? [100, 100, 360, 360][j] : [100, 360, 180, 100][j],
    }));
    s.notes.route = i ? "我在中段折返过一次。" : "转角之后能看见下一个目的地。";
    s.notes.stay = "我愿意在有座椅的区域停留。";
  });
  return d;
}
