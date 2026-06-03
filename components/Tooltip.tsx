import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { matchLocalEtymology, MatchResult } from '../utils/etymologyMatcher';
import { analyzeWord, checkAIAvailability } from '../hooks/useChromeAI';

export interface TooltipEventDetail {
  word: string;
  type: 'local' | 'ai';
  x: number;
  y: number;
  context?: string;
  targetHeight?: number;
}

export function Tooltip() {
  const [visible, setVisible] = useState(false);
  const [word, setWord] = useState('');
  const [type, setType] = useState<'local' | 'ai'>('local');
  const [coords, setCoords] = useState({ x: 0, y: 0, targetHeight: 0 });
  const [layoutCoords, setLayoutCoords] = useState({ left: 0, top: 0 });
  const [layoutReady, setLayoutReady] = useState(false);
  const [localData, setLocalData] = useState<MatchResult | null>(null);
  const [aiText, setAiText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiAvailable, setAiAvailable] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check AI availability on load
    checkAIAvailability().then(status => {
      setAiAvailable(status.available === 'yes' || status.available === 'readily');
    });

    const handleShow = (e: Event) => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      const detail = (e as CustomEvent<TooltipEventDetail>).detail;
      setWord(detail.word);
      setType(detail.type);
      const targetHeight = detail.targetHeight || 18;
      setCoords({ x: detail.x, y: detail.y, targetHeight });
      setError('');
      setLayoutReady(false); // Hide during recalculation to prevent jumping/ghosting

      if (detail.type === 'local') {
        const local = matchLocalEtymology(detail.word);
        setLocalData(local);
        setAiText('');
        setLoading(false);
      } else {
        // AI query
        setLocalData(null);
        setAiText('');
        setLoading(true);
        triggerAI(detail.word, detail.context);
      }

      setVisible(true);
    };

    const handleHide = () => {
      // Small delay on hide to allow moving cursor from word to tooltip
      hideTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setLoading(false);
      }, 300);
    };

    document.addEventListener('etymoread-show-tooltip', handleShow);
    document.addEventListener('etymoread-hide-tooltip', handleHide);

    return () => {
      document.removeEventListener('etymoread-show-tooltip', handleShow);
      document.removeEventListener('etymoread-hide-tooltip', handleHide);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return;

    const card = tooltipRef.current;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = coords.x - cardWidth / 2;
    // Keep horizontally inside viewport
    if (left < 10) left = 10;
    if (left + cardWidth > viewportWidth - 10) {
      left = viewportWidth - cardWidth - 10;
    }

    const targetHeight = coords.targetHeight || 18;
    
    // 1. Try to position it above the word by default (with a 20px gap)
    let top = coords.y - cardHeight - 20;

    // 2. If it overflows the top of the viewport, position it below the word (with a 20px gap)
    if (top < 10) {
      top = coords.y + targetHeight + 20;

      // 3. If it also overflows the bottom of the viewport, clamp the top to 10px
      if (top + cardHeight > viewportHeight - 10) {
        top = 10;
      }
    }

    setLayoutCoords({
      left: left + window.scrollX,
      top: top + window.scrollY,
    });
    setLayoutReady(true);
  }, [visible, coords, word, type, localData, aiText, error]);

  const triggerAI = async (targetWord: string, contextText?: string) => {
    try {
      setError('');
      setLoading(true);
      await analyzeWord(targetWord, contextText, (chunk) => {
        setAiText(chunk);
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'AI analysis failed. Please ensure Chrome 130+ is used and Gemini Nano is enabled.');
    } finally {
      setLoading(false);
    }
  };

  const handleMouseEnterTooltip = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleMouseLeaveTooltip = () => {
    setVisible(false);
  };

  const handleUpgradeToAI = () => {
    setType('ai');
    setAiText('');
    setLoading(true);
    triggerAI(word);
  };

  if (!visible) return null;

  const width = 300;

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'absolute',
        left: `${layoutCoords.left}px`,
        top: `${layoutCoords.top}px`,
        width: `${width}px`,
        zIndex: 2147483647,
        pointerEvents: 'auto',
        visibility: layoutReady ? 'visible' : 'hidden',
      }}
      onMouseEnter={handleMouseEnterTooltip}
      onMouseLeave={handleMouseLeaveTooltip}
    >
      <div className="etymoread-tooltip-card">
        <div className="etymoread-tooltip-header">
          <span className="etymoread-tooltip-word">{word}</span>
          {type === 'local' ? (
            <span className="etymoread-badge badge-local">Local Breakdown</span>
          ) : (
            <span className="etymoread-badge badge-ai">Gemini Nano AI</span>
          )}
        </div>

        <div className="etymoread-tooltip-body">
          {type === 'local' && localData && (
            <div className="etymoread-local-content">
              {localData.matchedPrefixes.length > 0 && (
                <div className="etymoread-row">
                  <span className="etymoread-tag tag-prefix">Prefix</span>
                  <span className="etymoread-text">
                    {localData.matchedPrefixes.map(p => `${p.affix} (${p.meaning})`).join(', ')}
                  </span>
                </div>
              )}

              {localData.matchedRoots.length > 0 && (
                <div className="etymoread-row">
                  <span className="etymoread-tag tag-root">Root</span>
                  <span className="etymoread-text">
                    {localData.matchedRoots.map(r => `${r.root} (${r.meaning}, ${r.origin})`).join(', ')}
                  </span>
                </div>
              )}

              {localData.matchedSuffixes.length > 0 && (
                <div className="etymoread-row">
                  <span className="etymoread-tag tag-suffix">Suffix</span>
                  <span className="etymoread-text">
                    {localData.matchedSuffixes.map(s => `${s.affix} (${s.meaning})`).join(', ')}
                  </span>
                </div>
              )}

              {localData.matchedRoots.length > 0 && localData.matchedRoots[0].examples && (
                <div className="etymoread-examples">
                  <div className="examples-title">Cognate Words:</div>
                  <div className="examples-text">{localData.matchedRoots[0].examples}</div>
                </div>
              )}

              <details className="etymoread-notice-details">
                <summary className="etymoread-notice-summary">⚠️ Notice on Over-matching</summary>
                <div className="etymoread-notice-content">
                  Local rule-based matching may occasionally over-match. Use AI deconstruction for precise, context-aware analysis.
                </div>
              </details>

              <button
                className="etymoread-upgrade-btn"
                onClick={handleUpgradeToAI}
                disabled={!aiAvailable}
              >
                {aiAvailable ? '✨ Upgrade to Local AI Analysis' : '✨ Local AI Analysis (Requires Chrome AI)'}
              </button>
            </div>
          )}

          {type === 'local' && !localData && (
            <div className="etymoread-empty">
              <p>No local root/affix matched.</p>
              <button
                className="etymoread-upgrade-btn"
                onClick={handleUpgradeToAI}
                disabled={!aiAvailable}
              >
                {aiAvailable ? '✨ Analyze with Local AI' : '✨ Local AI Analysis (Requires Chrome AI)'}
              </button>
            </div>
          )}

          {type === 'ai' && (
            <div className="etymoread-ai-content">
              {loading && !aiText && (
                <div className="etymoread-loading-spinner">
                  <div className="spinner"></div>
                  <span>AI is analyzing structure...</span>
                </div>
              )}
              {error && <div className="etymoread-error">{error}</div>}
              {aiText && (
                <div className="etymoread-ai-text">
                  {aiText}
                  {loading && <span className="typewriter-cursor">|</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
