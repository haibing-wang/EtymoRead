// Background Service Worker
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  console.log('EtymoRead Background Service Worker initialized.');

  // 1. Sync declarativeNetRequest rules for http/https PDFs
  const syncPDFInterception = async (enabled: boolean) => {
    try {
      // Clear existing dynamic rules first
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map(r => r.id);
      
      if (enabled) {
        const viewerUrl = chrome.runtime.getURL('pdf-viewer.html');
        const rules: chrome.declarativeNetRequest.Rule[] = [
          {
            id: 1,
            priority: 1,
            action: {
              type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
              redirect: {
                // Redirect to our viewer and append the original URL as a parameter
                regexSubstitution: viewerUrl + '?pdf=' + '\\' + '0'
              }
            },
            condition: {
              // Regex to match URLs ending in .pdf (with optional query parameters)
              regexFilter: '^https?://[^/]+/.*\\.pdf(?:\\?.*)?$',
              resourceTypes: [
                chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
                chrome.declarativeNetRequest.ResourceType.SUB_FRAME
              ]
            }
          }
        ];

        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds,
          addRules: rules
        });
        console.log('declarativeNetRequest: PDF redirect rules enabled.');
      } else {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds,
          addRules: []
        });
        console.log('declarativeNetRequest: PDF redirect rules disabled.');
      }
    } catch (err) {
      console.error('Failed to configure declarativeNetRequest rules:', err);
    }
  };

  // 2. Setup webNavigation listener to intercept local file:// PDFs
  const setupFileInterception = () => {
    if (typeof chrome === 'undefined' || !chrome.webNavigation) {
      console.warn('chrome.webNavigation is not available. Local PDF file interception is disabled.');
      return;
    }
    chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
      // Only handle top-level frame navigation
      if (details.frameId !== 0) return;

      try {
        const urlStr = details.url;
        if (!urlStr.startsWith('file://')) return;

        // Check if PDF custom loading is enabled by user
        const { pdfEnabled } = await chrome.storage.local.get('pdfEnabled');
        if (!pdfEnabled) return;

        // Check if the file is a PDF
        const url = new URL(urlStr);
        const isPdf = url.pathname.toLowerCase().endsWith('.pdf');
        if (!isPdf) return;

        const viewerUrl = chrome.runtime.getURL('pdf-viewer.html');
        // Prevent infinite redirection loops
        if (urlStr.startsWith(viewerUrl)) return;

        // Redirect tab to custom viewer
        chrome.tabs.update(details.tabId, {
          url: `${viewerUrl}?pdf=${encodeURIComponent(urlStr)}`
        });
        
        console.log(`Intercepted local PDF: ${urlStr}, redirecting to custom viewer.`);
      } catch (err) {
        console.error('Error intercepting local PDF navigation:', err);
      }
    });
  };

  // 3. Listen for highlight count messages from content scripts and PDF viewers
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'updateHighlightCount' && sender.tab?.id) {
      const storageKey = `highlightCount_${sender.tab.id}`;
      chrome.storage.local.set({ [storageKey]: message.count });
    }
  });

  // 4. Clean up tab stats when a tab is closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    const storageKey = `highlightCount_${tabId}`;
    chrome.storage.local.remove([storageKey]);
  });

  // 5. Listen for storage changes to sync PDF interception rules dynamically
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.pdfEnabled) {
      syncPDFInterception(!!changes.pdfEnabled.newValue);
    }
  });

  // Run initializations
  chrome.runtime.onInstalled.addListener(async () => {
    const { pdfEnabled = false } = await chrome.storage.local.get('pdfEnabled');
    await syncPDFInterception(pdfEnabled);
  });

  // Also run on startup to ensure rules are active and match user preference
  const init = async () => {
    const { pdfEnabled = false } = await chrome.storage.local.get('pdfEnabled');
    await syncPDFInterception(pdfEnabled);
  };
  init();

  if (chrome.webNavigation) {
    setupFileInterception();
  } else {
    console.warn('chrome.webNavigation is not available. Local PDF file interception is disabled.');
  }
});
