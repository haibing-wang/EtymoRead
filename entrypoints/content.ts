// Content Script
import { defineContentScript } from 'wxt/utils/define-content-script';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { highlightDOM } from '../utils/highlighter';
import { initializeDatabase, setMatchingMode, matchLocalEtymology } from '../utils/etymologyMatcher';
import { Tooltip, TooltipEventDetail } from '../components/Tooltip';
import '../assets/tooltip.css'; // Imported stylesheet (WXT automatically bundles and injects it)

export default defineContentScript({
  matches: ['<all_urls>'],
  main(ctx: ContentScriptContext) {
    console.log('EtymoRead Content Script loaded.');

    let isInvalidated = false;

    // Helper to safely execute chrome extension APIs
    const safeChromeCall = (
      fn: (runtime: typeof chrome.runtime, storage: typeof chrome.storage) => void
    ) => {
      if (isInvalidated) return;
      if (typeof chrome === 'undefined') {
        isInvalidated = true;
        return;
      }
      const runtime = chrome.runtime;
      const storage = chrome.storage;
      if (!runtime || !storage) {
        isInvalidated = true;
        return;
      }
      try {
        fn(runtime, storage);
      } catch (err: any) {
        const msg = err?.message || '';
        if (
          msg.includes('Extension context invalidated') ||
          msg.includes('context invalidated') ||
          msg.includes('Cannot read properties of undefined') ||
          msg.includes('Cannot read property')
        ) {
          isInvalidated = true;
          return;
        }
        console.error(err);
      }
    };

    // 1. Initial scan and highlight
    const initialHighlight = async () => {
      try {
        await initializeDatabase();
        if (isInvalidated) return;
        const count = highlightDOM(document.body);
        safeChromeCall((runtime) => {
          runtime.sendMessage({ action: 'updateHighlightCount', count });
        });
      } catch (err: any) {
        if (err.message && err.message.includes('Extension context invalidated')) {
          isInvalidated = true;
          return;
        }
        console.error('Failed to run initial etymology highlight:', err);
      }
    };

    // Run when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initialHighlight();
      });
    } else {
      initialHighlight();
    }

    // 2. Set up dynamic mutation observer for single page apps / dynamic content
    let debounceTimer: NodeJS.Timeout | null = null;
    let isComposing = false;

    const triggerScan = () => {
      if (isInvalidated) return;
      if (isComposing) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isInvalidated) return;
        if (isComposing) return; // Safety check if composition started during debounce delay
        const count = highlightDOM(document.body);
        safeChromeCall((runtime) => {
          runtime.sendMessage({ action: 'updateHighlightCount', count });
        });
      }, 1500); // 1.5s debounce to avoid lag on fast rendering pages
    };

    const handleCompositionStart = () => {
      isComposing = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };

    const handleCompositionEnd = () => {
      isComposing = false;
      triggerScan();
    };

    const observer = new MutationObserver(() => {
      triggerScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 3. Inject React Tooltip container
    const tooltipRoot = document.createElement('div');
    tooltipRoot.id = 'etymoread-tooltip-root';
    document.body.appendChild(tooltipRoot);
    
    const reactRoot = ReactDOM.createRoot(tooltipRoot);
    reactRoot.render(React.createElement(Tooltip));

    // 4. Setup event delegation on document.body for highlight triggers
    let hoverShowTimer: NodeJS.Timeout | null = null;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('etymoread-highlight')) {
        const word = target.getAttribute('data-etymo-word') || target.textContent || '';
        const rect = target.getBoundingClientRect();
        
        if (hoverShowTimer) clearTimeout(hoverShowTimer);
        hoverShowTimer = setTimeout(() => {
          document.dispatchEvent(
            new CustomEvent<TooltipEventDetail>('etymoread-show-tooltip', {
              detail: {
                word,
                type: 'local',
                x: rect.left + rect.width / 2,
                y: rect.top,
                targetHeight: rect.height
              }
            })
          );
        }, 200);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('etymoread-highlight')) {
        if (hoverShowTimer) {
          clearTimeout(hoverShowTimer);
          hoverShowTimer = null;
        }
        document.dispatchEvent(new CustomEvent('etymoread-hide-tooltip'));
      }
    };

    // Handle double clicks on words
    const handleDblClick = (e: MouseEvent) => {
      if (isInvalidated) return;
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';
      
      // Match clean english words of length >= 3
      if (/^[a-zA-Z]{3,}$/.test(selectedText)) {
        // Step 1. Try static decomposition matching using 600 core roots (forceAlgorithm = true)
        const localResult = matchLocalEtymology(selectedText, true);

        if (localResult) {
          // Found local match! Display it directly
          document.dispatchEvent(
            new CustomEvent<TooltipEventDetail>('etymoread-show-tooltip', {
              detail: {
                word: selectedText,
                type: 'local',
                x: e.clientX,
                y: e.clientY,
                localData: localResult
              }
            })
          );
        } else {
          // Step 2. If no local match, check if AI is enabled/available for fallback
          safeChromeCall((runtime, storage) => {
            storage.local.get(['aiEnabled'], (res) => {
              if (isInvalidated) return;
              if (res && res.aiEnabled) {
                document.dispatchEvent(
                  new CustomEvent<TooltipEventDetail>('etymoread-show-tooltip', {
                    detail: {
                      word: selectedText,
                      type: 'ai',
                      x: e.clientX,
                      y: e.clientY,
                      context: getContextSentence(selection)
                    }
                  })
                );
              } else {
                // Show empty local result (user can see "No local root/affix matched")
                document.dispatchEvent(
                  new CustomEvent<TooltipEventDetail>('etymoread-show-tooltip', {
                    detail: {
                      word: selectedText,
                      type: 'local',
                      x: e.clientX,
                      y: e.clientY,
                      localData: null
                    }
                  })
                );
              }
            });
          });
        }
      }
    };

    // Watch for matchingMode changes from the popup settings to dynamically refresh highlights
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes.matchingMode) {
        const newMode = changes.matchingMode.newValue || 'dict';
        setMatchingMode(newMode);
        triggerScan();
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
    document.addEventListener('dblclick', handleDblClick);
    document.addEventListener('compositionstart', handleCompositionStart);
    document.addEventListener('compositionend', handleCompositionEnd);

    // Clean up on extension context invalidation
    ctx.onInvalidated(() => {
      isInvalidated = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (hoverShowTimer) {
        clearTimeout(hoverShowTimer);
        hoverShowTimer = null;
      }
      observer.disconnect();
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      document.removeEventListener('dblclick', handleDblClick);
      document.removeEventListener('compositionstart', handleCompositionStart);
      document.removeEventListener('compositionend', handleCompositionEnd);
      reactRoot.unmount();
      tooltipRoot.remove();
    });
  }
});

// Helper to extract the surrounding sentence for AI context
function getContextSentence(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0) return '';
  try {
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    const parent = container.parentElement;
    
    if (!parent) return '';
    
    // Truncate surrounding text to avoid overly large payload
    const fullText = parent.textContent || '';
    if (fullText.length > 250) {
      const wordIndex = fullText.indexOf(selection.toString());
      if (wordIndex !== -1) {
        const start = Math.max(0, wordIndex - 100);
        const end = Math.min(fullText.length, wordIndex + selection.toString().length + 100);
        return '...' + fullText.slice(start, end).trim() + '...';
      }
    }
    return fullText.trim();
  } catch (err) {
    return '';
  }
}
