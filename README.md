# 算法训练 · 28 天课程

一个刷题课程 Web App。展示**完整题面 + 解题提示**，不做 judge——代码写在 LeetCode 上提交，这里负责组织「今天练什么、题目是什么、卡住了看什么」。

**在线地址：https://nightlemon.github.io/acm/**

## 手机上使用

用手机浏览器打开上面的地址，然后：

- **iOS Safari** — 分享按钮 → 「添加到主屏幕」
- **Android Chrome** — 右上角菜单 → 「安装应用」/「添加到主屏幕」

装好之后是全屏的，没有浏览器地址栏。首次打开后建议点侧栏底部的**「离线缓存题面」**，把 194 道题的题面一次性存到本机，之后没网也能看（题面里的插图仍需要网络）。

## 本地启动

```bash
npm install
npm run dev
```

浏览器会自动打开 http://localhost:5180 。同一局域网内手机也能访问终端里打印的 Network 地址。

## 结构

- **Week 1 基础与手感** — 双指针、二分、单调栈、堆、滑动窗口
- **Week 2 DP 与图论** — 线性 / 区间 / 状压 / 数位 / 树形 DP，最短路、生成树、并查集、Trie
- **Week 3 高级数据结构** — 树状数组、线段树、KMP / Z / 哈希、Manacher、数论与组合计数
- **Week 4 综合训练** — 按套计时练习，配时间分配与复盘要点
- **系统设计** — 框架 + 组件 + 7 个案例
- **语言细节** — 速查附录

进度存在浏览器 localStorage（key `acm-prep-progress-v1`），换设备不同步。侧栏底部可以清空。

## 每道题看到什么

展开一道题后，**默认只显示题面**——描述、示例、约束，和 OJ 上一样。
下面三块是折叠的，需要主动点开：

- **解题思路** — 用什么算法、状态怎么定义
- **易错点** — 具体会踩的坑，建议写完再看，用来对照
- **延伸 / 变体** — 相关题目和推广方向

底部有跳转链接，去 LeetCode 提交代码、看官方题解和评论区的其他解法。

## 数据是怎么来的

题号不是凭记忆写的。`data/leetcode-index.json` 是从 LeetCode GraphQL API 抓下来的全量题目索引（4041 题），
`scripts/build.mjs` 会把 `data/raw/*.json` 里手写的课程内容逐题对照索引校验：

- 题号不存在 → **构建直接失败**，不会生成 `curriculum.json`
- 标题对不上 → 警告，并强制使用官方标题
- 难度、标签、是否会员题、题目链接 → 全部取自索引，不手写

题面单独存放在 `public/statements/<题号>.json`，由 `scripts/fetch-statements.mjs` 抓取。
App 在展开题目时才按需加载，所以：题面不进打包产物、缺某一道不影响其他题、抓取失败会退化成只显示跳转链接。
存盘前会剥掉 `<script>` / `<iframe>` / `on*` 事件属性。

### 重新生成数据

```bash
npm run rebuild      # 仅重新合并校验 data/raw/*.json
npm run statements   # 补抓缺失的题面（已存在的会跳过）
npm run data         # 全量：重抓索引 + 合并校验 + 抓题面
```

`npm run statements -- --force` 可以强制重抓全部题面。

## 部署

推到 `main` 会触发 `.github/workflows/deploy.yml`，自动构建并发布到 GitHub Pages。
构建时会先跑 `npm run rebuild` 校验题号，**题号写错会让 CI 失败而不是把错误内容发出去**。

`vite.config.js` 的 `base` 由环境变量 `BASE_PATH` 控制（workflow 里设成 `/<仓库名>/`），
本地开发和 `vite preview` 用默认的 `/`。

### 离线是怎么做的

`scripts/make-sw.mjs` 在 `vite build` 之后读取真实的 `dist/` 产物生成 `sw.js`：

- **App shell**（HTML/JS/CSS/图标/manifest）在 Service Worker 安装时全量预缓存
- **题面**按需缓存——打开一道题就存一道，或者用侧栏的按钮一次性存全部
- 缓存名带 shell 内容的哈希，所以每次改动都会自然失效旧缓存

## 用法建议

每天先做完当天的**核心**题（侧栏可筛选），选做题当作余力或周末补。
先读题面自己想，卡住 15 分钟再点开思路；易错点最好等写完再看，用来对照自己有没有踩中。
