import { matchLocalEtymology } from './etymologyMatcher';

// Tags we should completely ignore when scanning for text nodes
const IGNORED_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'TEXTAREA',
  'CODE',
  'INPUT',
  'BUTTON',
  'SELECT',
  'OPTION',
  'HEAD',
  'SVG',
  'PATH',
  'PRE'
]);

/**
 * Walks the DOM tree under the root element, finds matching words, 
 * and wraps them in a highlight span.
 * Returns the total number of words highlighted.
 */
export function highlightDOM(root: Node): number {
  if (!root) return 0;

  const textNodes: Text[] = [];
  
  // 1. Collect all valid text nodes
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (IGNORED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        
        // Skip nodes that are already part of our highlight or inside the tooltip container
        if (parent.classList.contains('etymoread-highlight') || 
            parent.closest('#etymoread-tooltip-root')) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only accept nodes with actual letters
        if (!/[a-zA-Z]/.test(node.textContent || '')) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  let highlightCount = 0;

  // 2. Process collected text nodes
  textNodes.forEach(node => {
    const text = node.textContent || '';
    // Match standard English words of length >= 3
    const wordRegex = /\b[a-zA-Z]{3,}\b/g;
    let match;
    const segments: { start: number; end: number; word: string }[] = [];

    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      const hasEtymology = matchLocalEtymology(word);
      if (hasEtymology) {
        segments.push({
          start: match.index,
          end: wordRegex.lastIndex,
          word
        });
      }
    }

    if (segments.length === 0) return;

    // Replace the text node with highlight spans in-place
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    segments.forEach(seg => {
      // Append text before the word
      if (seg.start > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, seg.start)));
      }

      // Create the highlight span
      const span = document.createElement('span');
      span.className = 'etymoread-highlight';
      span.setAttribute('data-etymo-word', seg.word);
      span.textContent = text.slice(seg.start, seg.end);
      
      fragment.appendChild(span);
      highlightCount++;
      lastIndex = seg.end;
    });

    // Append remaining text after the last match
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // Replace original node
    if (node.parentNode) {
      node.parentNode.replaceChild(fragment, node);
    }
  });

  return highlightCount;
}
