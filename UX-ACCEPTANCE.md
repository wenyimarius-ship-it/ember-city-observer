# City 本轮草稿验收

分支：`ux/city-first-play`。现有草稿 PR：https://github.com/wenyimarius-ship-it/ember-city-observer/pull/1

## 第一项：结果页（先完成、单独验证）

`tests/play.mjs` 已执行通过：完整走完两条路线，分别选 A 与 B；两卡同页、仅选择卡标记、相同结构、各自示意图与免责声明；好处和代价与请求一致；换理由后回应跟随本次输入；375px 上下排列且无横向滚动。截图人工检查两卡与理由的排版，正常 16px 正文字号；短屏自然滚动。第一项独立提交：`b39b33f`。

## 第二项：小卡（之后完成、单独验证）

`tests/record.mjs` 已执行通过：初始仅两个字段；第一张保留换行与用户原话；单卡没有对照入口；第二张生成后才出现对照；刷新恢复；JSON / PNG 实际下载；375px 无横向滚动；每张卡路线单独保存；两卡进入原对照工具；旧完整记录仍可打开且旧存储字节保持一致。

`npm test`：3 项通过。原 `tests/browser.mjs` 改为从 `desk.html` 验证完整工具，已通过：节点编辑 / 拖动 / 排序 / 删除、键盘操作、A/B 隔离、JSON、PNG、刷新恢复、四宽度、存储故障、长中文和输入安全。模拟触控结果独立于真人测试。

本次没有打包构建步骤；原生静态网页直接运行。生成测试图片位于 `/tmp/city-result-*-375.png`、`/tmp/city-record-form-375.png`、`/tmp/city-single-card-375.png`、`/tmp/city-record-375.png`、`/tmp/city-small-card.png`。

## 匿名预览检查

用全新无登录 Chromium context 实际尝试以下地址：

- City 改动前：https://ember-city-observer-a8a8pifyn-marius-39cd.vercel.app/
- Puzzle（仅检查访问）：https://ember-idea-puzzle-io17r8j6s-marius-39cd.vercel.app/

当前两者均报 `net::ERR_TUNNEL_CONNECTION_FAILED`；HTTP 客户端报代理 `CONNECT tunnel failed, response 403`。这是当前执行环境的出口阻断，尚未到达应用，**无法认定为 Vercel 登录墙，也未确认可以进入交互页**。没有修改部署保护设置。

GitHub Git 操作可用，但 GitHub API 返回 `Forbidden`。已保存环境网络草稿，增加 `api.github.com`、`api.vercel.com`、`vercel.com`、`*.vercel.app`（保留原包管理器预设）。保存草稿不代表已生效；待用户在环境设置保存后重新检查 API 与最新部署。

最新提交对应的 City 预览需要从该提交的 Vercel 检查 / PR 部署记录核实，不复用旧不可变预览地址、不猜测新地址，也不把本地通过写成线上验收通过。

## 真人验收：全部待完成

由用户在新版预览准备后转发链接组织。3 位首次打开项目的人，使用自己的手机，分别独立试玩 City 和 Puzzle；从打开页面开始计时，全程无人提示，目标 90 秒内完成首轮。结束再问「刚才做了什么」「为什么这么选」，不要在操作中解释任务。记录原话，避免用测试者事后理解替代实际卡点。

| 参与者 | 手机 / 浏览器 | City 用时 / 是否 ≤90秒 | City 卡点与两问原话 | Puzzle 用时 / 是否 ≤90秒 | Puzzle 卡点与两问原话 |
| ------ | ------------- | ---------------------- | ------------------- | ------------------------ | --------------------- |
| 1      | 待验收        | 待验收                 | 待验收              | 待验收                   | 待验收                |
| 2      | 待验收        | 待验收                 | 待验收              | 待验收                   | 待验收                |
| 3      | 待验收        | 待验收                 | 待验收              | 待验收                   | 待验收                |

本轮不根据模拟触屏、构建或个人推测决定 Puzzle 是否收住；等三人实际结果。Lab 与 Puzzle 代码保持暂停，本轮不正式发布 City。
