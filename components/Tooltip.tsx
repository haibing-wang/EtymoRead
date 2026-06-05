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
  localData?: MatchResult | null;
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
  const [aiEnabled, setAiEnabled] = useState(false);
  const [etymonlineEnabled, setEtymonlineEnabled] = useState(true);
  const [vocabularyEnabled, setVocabularyEnabled] = useState(true);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check AI availability on load
    checkAIAvailability().then(status => {
      setAiAvailable(status.available === 'yes' || status.available === 'readily');
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['aiEnabled', 'etymonlineEnabled', 'vocabularyEnabled'], (res) => {
        setAiEnabled(!!res.aiEnabled);
        setEtymonlineEnabled(res.etymonlineEnabled !== false);
        setVocabularyEnabled(res.vocabularyEnabled !== false);
      });
    }

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
        const local = detail.localData !== undefined ? detail.localData : matchLocalEtymology(detail.word);
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

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local') {
        if (changes.aiEnabled) {
          setAiEnabled(!!changes.aiEnabled.newValue);
        }
        if (changes.etymonlineEnabled) {
          setEtymonlineEnabled(changes.etymonlineEnabled.newValue !== false);
        }
        if (changes.vocabularyEnabled) {
          setVocabularyEnabled(changes.vocabularyEnabled.newValue !== false);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    document.addEventListener('etymoread-show-tooltip', handleShow);
    document.addEventListener('etymoread-hide-tooltip', handleHide);

    return () => {
      document.removeEventListener('etymoread-show-tooltip', handleShow);
      document.removeEventListener('etymoread-hide-tooltip', handleHide);
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
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
          {type === 'ai' && (
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
                    {localData.matchedPrefixes.map((p, idx) => (
                      <React.Fragment key={p.id}>
                        {idx > 0 && ', '}
                        <span className="etymoread-affix-name">{p.affix}</span>
                        <span className="etymoread-meaning-part"> ({p.meaning})</span>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              )}

              {localData.matchedRoots.length > 0 && (
                <div className="etymoread-row">
                  <span className="etymoread-tag tag-root">Root</span>
                  <span className="etymoread-text">
                    {localData.matchedRoots.map((r, idx) => (
                      <React.Fragment key={r.id}>
                        {idx > 0 && ', '}
                        <span className="etymoread-affix-name">{r.root}</span>
                        <span className="etymoread-meaning-part"> ({r.meaning}{r.origin ? `, ${r.origin}` : ''})</span>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              )}

              {localData.matchedSuffixes.length > 0 && (
                <div className="etymoread-row">
                  <span className="etymoread-tag tag-suffix">Suffix</span>
                  <span className="etymoread-text">
                    {localData.matchedSuffixes.map((s, idx) => (
                      <React.Fragment key={s.id}>
                        {idx > 0 && ', '}
                        <span className="etymoread-affix-name">{s.affix}</span>
                        <span className="etymoread-meaning-part"> ({s.meaning})</span>
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              )}

              {localData.matchedRoots.length > 0 && localData.matchedRoots[0].examples && (
                <div className="etymoread-examples">
                  <div className="examples-title">Cognate Words:</div>
                  <div className="examples-text">{localData.matchedRoots[0].examples}</div>
                </div>
              )}

              {(vocabularyEnabled || etymonlineEnabled) && (
                <div className="etymoread-actions-row">
                  {vocabularyEnabled && (
                    <a
                      href={`https://www.vocabulary.com/dictionary/${encodeURIComponent(word.toLowerCase())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="etymoread-link-btn vocabulary-btn"
                    >
                      📖 Vocabulary
                    </a>
                  )}
                  {etymonlineEnabled && (
                    <a
                      href={`https://www.etymonline.com/word/${encodeURIComponent(word.toLowerCase())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="etymoread-link-btn etymonline-btn"
                    >
                      🔍 Etymonline
                    </a>
                  )}
                </div>
              )}

              {aiAvailable && aiEnabled && (
                <button
                  className="etymoread-upgrade-btn"
                  onClick={handleUpgradeToAI}
                >
                  ✨ Upgrade to Local AI Analysis
                </button>
              )}
            </div>
          )}

          {type === 'local' && !localData && (
            <div className="etymoread-empty">
              <p>No local root/affix matched.</p>
              {(vocabularyEnabled || etymonlineEnabled) && (
                <div className="etymoread-actions-row" style={{ marginTop: '8px' }}>
                  {vocabularyEnabled && (
                    <a
                      href={`https://www.vocabulary.com/dictionary/${encodeURIComponent(word.toLowerCase())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="etymoread-link-btn vocabulary-btn"
                    >
                      📖 Vocabulary
                    </a>
                  )}
                  {etymonlineEnabled && (
                    <a
                      href={`https://www.etymonline.com/word/${encodeURIComponent(word.toLowerCase())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="etymoread-link-btn etymonline-btn"
                    >
                      🔍 Etymonline
                    </a>
                  )}
                </div>
              )}
              {aiAvailable && aiEnabled && (
                <button
                  className="etymoread-upgrade-btn"
                  onClick={handleUpgradeToAI}
                >
                  ✨ Analyze with Local AI
                </button>
              )}
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
