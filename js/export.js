import { dimensions } from "./state.js";
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function summary(d) {
  const names = d.spaces.map((s, i) => s.name || `Space ${"AB"[i]}`);
  return `${names[0]}：${d.spaces[0].nodes.length} 个路线节点；${names[1]}：${d.spaces[1].nodes.length} 个路线节点。${d.preference === "none" ? "尚未选择偏好。" : d.preference === "equal" ? "你的记录：各有特点 / 无偏好。" : `你更偏好 ${names[d.preference === "A" ? 0 : 1]}。`}${d.reason ? `原因：${d.reason}` : ""}`;
}
// Draw text and routes directly, avoiding cross-origin images, SVG foreignObject and remote fonts.
export async function cardPNG(d) {
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1400;
  c.height = 100;
  const ctx = c.getContext("2d");
  if (!ctx) throw Error("浏览器不支持 Canvas");
  const ops = [];
  let y = 70;
  const margin = 70,
    gap = 50,
    w = 605;
  function text(t, x, top, maxWidth, size = 24, color = "#293e36", line = 36) {
    ctx.font = `${size}px sans-serif`;
    let row = "",
      yy = top;
    const lines = [];
    for (const char of String(t)) {
      if (char === "\n") {
        lines.push(row);
        row = "";
        continue;
      }
      if (ctx.measureText(row + char).width > maxWidth && row) {
        lines.push(row);
        row = char;
      } else row += char;
    }
    lines.push(row);
    for (const lineText of lines) {
      const py = yy;
      ops.push(() => {
        ctx.font = `${size}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(lineText, x, py);
      });
      yy += line;
    }
    return yy;
  }
  y = text(
    "EMBER LAB / CITY OBSERVATION DESK" + (d.demo ? " / DEMO · 虚构示例" : ""),
    margin,
    y,
    1260,
    20,
    "#b64c31",
    32,
  );
  y += 30;
  y = text("How a City Moves You", margin, y, 1260, 60, "#293e36", 78);
  y += 15;
  let end = y;
  d.spaces.forEach((s, i) => {
    const x = margin + i * (w + gap);
    let cy = text(
      `${"AB"[i]} / ${s.name || "未命名空间"}`,
      x,
      y,
      w,
      32,
      "#293e36",
      44,
    );
    cy = text(
      `${s.city || "城市未填写"} · ${s.type} · ${s.date || "观察日期未填写"}`,
      x,
      cy + 8,
      w,
      20,
      "#6d746c",
      30,
    );
    cy = text(
      s.description || "暂无空间描述",
      x,
      cy + 12,
      w,
      22,
      "#293e36",
      34,
    );
    cy += 10;
    const ry = cy;
    ops.push(() => {
      ctx.fillStyle = "#efeee6";
      ctx.fillRect(x, ry, w, 360);
      const px = (n) => x + (n.x / 800) * w,
        py = (n) => ry + (n.y / 500) * 360;
      ctx.strokeStyle = "#b64c31";
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.nodes.forEach((n, j) =>
        j ? ctx.lineTo(px(n), py(n)) : ctx.moveTo(px(n), py(n)),
      );
      ctx.stroke();
      s.nodes.forEach((n, j) => {
        ctx.beginPath();
        ctx.arc(px(n), py(n), 14, 0, Math.PI * 2);
        ctx.fillStyle = n.type === "停留" ? "#b64c31" : "#faf9f4";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = n.type === "停留" ? "white" : "#293e36";
        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(j + 1, px(n), py(n) + 6);
        ctx.textAlign = "left";
      });
    });
    cy += 390;
    for (const n of s.nodes) {
      cy = text(
        `${s.nodes.indexOf(n) + 1}. ${n.type} / ${n.label}${n.note ? " — " + n.note : ""}`,
        x,
        cy,
        w,
        20,
        "#293e36",
        30,
      );
    }
    for (const [k, label] of dimensions) {
      cy += 15;
      cy = text(label, x, cy, w, 20, "#b64c31", 30);
      cy = text(s.notes[k] || "尚未记录", x, cy + 5, w, 23, "#293e36", 35);
    }
    end = Math.max(end, cy);
  });
  y = end + 30;
  y = text(
    "YOUR PERSPECTIVE / 你的观察总结",
    margin,
    y,
    1260,
    20,
    "#b64c31",
    30,
  );
  y = text(summary(d), margin, y + 15, 1260, 26, "#293e36", 40);
  y = text(
    "个人主观记录 · 抽象路线不代表真实比例或测量距离",
    margin,
    y + 25,
    1260,
    20,
    "#6d746c",
    30,
  );
  const height = Math.ceil(y + 40);
  if (height > 30000)
    throw Error(
      "内容过长，无法安全导出一张 PNG。请保留 JSON 备份并缩短笔记后重试。",
    );
  c.height = height;
  ctx.fillStyle = "#faf9f4";
  ctx.fillRect(0, 0, c.width, c.height);
  for (const op of ops) op();
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw Error("图片生成失败，请改用 JSON 备份");
  return blob;
}

// Small cards contain only the visitor's place, exact words, and optional route.
export async function smallCardPNG(card, observation) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw Error("浏览器不支持图片导出");
  const lines = [];
  function wrap(text, size, lineHeight, color) {
    ctx.font = `${size}px sans-serif`;
    let row = "";
    for (const char of text) {
      if (char === "\n" || (row && ctx.measureText(row + char).width > 860)) {
        lines.push({ text: row, size, lineHeight, color });
        row = "";
      }
      if (char !== "\n") row += char;
    }
    lines.push({ text: row, size, lineHeight, color });
  }
  wrap("我的地点小卡", 22, 40, "#b64c31");
  wrap(card.name, 38, 58, "#293e36");
  wrap("", 26, 32, "#293e36");
  wrap(card.feeling, 28, 44, "#293e36");
  const nodes = observation.spaces[0].nodes;
  const textHeight = lines.reduce((h, line) => h + line.lineHeight, 0);
  const height = 140 + textHeight + (nodes.length ? 500 : 0);
  if (height > 30000) throw Error("内容过长，请先导出备份。");
  canvas.height = height;
  ctx.fillStyle = "#faf9f4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = 80;
  for (const line of lines) {
    ctx.font = `${line.size}px sans-serif`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 70, y);
    y += line.lineHeight;
  }
  if (nodes.length) {
    y += 30;
    ctx.strokeStyle = "#b64c31";
    ctx.lineWidth = 4;
    ctx.beginPath();
    nodes.forEach((n, i) => {
      const x = 70 + (n.x / 800) * 860,
        ny = y + (n.y / 500) * 400;
      i ? ctx.lineTo(x, ny) : ctx.moveTo(x, ny);
    });
    ctx.stroke();
    nodes.forEach((n) => {
      ctx.beginPath();
      ctx.arc(70 + (n.x / 800) * 860, y + (n.y / 500) * 400, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#b64c31";
      ctx.fill();
    });
    ctx.fillStyle = "#6d746c";
    ctx.font = "20px sans-serif";
    ctx.fillText("示意路线，非真实比例", 70, y + 445);
  }
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw Error("图片生成失败，请导出备份。");
  return blob;
}
