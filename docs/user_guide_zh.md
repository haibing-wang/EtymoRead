# EtymoRead 用户使用手册 (User Guide)

欢迎使用 **EtymoRead** —— 您的词根词缀智能阅读助手。EtymoRead 是一款专为英语学习者和学术研究人员设计的 Chrome 浏览器插件。它能在您泛读网页或 PDF 文档时，通过离线规则匹配与本地大语言模型（Gemini Nano）的双重加持，帮助您一眼看透单词的底层逻辑，摆脱死记硬背。

---

## 1. 主要功能特性

*   **🔍 离线词根高亮与悬浮拆解 (Hover Interaction)**
    *   内置 600+ 精选前缀、后缀和词根的本地数据库。
    *   当鼠标悬停在带有下划线高亮的派生词上时，卡片将在 200ms 内触发，瞬间显示词根词缀及其含义、来源（如拉丁语、希腊语）以及同源词。
    *   **极致避让避错算法**：自动过滤 3 字符以下超短词、停用词（如 the, and, with），且仅在同时剥离出合法前后缀并匹配到词干时才进行高亮，避免误匹配。
*   **✨ 本地 Gemini Nano AI 深度拆解 (Double-Click AI)**
    *   双击任意网页单词，可一键调取 Chrome 130+ 浏览器内置的 Gemini Nano 离线大模型。
    *   AI 会自动根据当前句子的上下文，对单词进行精细拆解，输出详细的语境释义，全程 100% 离线，无网络隐私泄露风险。
*   **📄 专业的本地 & 网页 PDF 阅读器**
    *   自动拦截或拖拽本地 PDF 进行专业版预览，完美渲染中日韩（CJK）中文字符。
    *   支持**鼠标滚轮平滑翻页**（防多页连翻优化）及**自定义高级滚动条**。
    *   支持键盘导航（方向键翻页、空格键滚动、Home/End 跳页）。

---

## 2. 详细使用指南

### 2.1 悬浮卡片交互
1. 打开任意英文网页（如新闻、博客、英文文献）。
2. 被识别出词根规律的词汇会自动附带紫色虚线下划线。
3. 将鼠标移至单词上并停留 **200ms**，悬浮卡片即会自动定位在单词下方或上方合适位置。
4. **过载匹配折叠**：由于英语规则的复杂性，纯离线算法可能出现过度匹配（Over-matching）。我们在卡片中提供了一个折叠气泡 `⚠️ Notice on Over-matching`，点击可查看匹配原理说明。

### 2.2 本地 AI 深度分析
1. 在网页上双击任意不认识的单词。
2. 如果您在插件控制台中启用了本地 AI，悬浮卡片上将直接调起大模型进行全量 deconstruction 流式输出。
3. 如果尚未启用，您会看到置灰按钮 `✨ Local AI Analysis (Requires Chrome AI)`，提示您需要启用 Chrome 浏览器的本地 AI 功能。

---

## 3. Chrome 本地 AI (Gemini Nano) 启用教程

如在使用时系统提示 **"No Local AI Detected"** (未检测到本地 AI)，请按照以下步骤激活 Chrome 内置的免费离线大模型：

1.  **确认浏览器版本**：确保您的 Google Chrome 版本为 130 或更高版本。
2.  **打开配置旗帜**：在浏览器地址栏输入 `chrome://flags` 并按回车。
3.  **配置 On-Device Model 选项**：
    *   搜索 `Enables optimization guide on device model`
    *   将其下拉框设置为 **Enabled BypassPrefRequirement**（这是最关键的一步，跳过存储与电池电量检测，强制激活）。
4.  **配置 Prompt API 选项**：
    *   搜索 `Prompt API for Gemini Nano`
    *   将其下拉框设置为 **Enabled**。
5.  **重启 Chrome 浏览器**：点击页面右下角的 **Relaunch** 按钮。
6.  **检查模型下载进度**：
    *   重启后，在地址栏输入 `chrome://components` 并回车。
    *   找到 `Optimization Guide On Device Model` 组件，点击 **Check for update**。
    *   等待其状态显示为 **Up-to-date** (即代表 100% 离线模型已经下载完成，大小约 1.5 - 3GB)。
7.  **完成启用**：打开 EtymoRead 插件右上角的设置面板，您将看到状态变为 `Local AI Ready`，此时即可勾选 `Enable Local AI on Double-Click` 开关。

---

## 4. 常见问题 (FAQ)

#### Q1. 为什么有些高亮单词点击不了它本身的超链接了？
我们在新版本中彻底优化了浮动窗口的定位。使用 React `useLayoutEffect` 对渲染尺寸进行物理定位，保证卡片底部/顶部距离单词有固定的 `20px` 视觉盲区安全距离。同时设置了 200ms 悬浮防误触延时，即使快速划过鼠标也不会遮挡原有链接，您可以放心直接点击。

#### Q2. 为什么有些常见词（如 "make", "be", "with"）双击后提示 "This is a basic or high-frequency word that cannot be logically deconstructed."？
为了防止大语言模型胡乱生硬地拆解没有任何前缀词根的超高频基础词（Hallucination 幻觉），我们调低了 AI 运行温度（Temperature: 0.1）并设置了拒绝拆解指令。对于不合常理的拆解请求，AI 会被强制拦截并返回这一友好提示，这是正常的产品避错设计。

#### Q3. 这个插件会不会收集我的浏览隐私和阅读历史？
**绝对不会。** EtymoRead 的所有逻辑（无论是离线前缀词根匹配，还是 Gemini Nano AI 分析）均在您的个人设备内存中离线运行。该插件不包含任何外部网络 API 呼叫，不传输任何数据至任何云端服务器。100% 本地处理，零隐私风险。
