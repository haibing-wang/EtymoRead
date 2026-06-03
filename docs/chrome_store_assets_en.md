# Chrome Web Store Assets & Registration Metadata

This document contains all the copy, descriptions, keyword metadata, and developer permission justifications required to register and publish **EtymoRead** on the Google Chrome Web Store under Manifest V3 guidelines.

---

## 1. Store Listing Basics

### 1.1 Store Title (Max 45 characters)
`EtymoRead: AI Etymology Reading Assistant`

### 1.2 Tagline / Summary (Max 150 characters)
`Read web pages and PDFs with instant offline etymology highlights and secure on-device Chrome AI word deconstructions.`

### 1.3 Categories
*   **Primary Category**: `Education` or `Productivity`
*   **Secondary Category**: `Developer Tools` or `Search Tools`

### 1.4 Keywords / Tags (Max 5 keywords)
`etymology, vocabulary, root words, gemini nano, pdf reader`

---

## 2. Store Listing Detailed Description

```text
Unlock the hidden structure of the English language while you read. 

EtymoRead is a lightweight, privacy-first Chrome extension that highlights prefixes, suffixes, and root words on any webpage or PDF document. By combining a comprehensive offline database of 600+ linguistic rules with Chrome's native on-device Gemini Nano AI (window.ai), EtymoRead helps you transition from mechanical memorization to logical understanding.

★ KEY FEATURES

1. Instant Visual Etymology (Hover)
Hover over any highlighted word. In 200ms, a premium card slides into view showing the word's prefixes, suffixes, origins (Latin, Greek, Germanic, etc.), definitions, and historical cognate word lists.

2. On-Device AI Deconstruction (Double-Click)
Double-click any unfamiliar word to call Gemini Nano. The local model performs context-aware word deconstruction, splitting the word and explaining its meaning relative to the surrounding sentence.

3. Professional PDF Viewer
Drag-and-drop local PDFs or intercept web PDF loads. Enjoy CJK (Chinese, Japanese, Korean) glyph rendering, trackpad-safe smooth mouse wheel page transitions, draggable scrollbars, and full keyboard navigation.

4. Smart Anti-Overmatching Filter
Our rule-based engine filters out stop words, short pronouns (like "the", "and", "with"), and requires strict affix-to-root coherence. This reduces noise so you only see high-value vocabulary roots.

5. 100% Local Processing & Zero Privacy Risks
EtymoRead runs completely offline. Local database checks and Gemini Nano AI queries execute on your personal device's memory. No tracking, no external API calls, and zero data leaves your machine.


★ QUICK START GUIDE FOR LOCAL AI (GEMINI NANO)

To use the AI double-click feature, make sure Chrome Local AI is active:
1. Ensure you are on Google Chrome 130+.
2. Navigate to `chrome://flags` in your browser.
3. Enable "Enables optimization guide on device model" (set to "Enabled BypassPrefRequirement").
4. Enable "Prompt API for Gemini Nano" (set to "Enabled").
5. Relaunch Chrome.
6. Open `chrome://components`, find "Optimization Guide On Device Model", click "Check for update", and wait for the model to download (status: Up-to-date).
7. Toggle "Enable Local AI" inside the EtymoRead settings popup!
```

---

## 3. Chrome Web Store Developer Console Declarations

### 3.1 Single-Purpose Declaration (Web Store Review Requirement)
> "EtymoRead serves a single purpose: to assist users in learning English vocabulary by providing offline etymological deconstructions and context-aware AI word breakdowns on web pages and PDF files."

### 3.2 Permission Justifications (Mandatory for MV3 reviews)

When submitting, Chrome requires you to justify why the extension requests specific permissions. Here is the copy to paste into the submission console:

*   **`storage`**:
    *   *Justification*: "Required to store user configuration preferences (such as enabling or disabling the Gemini Nano double-click triggers) and to cache word highlight metrics locally."
*   **`activeTab`**:
    *   *Justification*: "Required to access the current active page structure to scan text nodes and wrap vocabulary terms in highlight styles upon user activation."
*   **`declarativeNetRequest`**:
    *   *Justification*: "Required to redirect local `file://` or online web requests for PDF documents to the extension's dedicated, feature-rich HTML5 PDF viewer page."
*   **`webNavigation`**:
    *   *Justification*: "Required to intercept navigation events for `.pdf` URLs and initiate the declarative redirection to our native, CJK-compatible PDF renderer prior to standard rendering."

---

## 4. Privacy Policy & Data Usage Disclosures

Since the extension requests broad host permissions to highlight text on `<all_urls>`, a privacy policy is required. Use this copy for your privacy policy URL page:

```text
EtymoRead Privacy Policy
Last Updated: June 2026

1. Personal Information Collection
EtymoRead does not collect, record, transmit, or share any personal identity information, browsing history, webpage content, or reading logs.

2. On-Device Local Processing
All vocabulary scans, word deconstruction tasks, and linguistic lookups are executed 100% locally inside the user's browser sandbox. The Gemini Nano AI analysis utilizes Chrome's on-device Prompt API. No data is sent over the internet or transmitted to any external servers.

3. Third-Party Services
EtymoRead does not integrate with any third-party APIs, analytic platforms, tracking scripts, or advertising brokers.

4. Permission Usage
- declarativeNetRequest/webNavigation: Used solely to redirect PDF files to our offline rendering page.
- activeTab: Used to identify text nodes for root word highlights.
- storage: Used solely to persist user settings (such as AI toggle switch states).
```
