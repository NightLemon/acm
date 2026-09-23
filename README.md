# 个人刷题库

一个支持导入、保存和切换个人 LeetCode 题库的 Web App。展示**题面 + 解题提示**，不做 judge——代码在 LeetCode 上提交，这里负责组织题单、记录进度、计时和笔记。

**在线地址：https://nightlemon.github.io/acm/**

## 手机上使用

用手机浏览器打开上面的地址，然后：

- **iOS Safari** — 分享按钮 → 「添加到主屏幕」
- **Android Chrome** — 右上角菜单 → 「安装应用」/「添加到主屏幕」

装好之后是全屏的，没有浏览器地址栏。可以点侧栏底部的**「离线缓存题面」**缓存当前部署已有的题面；自定义题库中未随网站发布的题面仍需前往 LeetCode 查看。

## 本地启动

```bash
npm install
npm run dev
```

浏览器会自动打开 http://localhost:5180 。同一局域网内手机也能访问终端里打印的 Network 地址。

## 题库与分组

- 项目原有题目会作为不可删除的 **ACM 默认题库**。
- 侧栏可以切换题库和分组；“全部题目”会按导入顺序展示所有分组。
- “管理 / 导入题库”支持保存多份 JSON 题库、删除个人题库和下载模板。
- 每份题库的完成状态、笔记、计时和代码描述缓存相互独立。
- 题库和刷题状态只存在当前浏览器的 localStorage 中，换浏览器或设备不会同步。

升级旧版本时，原有的进度、笔记和计时会自动复制到 ACM 默认题库；旧存储键会保留作为备份。

## 每道题看到什么

展开一道题后，**默认只显示题面**——描述、示例、约束，和 OJ 上一样。
下面三块是折叠的，需要主动点开：

- **解题思路** — 用什么算法、状态怎么定义。**会先拦一道**：思考时间不够时点开只显示「再想 N 分钟」，可以强行跳过，但至少让你意识到自己在提前看答案
- **易错点** — 具体会踩的坑，建议写完再看，用来对照
- **延伸 / 变体** — 相关题目和推广方向

再往下有一个**笔记框**，写一句话收获（状态定义、卡住的边界），失焦自动保存，二刷时题目行上会显示「笔记」标记。

同一时间只展开一道题。题号本身是跳转链接。筛选栏里的**「↓ 下一道未完成」**会按当前题库、分组和筛选条件跳到下一道没做的题。

底部有跳转链接，去 LeetCode 提交代码、看官方题解和评论区的其他解法。

## 描述实现

“描述实现”工作栏用于把已经想清楚的算法逻辑机械地翻译成代码，不负责解题、运行或判题。在任意题目的展开区域点击“描述逻辑并生成代码”后，左侧保留当前题库导航与完整题面，右侧打开生成栏。侧栏中的“独立代码生成”可打开不关联题目的工作区。每道题在当前题库和标签页内拥有独立工作区；题号和标题只用于本地隔离，不会自动发送给模型。

使用步骤：

1. 选择 C++17 或 Python 3。从题目进入时，空会话会自动载入 LeetCode 官方 `codeSnippets` 输入输出模板；独立工作区则手动粘贴包含唯一目标方法的 `class Solution` 和函数输入输出定义。同一标签页内切回该题会保留临时代码，也可随时点击“恢复官方模板”。
2. 发送描述时，页面会自动识别目标函数，并在请求前将真实函数名替换为 `__TARGET_FUNCTION__`；生成完成后再在本地还原，无需手动确认。
3. 配置 OpenAI-compatible Chat Completions API 的 Base URL 和 API key。页面会自动调用 `/models` 探测模型并提供选择；如果 Provider 不支持模型列表或受 CORS 限制，仍可手动填写 Model。
4. 在下方按实现顺序描述数据结构、循环、分支、边界处理、修改规则和返回规则。
5. 每次发送先调用一次模型检查描述是否完整；不完整时只能追问。检查通过后再调用一次模型流式生成代码，所以一次完整生成通常产生两次模型调用和费用。

Provider 设置位于工作区上方；代码编辑器和逻辑确认对话组成连续的同一工作区。生成完成后，完整代码只写入上方编辑器，不在聊天消息中重复展示，可以直接手动微调，再使用“复制代码”和右栏顶部的“打开力扣提交”完成提交。

严格边界：

- 请求不会自动包含题面、题号、标题、URL、标签、题库提示或本地会话 metadata。
- system prompt 明确禁止模型根据签名猜题、调用记忆中的标准答案、补算法、优化或替换用户方案。
- 校验失败、生成中断、协议不合法、模型猜回真实函数名或修改目标接口时，不会覆盖编辑器中的原代码。
- 模型内容只按纯文本/代码显示，不渲染其 HTML。
- 用户主动粘贴到聊天框中的内容仍会发送；页面无法可靠判断一段自然语言是否包含题面。

函数名脱敏只降低模型匹配已知题目的可能性，不能提供绝对保证。参数名、参数类型和用户描述仍可能暴露题目特征。普通 `class Solution` 模板仍要求只有一个 public 目标方法，helper 应放在 `private` 区域或目标方法内部；LRU Cache、Min Stack 等设计类则会把类名、构造器名称和全部 public 方法名分别替换为稳定占位符，并保留所有接口签名。

官方模板由 `npm run templates` 从 `leetcode.com` 同步到 `data/code-templates.json`，模板只在浏览器本地读取。单函数题与多方法设计题均可直接生成；当前缓存覆盖 LeetCode 全量公开题目中提供 C++ 或 Python 代码片段的题目。

在侧栏打开“独立代码生成”，粘贴任意 `https://leetcode.com/problems/<slug>/` 链接即可识别题目并自动载入官方作答模板。也支持带 `/description/` 和查询参数的链接；其他平台链接不会加载，旧版 `leetcode.cn` 链接只用于兼容迁移。

### Provider 与 API key

当前网站仍是纯静态 GitHub Pages，没有后端代理。浏览器会直接请求用户填写的 OpenAI-compatible endpoint，因此 Provider 必须允许来自本站的 CORS 请求。Base URL 可以填写到 `/v1` 或直接填写完整的 `/chat/completions` 地址。

为兼容不接受采样参数的推理模型，请求不会发送可选的 `temperature`。Base URL 和 key 填写完成并停止输入约 700ms 后，页面会通过同一 key 请求对应的 `/models` 地址；探测失败只影响模型下拉建议，不阻止手动配置。

API key 默认只保存在当前标签页的 `sessionStorage`。只有显式勾选“在此浏览器中记住 key”后才会写入 `localStorage`；同源脚本或 XSS 可能读取这些浏览器存储，所以不要在公共设备保存 key。页面提供“清除 key”操作。生产 endpoint 必须使用 HTTPS，仅本地调试的 localhost 允许 HTTP。

未发送的描述草稿、已发送的描述/澄清记录和当前语言会按 `libraryId + problemId` 自动写入当前浏览器的 localStorage，刷新或意外关闭页面后可以继续；最多保留最近 80 个工作区。“恢复官方模板”、清空当前题库或删除题库会同步清除对应缓存。

编辑器代码仍只保留在当前标签页内存中，刷新后重新载入官方模板；Provider 配置和 API key 不会写入描述缓存。自定义题号没有可用官方模板时，需要手动粘贴函数定义。LLM 调用依赖网络，离线时仍可编辑代码，但不能生成。

### 计时

题目展开时开始累计思考时间，收起就暂停，刷新不丢。展开的题目底部可以单独重置计时。

## 导入个人题库

在“管理 / 导入题库”中下载 [`public/problem-library-template.json`](public/problem-library-template.json)。它是一份可直接导入的完整示例，覆盖 `core` / `optional` 以及所有增强字段，也可以直接交给 Agent，让它保持结构并替换内容。文件上限 1 MB，核心格式为：

```json
{
  "schemaVersion": 1,
  "id": "my-interview-list",
  "name": "我的面试题库",
  "description": "后端面试常见算法题",
  "groups": [
    {
      "name": "数组与哈希",
      "description": "基础数组、哈希表",
      "problems": [
        {
          "source": "leetcode",
          "url": "https://leetcode.com/problems/two-sum/"
        },
        {
          "source": "leetcode",
          "id": "49",
          "url": "https://leetcode.com/problems/group-anagrams/",
          "tier": "core",
          "est": 25,
          "idea": "把排序后的字符串作为哈希键",
          "pitfall": "注意空字符串和重复字符串",
          "variants": ["#242 有效的字母异位词"]
        },
        {
          "source": "leetcode",
          "id": 15,
          "url": "https://leetcode.com/problems/3sum/",
          "tier": "optional",
          "est": 35,
          "idea": "排序后固定一个数，再使用双指针",
          "pitfall": "移动指针后跳过重复值",
          "variants": ["#18 四数之和"]
        }
      ]
    }
  ]
}
```

- `schemaVersion` 必须为 `1`；`id` 使用 2–64 位小写字母、数字、下划线或连字符，并在以后更新同一题库时保持不变。
- `name` 和非空 `groups` 必填；每个分组必须有 `name` 和非空 `problems`。
- 每道题应显式填写 `source` 和 `url`。当前 `source` 只支持 `leetcode`；`url` 必须是 `leetcode.com` HTTPS 原题链接。`id` 可省略并由 URL 的 slug 自动识别，也可填写数字或数字字符串用于双重校验。
- 题目对象还支持：`tier`、`est`、`idea`、`pitfall`、`variants`。`tier` 只接受 `core` / `optional`，`est` 为 1–600 分钟，`variants` 为字符串数组，这些增强字段均可省略。
- `title`、`difficulty`、`tags`、`paidOnly` 和 `slug` **不要写入导入文件**，它们会在校验 `id` 和 `url` 后从内置 LeetCode 索引自动补齐，导入内容不能覆盖官方元数据。
- 旧题库中的纯数字题号或缺少 `source` / `url` 的对象会在加载时自动补齐为 `leetcode.com` 链接并回写，`schemaVersion` 仍为 `1`。
- 不存在的题号、同一分组内重复的题号、HTML 或额外字段会在导入时指出具体位置。
- 重新导入相同 `id` 会提示覆盖题库内容，但保留该题库已有刷题状态。

## 数据是怎么来的

题号不是凭记忆写的。`data/leetcode-index.json` 是部署时从 LeetCode GraphQL API 刷新的全量题目索引，
`scripts/build.mjs` 会把 `data/raw/*.json` 里手写的课程内容逐题对照索引校验：

- 题号不存在 → **构建直接失败**，不会生成 `curriculum.json`
- 标题对不上 → 警告，并强制使用官方标题
- 难度、标签、是否会员题、题目链接 → 全部取自索引，不手写

题面单独存放在 `public/statements/<题号>.json`，由 `scripts/fetch-statements.mjs` 抓取。
App 在展开题目时才按需加载，所以：题面不进主包、缺某一道不影响其他题、未缓存时会退化成只显示跳转链接。导入题库时会懒加载全量 LeetCode 索引，用于校验题号并补齐元数据。
存盘前会剥掉 `<script>` / `<iframe>` / `on*` 事件属性。

### 重新生成数据

```bash
npm run rebuild      # 仅重新合并校验 data/raw/*.json
npm run templates    # 重抓 LeetCode 全量索引和官方 C++ / Python 模板
npm run statements   # 补抓缺失的题面（已存在的会跳过）
npm run data         # 全量：重抓索引 + 合并校验 + 抓题面
npm test             # 函数名脱敏、请求边界、Provider 存储和流式协议测试
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

可以先筛选**核心**题，再用“下一道未完成”依次推进。先读题面自己想，卡住一段时间再点开思路；易错点最好等写完再看。
