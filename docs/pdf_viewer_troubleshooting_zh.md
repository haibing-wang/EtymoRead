# EtymoRead PDF 阅读器问题分析与解决步骤总结

在对 **EtymoRead** 插件的 PDF 阅读器进行迭代和优化过程中，我们围绕 **PDF 拦截机制、渲染性能、翻页交互、渲染竞态、以及鼠标拖拽平移（Drag-to-Pan）** 展开了多轮调试与改进。

本篇文档旨在总结在此期间遇到的核心问题、深层技术原因以及对应的解决步骤，作为后续架构维护和功能迭代的重要参考。

---

## 目录
1. [问题一：PDF 拦截规则对用户的强侵入性](#问题一pdf-拦截规则对用户的强侵入性)
2. [问题二：大缩放比例下滚动与翻页的交互冲突与性能折中](#问题二大缩放比例下滚动与翻页的交互冲突与性能折中)
3. [问题三：快速翻页时 PDF.js 渲染竞态错误](#问题三快速翻页时-pdfjs-渲染竞态错误)
4. [问题四：鼠标点击拖拽平移（Drag-to-Pan）未生效的深层原因](#问题四鼠标点击拖拽平移drag-to-pan未生效的深层原因)

---

## 问题一：PDF 拦截规则对用户的强侵入性

### 1. 现象与诉求
原先插件在安装后，会默认无条件拦截所有在线 PDF 请求和本地 `file://` PDF 打开动作，强制重定向至插件内置的 PDF 阅读器。
用户希望能够**自主选择**是否使用插件的 PDF 服务：若关闭则不提供服务（使用浏览器默认 PDF Viewer），若开启则可享受插件的词根词缀高亮服务。

### 2. 问题原因
*   在 Chrome 扩展的 `manifest.json` 中配置静态重定向规则或在 Service Worker 中无条件拦截，缺乏对用户偏好设置的动态感知。

### 3. 解决步骤
1.  **引入用户配置状态**：在插件的 `chrome.storage.local` 中引入 `pdfEnabled` 配置项（布尔值，默认 `false`）。
2.  **配置页面开关 UI**：在 `entrypoints/popup/main.tsx` 中添加“启用自定义 PDF 阅读器”的 Toggle 开关，实时修改 `pdfEnabled` 值。
3.  **动态同步拦截规则**：
    *   在 `entrypoints/background.ts` 中，使用 WXT 提供的 `declarativeNetRequest` 动态规则（Dynamic Rules）代替静态规则。
    *   当监听到 `pdfEnabled` 变化或 Service Worker 启动时，调用 `chrome.declarativeNetRequest.updateDynamicRules`：
        *   若为 `true`：添加 ID 为 `1` 的动态重定向规则，拦截 `.pdf` 结尾的 `http/https` 请求；
        *   若为 `false`：清除所有动态拦截规则。
4.  **本地文件拦截条件化**：
    *   在 `background.ts` 的 `chrome.webNavigation.onBeforeNavigate` 监听器中，首先调用 `chrome.storage.local.get('pdfEnabled')`，仅在开启时才拦截并重定向 `file://` 协议的 PDF 文件。

---

## 问题二：大缩放比例下滚动与翻页的交互冲突与性能折中

### 1. 现象与诉求
当 PDF 默认以较大比例展示（如 300% 宽度平铺）时，单个页面的物理高度远超浏览器可视视口。
*   **最初行为**：鼠标滚轮稍微向下一滚或按键盘方向键，页面就直接强行翻到下一页，导致当前页面下半部分（剩下的 70% 内容）被直接跳过，根本无法显示。
*   **期望行为**：滚轮/方向键向下应先在当前页面内正常滚动展示，只有当滚动条确实触及页面最底部时，再次向下滚动才触发翻页。

### 2. 尝试与性能折中

#### 方案 A：多页连续滚动模式（Continuous Scroll Mode）
*   **做法**：将 PDF 渲染模式改为像普通 PDF 阅读器那样把所有页面渲染在一个长列表（Canvas 数组）中，使用系统原生滚动条。
*   **副作用**：**性能直线下降，页面卡死。**
*   **深层原因**：
    *   EtymoRead 的核心功能是对渲染出来的文本图层（Text Layer）进行实时分析，使用词根词缀库做复杂的字符串截取、匹配并利用 DOM 重构注入 `<span>` 标签高亮（即 `highlightDOM` 操作）。
    *   当一次性渲染多页或快速滚动时，大量的 Canvas 渲染、Text Layer 重绘以及频繁的 DOM 文本解析和节点插入重构，会长时间阻塞浏览器的 JS 单线程，造成界面完全失去响应。

#### 方案 B：单页滚动模式 + 边界拦截翻页（最终采用方案）
*   **做法**：退回单页模式（一次只渲染一个页面以保证极致的词根分析性能），但给承载页面的容器增加 `overflow: auto`。
*   **解决逻辑**：
    1.  **鼠标滚轮（Wheel）优化**：
        *   监听容器的 `wheel` 事件，实时读取 `scrollTop`（当前滚动位置）、`clientHeight`（视口高度）与 `scrollHeight`（总滚动高度）。
        *   只有当向上滚动且 `scrollTop <= 2`（已达顶部）时，才切换至上一页，并将滚动条拉到上一页的底部。
        *   只有当向下滚动且 `scrollTop + clientHeight >= scrollHeight - 2`（已达底部）时，才切换至下一页，并将滚动条拉到下一页的顶部。
        *   在其余位置，**拦截默认翻页动作**，允许浏览器执行正常的容器内垂直滚动。
    2.  **键盘导航（Keydown）同步**：
        *   对 `ArrowDown` 和 `ArrowUp` 键做类似拦截：若未触达边界，通过 `container.scrollBy({ top: 120, behavior: 'smooth' })` 平滑微滚；若触达边界则改变 `pageNum` 翻页。
        *   `Space`（空格）键滚动 `clientHeight * 0.85`；`PageDown`/`PageUp` 维持快速翻页体验。

---

## 问题三：快速翻页时 PDF.js 渲染竞态错误

### 1. 现象与报错
在快速滚动或连续按键翻页时，控制台抛出如下异常：
`Error rendering page: Error: Cannot use the same canvas during multiple render() operations. Use different canvas or ensure previous operations were cancelled or completed.`
导致页面画布白屏或卡住不再重绘。

### 2. 问题原因
*   在 React 中，翻页会改变 `pageNum` 状态，触发 `useEffect` 重新异步渲染页面。
*   渲染是一个多阶段异步任务（获取页面 -> 渲染 Canvas -> 渲染 TextLayer）。如果在前一次 `canvas.render()` 尚未结束时，下一次渲染任务又被触发并在同一个 `<canvas>` 节点上调用了 `render()`，PDF.js 内部的状态机就会报错。

### 3. 解决步骤
1.  **维护渲染任务引用**：在组件内使用 `renderTaskRef = useRef<any>(null)` 存储当前的 PDF.js `RenderTask` 句柄。
2.  **前置取消逻辑**：在发起新的渲染流程前，检测 `renderTaskRef.current`：
    *   若存在，立即调用 `renderTaskRef.current.cancel()` 强行中止前次渲染。
    *   使用 `await renderTaskRef.current.promise` 等待前次任务彻底宣告失败/取消（捕获 `RenderingCancelledException` 异常以防控制台报错）。
    *   任务置为空，再安全地发起下一次 `page.render()`。
3.  **副作用卸载清理**：在 `useEffect` 的 Cleanup 返回函数中，同样将 `cancelled` 设为 `true` 并调用 `cancel()`，防止组件卸载或更新后，残留的异步回调修改已销毁的 DOM 元素。

---

## 问题四：鼠标点击拖拽平移（Drag-to-Pan）未生效的深层原因

### 1. 现象与诉求
由于高倍数放大后滚动条较长，用户希望能够通过鼠标左键点击 PDF 页面并拖拽，实现类似 Adobe Reader / PDF.js 默认的“抓手工具（Hand Tool）”平移页面效果。
经过修改后，虽然光标在按下时能正确地从 `grab` 变为 `grabbing`，但是**拖拽时页面完全不随鼠标移动而滚动**，拖拽操作未生效。

### 2. 深层原因分析
拖拽平移功能基于 Pointer Events（`pointerdown`, `pointermove`, `pointerup`）配合元素捕获 `setPointerCapture` 实现，未生效的原因主要有以下三点：

1.  **文本图层（Text Layer）的默认选择行为冲突**：
    *   为了实现单词悬浮显示词根和双击 AI 分解，PDF 渲染出的 Canvas 之上覆盖了一层透明文本图层 `.pdf-text-layer`（内含大量绝对定位的 `<span>` 字符）。
    *   当鼠标在页面上按下并拖拽时，浏览器会默认将其识别为**文本选择动作（Text Selection）**。
    *   即便在 `pointerdown` 时调用了 `e.preventDefault()`，浏览器对子层文本的选择状态管理和事件冒泡截获，依然会打断 `pointermove` 带来的持续位移计算。
2.  **高亮元素（Highlight Spans）过滤冲突**：
    *   在拖拽按下处理函数中有如下代码：
        ```typescript
        const target = e.target as HTMLElement;
        if (target.closest('.etymoread-highlight')) return;
        ```
    *   这是为了防止用户点击高亮单词触发悬浮卡片时引发意外拖拽。但这也意味着，如果用户点按时**正好落在了有下划线的高亮单词上**，拖拽初始化逻辑会直接被 `return` 阻断，彻底失效。
3.  **HTML5 原生拖拽机制的干扰**：
    *   虽然在渲染时对 `<canvas>` 节点设置了 `draggable={false}`，但是父容器和文本图层的其他层级节点在未被完全显式禁用原生拖拽时，依然可能在拖拽一定距离后触发浏览器的原生拖拽阴影或禁止符号，打断 Pointer Capture 状态的延续。

### 3. 未来的改进方向
如果后续版本计划重新点亮“抓手工具”拖拽功能，建议采取以下技术重构：
1.  **模式切换（Hand vs. Text Selection Tool）**：
    *   学习专业 PDF 阅读器，在工具栏提供一个“选择文字”与“抓手平移”的模式切换按钮。
    *   当处于“抓手平移”模式时，通过 CSS 禁用文本图层的指针事件：
        ```css
        .textLayer { pointer-events: none; }
        ```
        此时文本不再可被框选或触发悬浮，所有的 `pointerdown` 将百分之百干净地落在滚动容器上，从而保证 `scrollLeft` 和 `scrollTop` 的无干扰更新。
2.  **优化 Pointer Capture 的应用层级**：
    *   不要直接在会滚动的容器上应用 Pointer Capture，而是在外层静止的 Wrapper 上应用，或者在 `pointerdown` 时动态判断事件目标，如果不是高亮词，再禁用容器下的子元素交互。
