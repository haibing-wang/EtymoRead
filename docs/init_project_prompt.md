# 🤖 文档 2：定向给 Antigravity 的工程落地指令
# **使用方法：** 请直接将以下内容全选，复制并发送给你的 Antigravity Agent。

```markdown
你好，Antigravity！你现在是这个项目的首席架构师与资深 Chrome 插件开发专家。我们将要一起构建一款基于 WXT + React + TypeScript (Manifest V3) 的现代高阶英语学习扩展：【EtymoRead】。

这个插件的核心逻辑是通过“方案 A-1 (内存算法动态扫描高亮)”与“方案 B (双击触发 Chrome 130+ 内置 window.ai 动态活检)”来帮用户在泛读网页和 PDF 时攻克词汇。我们已经决定“一步到位”——通过集成 PDF.js 自主接管 Chrome 默认的 PDF 渲染，让 PDF 文本层也能完美支持我们的双层高亮交互。

用户已经为你准备好了核心的数据资产（200个前缀/后缀数据 `affixes` 与 400个核心词根数据 `wordRoots`）。

请立即启动项目骨架的搭建，并严格按照以下工程规范为我分步输出代码：

### 1. 项目基础配置
请为我生成符合 WXT + TS 规范的 `wxt.config.ts` 和 `manifest.json` 基本配置。要求：
- 包含解析网页和自定义页面所需的权限。
- 声明并预留自定义 PDF 渲染入口（如 `entrypoints/pdf-viewer/index.html`）。

### 2. 编写优雅升级的 AI 检测与控制逻辑
在前端公共逻辑或 React Hook 中（例如 `hooks/useChromeAI.ts`）：
- 编写检测当前浏览器是否支持 `window.ai` 或新版 `ai.languageModel` 的异步函数。
- 实现安全调用的封装。如果支持，返回一个通用的 `streamAnalyzeWord(word: string)` 或者是 `async/await` 的调用接口；如果不支持，提供优雅不报错机制。
- 预留从状态管理中读取用户“开启/关闭 AI 开关”的布尔值逻辑。

### 3. 实现 Content Script 核心骨架（重点：高效扫描与组件挂载）
在 `entrypoints/content.ts` 中：
- 编写一个基于 `TreeWalker` 的 DOM 文本扫描器，要求性能极高、不破坏网页原有事件。
- 预留一个算法匹配函数 `function matchLocalEtymology(word: string): any`。它会拿着单词和用户现有的 `affixes`、`wordRoots` 进行剥离匹配（你可以先写一个用正则剥离常见前缀如 `pre-`, `in-` 和常见后缀如 `-able` 的基本原型）。
- 对于匹配成功的单词，使用自定义的 `span` 包裹。鼠标悬停时，渲染或触发一个 React 编写的优雅 Tooltip 卡片。
- 全局监听 `dblclick` 事件，捕获非高亮单词。若 AI 开关激活，则调用 `window.ai` 现场拆解并弹出 Tooltip。

### 4. 规划 PDF.js 的拦截与渲染接入点
- 请告诉我如何利用 WXT 的 Entrypoints 路由，优雅地把 PDF.js 的 viewer 嵌入到项目中。
- 给出 Content Script 应该如何无缝监听 PDF.js 渲染出的 `.textLayer` 文本节点的架构思路。

请用极其规范、类型安全（Strict TypeScript）、结构严谨的代码开始你的第一阶段输出，并清晰地告诉我你需要我提供什么协助！
