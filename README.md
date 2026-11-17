# City Observation Desk · 城市观察对照台

走完两条虚构示意路线，想一想自己更愿意在哪一种空间停留。也可以画一条自己实际走过的路线，把停留点与感受留在浏览器里。

[打开 City](https://city.mariustang.com/) · [返回 Ember Lab](https://lab.mariustang.com/)

## 三个入口

| 页面 | 能做什么 |
| --- | --- |
| [试玩](index.html) | 逐站浏览两条示意路线，选择偏好，可跳过理由，完成后进入真实地点记录 |
| [轻量记录](record.html) | 从地点名称开始画 SVG 路线。拖动或用坐标编辑节点，标记停留与感受。完成后生成个人路线卡，有两条记录时可选做图形比较 |
| [进阶工作台](desk.html) | 并排记录 A/B 空间，编辑入口、途经、停留和出口，比较五类笔记，导出 PNG 或 JSON，亦可导入完整工作台 JSON |

路线表达个人体验，坐标为示意。进阶工作台每处最多 100 个节点，JSON 导入上限 2 MB。长文本可能超出设备的 Canvas 导出上限，此时仍可用 JSON 保存工作台数据。

## 本地运行

原生 HTML、CSS、JavaScript modules、SVG 和 Canvas。使用 Python 3 在根目录启动 HTTP 服务，打开 [localhost:4173](http://localhost:4173/)。

```sh
python3 -m http.server 4173
```

运行测试需 Node.js 22+。安装开发依赖后执行 `npm test`。浏览器回归需另开终端运行服务，再执行 `npm run test:play`、`npm run test:record` 或 `npm run test:browser`，可通过 `TEST_URL` 和 `CHROMIUM_PATH` 指定目标和 Chromium。详见 [测试记录](TESTING.md) 和 [试玩验收](UX-ACCEPTANCE.md)。

## 实现与数据

- [js/play.js](js/play.js) 处理示意路线试玩，[js/record.js](js/record.js) 管理轻量记录。
- [js/app.js](js/app.js)、[js/state.js](js/state.js) 和 [js/export.js](js/export.js) 实现进阶工具、状态校验及导出。
- 轻量路线使用 `ember-city-route-records-v1`，进阶工作台使用 `ember-city-observation-v1`。旧记录可从轻量页的进阶区打开。数据随浏览器与站点来源隔离，多个标签页可能覆盖彼此修改。
- 首页试玩会按配置发送打开、开始、完成事件到 PostHog。结果页新增可选反馈事件 `city_feedback`，业务属性仅为 `site: city`、`rating: accurate / partial / off`、`traffic: live / test`，不含路线选择、理由、路线、感受或笔记。同一次结果只发送一次，换理由生成新结果后可再次反馈；只在配置的正式 origin 发送，`analytics_test=1` 标记 `traffic=test`，本地不发送反馈。发送协议沿用固定聚合 `distinct_id`、`$process_person_profile=false` 和 `$geoip_disable=true`，不建立个人画像。路线、感受和笔记留在本地。接入代码见 [js/analytics.js](js/analytics.js)。

轻量记录页可“导出我的路线（JSON）”或“导入路线（JSON）”。备份格式为 `{schema:"ember-city-route-records", version:1, exportedAt, records:[...]}`，包含全部已完成/未完成路线及感受标记。导入文件上限 2 MB，每处最多 100 个节点，坐标限定在画布范围，未知字段丢弃。确认摘要后合并：按记录 id 去重，保留本地版本，提示跳过数量；取消、校验失败或写入失败不改变现有记录。读取故障时停止写入并保留原始值，写入失败时请勿刷新，可先导出本页路线。进阶工作台的 JSON 功能保持原样。

## 部署与当前状态

Vercel 的 `ember-city-observer` 项目对应本仓库 `main`，Production 记录为 READY（`7dea9c7`）。[vercel.json](vercel.json) 直接发布根目录，应用无需构建或服务器端环境变量。平台同时配置 `city.mariustang.com` 与 `ember-city-observer.vercel.app`，两者有各自的浏览器存储。平台状态不代表手机触控、下载或统计入库验收。

## 云端副本

新增主动保存与恢复入口，默认仍在本地使用。恢复码支持换设备取回、更新、删除云端副本；正文进入 Supabase，PostHog 只记录行为。详见 [接入与权限说明](docs/cloud-persistence.md)。
