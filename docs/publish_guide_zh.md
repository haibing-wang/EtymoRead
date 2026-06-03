# Chrome 插件发布指南 (Publishing Guide)

本手册将一步步指导您如何将 **EtymoRead** 上架发布到 Google Chrome Web Store（Chrome 应用商店）。

---

## 🚀 步骤 1：打包发布安装文件 (.zip)

WXT 框架已经内置了打包压缩脚本。请在项目根目录下打开终端，并运行以下命令：

```bash
pnpm run zip
```

**运行结果说明**：
*   该命令会首先在本地进行生产环境编译（等同于 `wxt build`）。
*   编译完成后，WXT 会自动将输出目录打包成一个 `.zip` 文件，通常生成在：
    `[项目根目录]/.output/chrome-mv3.zip`
*   **请妥善保管这个 `.output/chrome-mv3.zip` 文件**，这就是我们需要上传到 Chrome 开发者后台的包。

---

## 🔑 步骤 2：注册 Chrome 开发者账号

如果您还没有 Google 开发者账号，请按照以下步骤注册：

1.  访问 [Chrome 应用商店开发者控制台 (Chrome Developer Dashboard)](https://chrome.google.com/webstore/devconsole/)。
2.  使用您的 Google 账号（Gmail）登录。
3.  阅读并同意《开发者协议》。
4.  **支付注册费**：Google 官方会收取一次性的 **$5 美元** 注册费（需要使用支持外币的信用卡，如 Visa / MasterCard 进行支付）。支付完成后，您的账号即可获得发布插件的权限。

---

## 📦 步骤 3：上传插件并创建商品项

1.  进入开发者后台，点击右上角的 **“添加新商品” (New Item)** 按钮。
2.  在弹出的上传窗口中，拖入刚才生成的 **`.output/chrome-mv3.zip`** 压缩包。
3.  系统会自动解析包内的 `manifest.json`，并自动生成草稿项，随后引导您进入详情配置页面。

---

## 📝 步骤 4：填写商店详情信息 (Store Listing)

请使用我们在 [chrome_store_assets_en.md](file:///Users/wanghaibing/code/chrome/EtymoRead/docs/chrome_store_assets_en.md) 中为您准备好的英文文案直接复制填写：

1.  **商品名称 (Product Title)**：复制 `EtymoRead: AI Etymology Reading Assistant`。
2.  **简介 (Short Description)**：复制 150 字符以内的简短介绍。
3.  **详细说明 (Detailed Description)**：直接整段粘贴我们准备好的富文本说明（包含功能介绍、隐私申明以及如何开启 Chrome 本地 AI 教程）。
4.  **类别 (Category)**：选择 **“教育” (Education)** 或 **“生产力” (Productivity)**。
5.  **语言 (Language)**：选择 **“英语” (English)**。
6.  **搜索关键字 (Keywords)**：输入 `etymology`, `vocabulary`, `root words`, `gemini nano`, `pdf reader`（最多 5 个）。

---

## 🎨 步骤 5：上传宣传物料 (Graphics Assets)

您需要准备并上传以下图片资产（推荐直接使用生成的 `logo.png` 进行裁剪或设计）：

1.  **商店图标 (Store Icon)**：
    *   尺寸：**128x128 像素** (PNG 格式)。
    *   直接上传我们为您在 `public/` 目录下生成好的 `icon-128.png` 即可。
2.  **屏幕截图 (Screenshots)**：
    *   至少需要上传 **1 张** 截图（最多 5 张）。
    *   尺寸：必须是 **1280x800 像素** 或 **640x400 像素**。
    *   *建议*：分别截取一张**网页段落高亮悬浮显示词根**的图片，和一张双击后**大模型流式拆解**的图片。
3.  **宣传瓷砖图 (Promo Tiles)**（可选，用于商店推荐展示）：
    *   小宣传瓷砖图尺寸：**440x280 像素**。

---

## 🔒 步骤 6：配置“隐私权实务声明” (Privacy & Data Security)

这是 Chrome 审核团队最为关注的环节。由于 EtymoRead 申请了 `<all_urls>`、`webNavigation` 等敏感权限，**必须严格按照以下指引勾选**：

1.  **单功能声明 (Single-Purpose Declaration)**：
    *   直接复制并粘贴我们在资产包 3.1 节为您准备的英文内容。
2.  **权限合理性解释 (Permission Justifications)**：
    *   根据控制台里的权限选项，依次复制并粘贴 `activeTab`, `storage`, `declarativeNetRequest`, `webNavigation` 的合理使用说明（详见资产包 3.2 节）。
3.  **数据收集声明 (Data Usage Disclosures)**：
    *   **重要**：勾选 **“不收集任何用户数据” (No User Data Collected)**，因为我们的所有处理和 AI 都在用户本地内存中运行，不向服务器发送任何数据。
4.  **隐私政策网址 (Privacy Policy URL)**：
    *   Chrome 要求必须提供一个隐私政策链接。您可以在 GitHub Pages 或您自己的网站上建立一个极简的静态 HTML 网页，并将我们在资产包第 4 节编写的 **EtymoRead Privacy Policy** 英文草案贴入该网址。

---

## 🚀 步骤 7：提交审核 (Submit for Review)

1.  仔细检查所有必填字段（红星标志）是否填写完整。
2.  点击右上角的 **“提交审核” (Submit for Review)**。
3.  **审核时间**：
    *   由于我们的插件不包含任何外部网络通信且声明不收集任何数据（100% 本地运算），在没有违规权限的前提下，审核速度通常较快。
    *   一般会在 **2 至 7 个工作日** 内通过审核并自动上架。
4.  通过审核后，您会收到 Google 的邮件通知，届时即可在应用商店搜索到您的插件并提供给全球用户下载！
