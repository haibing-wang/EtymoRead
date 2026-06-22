# Chrome 插件发布通用指南 & 模板 (Publishing Guide Template)

本手册是适用于 Chrome 应用商店（Chrome Web Store）上架的通用发布指南。您可以将其作为模版，快速修改并应用到您的第三个 Chrome 插件上。

---

## ⚠️ 发布前核心避坑指南 (Pre-publish Checklist)

在上传包和物料之前，请务必自检以下五大“审核红线”：

1.  **版本号限制 (Version)**：
    *   `manifest.json` 或 `package.json` 中的版本号绝对不能为 `0.0.0`。
    *   首次发布推荐直接设为 `1.0.0`（格式必须符合 `N.N.N.N`，例如 `1.0.0` 或 `1.0.0.0`）。
2.  **简介字数超限 (Short Description)**：
    *   插件的“简短说明”在商店后台有严格的 **132 个字符 (Characters)** 限制，超出会导致保存失败。
    *   请提前精简英文 Tagline。
3.  **权限最小化与主机权限警告 (Permissions & Host Access)**：
    *   **能用 `activeTab` 就不用 `<all_urls>`**。如果插件仅在用户点击时才需要操作网页，使用 `activeTab` 权限可享受“极速自动审核”（几小时内即可上架）。
    *   如果像 **EtymoRead** 一样必须实现“网页打开后全自动运行”，则必须请求 `<all_urls>`。这会触发 **Broad Host Permissions（广域主机权限）警告**，插件将转为**人工深度审核**（通常需要 2 至 7 个工作日），并且必须在后台填写详尽合理的 **Host Permission Justification** 说明。
    *   检查并彻底删除 `entrypoints/` 或 `manifest` 中遗留的未使用的 Boilerplate 代码和脚本（如默认匹配 `google.com` 的测试 content script），避免引起不必要的权限解释审查。
4.  **商店图片素材限制 (Graphics Assets Specs)**：
    *   Chrome Store 规定所有上传的屏幕截图和宣传图必须**不包含透明通道 (no alpha channel / 24-bit PNG)**，且符合指定的长宽像素：
        *   **屏幕截图 (Screenshots)**：**`1280 x 800`** 像素（或 `640 x 400`）。至少 1 张，最多 5 张。
        *   **小宣传瓷砖图 (Small promo tile)**：**`440 x 280`** 像素。
        *   **大宣传瓷砖图 (Marquee promo tile)**：**`1400 x 560`** 像素。
    *   💡 **macOS `sips` 图像处理修复黑科技**（若遇到 "The image size is incorrect" 或 "Alpha channel not allowed" 报错，可在终端运行以下命令一键修复）：
        ```bash
        # 1. 裁剪并缩放到指定分辨率并去除 alpha 通道，转换为标准的真 24-bit PNG
        # 裁剪比例 (以 1280x800 为例，裁掉正方形上下多余像素)：
        sips -c 640 1024 input_square.png --out temp.png
        # 等比放大至目标尺寸并保存：
        sips -s format png -z 800 1280 temp.png --out screenshot1.png
        
        # 2. 检查图片格式和是否包含透明度 (hasAlpha)
        sips -g format -g hasAlpha screenshot1.png
        # 确保输出为 format: png 且 hasAlpha: no
        ```
5.  **隐私政策声明 (Privacy Policy)**：
    *   只要申请了 `<all_urls>` 等敏感主机权限，必须提供一个公开的隐私政策网页网址。
    *   可以使用 **GitHub Gist / GitHub Pages / Notion 公开页** 托管一个极简的静态英文隐私说明网页。

---

## 🚀 步骤 1：打包发布安装文件 (.zip)

如果您使用的是 **WXT** 框架，直接在项目根目录下运行内置压缩命令：

```bash
pnpm run zip
# 或者 npm run zip
```

*   **编译结果**：WXT 会自动在 `.output/` 目录下打包成格式为 `[插件名称]-[版本号]-chrome.zip`（例如 `.output/etymoread-1.0.0-chrome.zip`）的压缩包。
*   如果使用普通 **Vite / Webpack** 项目，编译后需手动将 `dist/` 文件夹内的所有内容打成一个 `.zip` 包。

---

## 🔑 步骤 2：注册并登录开发者控制台

1.  访问 [Chrome 应用商店开发者控制台 (Chrome Developer Dashboard)](https://chrome.google.com/webstore/devconsole/)。
2.  使用您的 Google 账号登录。
3.  **支付注册费**：首次使用需要支付一次性的 **$5 美元** 开发者注册费（准备一张支持双币或外币的信用卡，如 Visa / MasterCard）。

---

## 📦 步骤 3：上传插件并创建商品项

1.  进入开发者控制台主页，点击右上角 **“添加新商品” (New Item)**。
2.  将刚才生成的 `.zip` 包拖入上传窗口。系统解析无误后会自动创建草稿，并进入商品详情页。

---

## 📝 步骤 4：填写详情信息 (Store Listing)

根据您的第三个插件，复制并填写对应英文文案（建议主语言选 **English** 以覆盖全球用户）：

1.  **商品名称 (Product Title)**：控制在 45 个字符以内（例如：`EtymoRead: AI Etymology Reading Assistant`）。
2.  **简介 (Short Description)**：控制在 132 个字符以内。
3.  **详细说明 (Detailed Description)**：支持富文本。需包含：主要功能列表、简要使用指南、FAQ，以及如果是 AI 或需要配置的插件，加入简易配置教程。
4.  **类别 (Category)**：选择核心功能对应的分类（如 `Education`、`Productivity`、`Search Tools`）。
5.  **搜索关键字 (Keywords)**：最多添加 5 个关键词，用英文逗号分隔。

---

## 🎨 步骤 5：上传宣传物料 (Graphics Assets)

1.  **商店图标 (Store Icon)**：
    *   尺寸：必须是 **128 x 128 像素** (PNG 格式)。
    *   可以直接上传项目 `public/` 下的 `icon-128.png`。
2.  **屏幕截图 (Screenshots)**（最多 5 张）：
    *   尺寸必须为 **1280x800 像素**，无透明度通道的 PNG。
    *   直接上传使用 `sips` 转换好的 `screenshot1.png`、`screenshot2.png` 等。
3.  **宣传瓷砖图 (Promo Tiles)**：
    *   小宣传图尺寸：**440x280 像素**（`promo_small.png`）。
    *   大宣传图尺寸：**1400x560 像素**（`promo_marquee.png`）。

---

## 🔒 步骤 6：配置“隐私权实务” (Privacy & Data Security)

这是最容易被卡审核的环节，请按照以下标准逐一勾选与声明：

1.  **单功能声明 (Single-Purpose Declaration)**：
    *   用一句简短明确的英文陈述该插件的单一目的（Single Purpose）。
    *   *模板句式*：`"[Extension Name] serves a single purpose: to assist users in [main feature description] on web pages."`
2.  **权限合理性解释 (Permission Justifications)**：
    *   对 `permissions` 和 `host_permissions` 里声明的每一项敏感权限，都必须在输入框里用一两句英文给出**正当合理的业务解释**。
    *   *常用解释模板*：
        *   **`storage`**：`"Required to persist user configuration preferences locally within the browser."`
        *   **`declarativeNetRequest` / `webNavigation`**：`"Required to intercept and redirect requests to provide offline rendering/optimizations."`
        *   **`<all_urls>` / 主机权限**：`"Required to inject the content script onto web pages to scan and interact with DOM elements locally based on user settings."`
3.  **数据收集声明 (Data Usage Disclosures)**：
    *   如果数据都在本地运行且不向服务器上传，务必勾选 **“不收集任何用户数据” (No User Data Collected)**，这能使您的审核异常顺利。
4.  **隐私政策网址 (Privacy Policy URL)**：
    *   粘贴您部署好的隐私政策网址链接。

---

## 🚀 步骤 7：提交审核 (Submit for Review)

1.  确认商品信息页没有红色星号的漏填项。
2.  点击右上角 **“提交审核” (Submit for Review)**。
3.  **审核时间预测**：
    *   **极速审核（无敏感主机权限，仅 `activeTab`）**：通常为 **数小时至 24 小时**。
    *   **深度审核（含 `<all_urls>` 广域主机权限）**：通常为 **2 至 7 个工作日**。
4.  审核通过后，您将收到 Google 的邮件通知，插件即刻自动全球上架！
