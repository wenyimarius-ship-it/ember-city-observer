# City 试玩草稿 · ux/city-first-play

本轮仅更新 City 草稿 PR #1，不正式发布，不改 Lab 或 Puzzle。

- `/`：依次走 A/B 路线，再选择路线与理由；结果同页显示两张同结构对照卡，给出各自好处与代价，仅标记用户选中的卡。回应只复述当前选择与理由。
- `/record.html`：只问「你去了哪里？」「走起来是什么感觉？」；立即生成保留原话的小卡。生成后才提供再记、画路线、导出；两张起才提供最近两处地点对照。
- `/desk.html`：保留原完整记录、SVG 路线与对照工具；原 `ember-city-observation-v1` 数据继续原位读取。新小卡集合使用 `ember-city-small-cards-v1`，每卡路线与对照使用独立 `ember-city-card-session:<UUID>`，不覆盖旧记录。
- 小卡导出支持原生 Canvas PNG 与包含原话和路线状态的 JSON；原完整工具的导出 / 导入继续保留。

## 本轮验证

先运行 `npm start`；如 4173 被残留服务占用，可另用 `python3 -m http.server 4183`，再相应设置 `TEST_URL`。

```sh
npm test
TEST_URL=http://localhost:4183/ npm run test:play
TEST_URL=http://localhost:4183/ npm run test:record
TEST_URL=http://localhost:4183/desk.html npm run test:browser
```

试玩与小卡浏览器测试覆盖 375px；完整工具回归覆盖 320 / 390 / 700 / 1440px。自动化和模拟触控不视为真人验收；详见 [UX-ACCEPTANCE.md](UX-ACCEPTANCE.md)。下方保留原 MVP 的设计与部署说明，入口现已拆分为试玩、轻记录和进阶工具。

---

# City Observation Desk · Phase 3.3

**How a City Moves You** — Ember Personal Web / Ember Lab 的独立城市空间观察工具。

使用 HTML、CSS、原生 JavaScript modules、SVG 与 Canvas。运行时无第三方依赖、账号、API、数据库或网络字体。观察是个人主观记录；路线不代表真实平面比例，不自动评分或判断哪类动线更好。

## 本地运行

需要 Python 3；Node.js 22+ 用于测试（本环境验证 Node 24.22.1）。

```sh
cd /workspace/ember-city-observer
npm start
```

通过本地 HTTP 的 4173 端口访问；不要用 file:// 打开 ES modules。应用本身无需 npm install。服务进程需在新环境重新启动。

## 目录

```text
index.html           页面、SEO / OG、表单与工作流程
style.css            Urban Field Notes 响应式视觉
js/state.js          状态模型、Demo、节点操作与导入校验
js/app.js            UI、SVG pointer / 键盘交互、持久化
js/export.js         原生 Canvas PNG、JSON 下载与输入摘要
favicon.svg          站点图标
og.svg / og.png       分享图源文件与兼容的 PNG
vercel.json          独立静态部署和响应头配置
 tests/state.test.js  状态层测试
 tests/browser.mjs    Chromium 浏览器集成测试
TESTING.md           实测范围、结果与限制
```

## 已实现流程与交互

1. 创建 A/B：名称、城市、类型、描述、日期。Demo 是明确标记的虚构示例，载入前确认替换。
2. SVG 路线：入口、途经、停留、出口；按数组顺序自动连线。可拖动、编辑名称和类型、写节点记录、删除、上下排序。每个空间最多 100 个节点。
3. 不拖拽也可编辑：直接输入 X/Y；Tab 聚焦 SVG 节点，方向键移动 5 单位，Shift + 方向键移动 20 单位。拖动仅绑定 SVG 节点，表单文字输入不会触发拖动。小屏节点有透明扩展触控区域，紧密节点可用坐标表单编辑。
4. 五项笔记：动线、选品、氛围、方向感、停留意愿。对照页按维度切换，整体体验展示全部记录；偏好支持 A/B、无偏好和未选择，原因自由填写。
5. 观察卡：两处地点、日期、缩略路线、五项笔记、基于用户输入的简短摘要与偏好原因。PNG 额外包含所有节点名称及记录。原生 Canvas 自动测量文字并换行、计算整体高度，不调用截图服务，不加载跨域字体。
6. 自动保存：localStorage 键 `ember-city-observation-v1`；刷新恢复两处空间、节点坐标顺序、笔记、偏好与活动空间。JSON 导出完整状态，导入校验版本、字段类型、尺寸、节点数量、ID 唯一性、坐标和枚举；最大文件 2 MB。
7. 导入、新建、Demo 都先确认，取消保留原数据。遇到损坏存储时保留原始值，暂停覆盖，提示导入恢复或清空；写入失败仍可编辑和导出 JSON。

## 测试

```sh
npm ci --cache /tmp/city-npm-cache
npm test
# 另一终端运行 npm start
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

浏览器测试唯一开发依赖为锁定版本的 Playwright。需本机已安装 Chromium；测试默认使用 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 覆盖。`TEST_URL` 可指定待测部署地址，默认本地 4173。生成的截图、JSON 与 PNG 放在 `/tmp/city-*`，不含个人生产数据。

完整实测结果见 [TESTING.md](TESTING.md)。

## Vercel 默认地址部署

本轮没有修改其他仓库、Ember 主站、Lab、DNS 或现有 Vercel 项目。环境没有 Vercel 身份凭据，**尚未执行线上部署或默认域名验证**。

1. 将此分支推送至 GitHub，在 Vercel 使用 **Add New → Project** 新建独立项目，导入 `wenyimarius-ship-it/ember-city-observer`。不要选择任何现有项目。
2. 选择 Framework Preset **Other**，Root Directory 为仓库根目录；不需要构建命令，Output Directory 为 `.`。仓库 `vercel.json` 已声明这些设置。没有环境变量要求；Install Command 可设置为 `npm ci`，依赖仅用于测试。
3. 选择此功能分支部署，记录平台分配的 `*.vercel.app` 默认地址，先在该地址完成操作验证。不要配置 `city.mariustang.com` 或其他自定义域名。
4. 通过 `TEST_URL=https://平台分配地址 CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` 运行同一集成测试；若部署保护启用，先在 Vercel 设置合适的测试访问方式。再在真实手机 Safari / Chrome 检查触控、下载与长中文输入。
5. 确认默认地址后，未来由独立任务在 Ember Lab 增加链接卡片即可。当前应用已有低干扰的 Back to Ember Lab 入口。无需改造为地图服务或改动主站。

localStorage 按域名隔离，预览地址、生产默认地址和未来自定义域名之间不会自动同步。迁移用 JSON 导出 / 导入。

## 待改进与已知边界

- 默认 Vercel 地址上线验证、真实 iOS / Android 验证尚未执行；模拟触控不代表真机。
- 笔记非常长时 PNG 会变高；高度超过 30000px 时拒绝生成并提示使用 JSON 或缩短内容，避免静默截断。不同设备 Canvas 内存上限可能更低，失败会显示提示。
- 目前保存一组 A/B 观察。多组历史、撤销 / 重做、路线吸附可作为后续功能，当前可用 JSON 备份保留多次观察。
- 中文采用系统字体，设备间字形可能不同；OG 图片为静态 PNG，观察卡在当前设备绘制。
- 无跨标签页协同；同时编辑同一域名的多个标签页可能互相覆盖，应使用单个标签页。
