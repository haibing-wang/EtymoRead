import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { useChromeAI } from '../../hooks/useChromeAI';

function Popup() {
  const { availability, isEnabled, toggleAI, loading } = useChromeAI();
  const [highlightCount, setHighlightCount] = useState<number>(0);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [pdfEnabled, setPdfEnabled] = useState<boolean>(false);
  const [matchingMode, setMatchingMode] = useState<'dict' | 'algorithm'>('dict');
  const [etymonlineEnabled, setEtymonlineEnabled] = useState<boolean>(true);
  const [vocabularyEnabled, setVocabularyEnabled] = useState<boolean>(true);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab) {
          if (activeTab.url) {
            setCurrentUrl(new URL(activeTab.url).hostname || activeTab.url);
          }
          if (activeTab.id) {
            const storageKey = `highlightCount_${activeTab.id}`;
            chrome.storage.local.get([storageKey], (res) => {
              setHighlightCount(res[storageKey] || 0);
            });
          }
        }
      });
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['pdfEnabled', 'matchingMode', 'etymonlineEnabled', 'vocabularyEnabled'], (res) => {
        setPdfEnabled(!!res.pdfEnabled);
        setMatchingMode(res.matchingMode || 'dict');
        setEtymonlineEnabled(res.etymonlineEnabled !== false);
        setVocabularyEnabled(res.vocabularyEnabled !== false);
      });
    }
  }, []);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    toggleAI(e.target.checked);
  };

  const handlePdfToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setPdfEnabled(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ pdfEnabled: val });
    }
  };

  const handleMatchingModeToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked ? 'algorithm' : 'dict';
    setMatchingMode(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ matchingMode: val });
    }
  };

  const handleEtymonlineToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setEtymonlineEnabled(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ etymonlineEnabled: val });
    }
  };

  const handleVocabularyToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setVocabularyEnabled(val);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ vocabularyEnabled: val });
    }
  };

  const getAIStatusLabel = () => {
    switch (availability.available) {
      case 'yes':
      case 'readily':
        return {
          text: 'Local AI Ready (Gemini Nano)',
          class: 'status-ready',
          desc: 'Your browser fully supports the local Gemini Nano model.'
        };
      case 'after-download':
        return {
          text: 'Pending Model Download',
          class: 'status-download',
          desc: 'Please trigger model download in Chrome settings (enable in chrome://flags).'
        };
      case 'no':
      default:
        return {
          text: 'No Local AI Detected',
          class: 'status-unavailable',
          desc: 'Chrome local AI is not enabled. To enable: 1. Open chrome://flags 2. Set "Enables optimization guide on device model" to "Enabled BypassPrefRequirement". 3. Set "Prompt API for Gemini Nano" to "Enabled". 4. Relaunch Chrome.'
        };
    }
  };

  const aiStatus = getAIStatusLabel();

  return (
    <div className="popup-container">
      {/* Header */}
      <header className="popup-header">
        <div className="logo-section">
          <span className="logo-icon">📖</span>
          <h1 className="logo-title">EtymoRead</h1>
        </div>
        <p className="logo-subtitle">Etymology Reading Assistant</p>
      </header>

      {/* Main Content */}
      <main className="popup-main">
        {/* Active Stats Card */}
        <section className="stats-card">
          <div className="stats-header">
            <span className="stats-label">Current Page Analysis</span>
            <span className="stats-url" title={currentUrl}>
              {currentUrl ? (currentUrl.length > 20 ? currentUrl.slice(0, 18) + '...' : currentUrl) : 'Unknown Page'}
            </span>
          </div>
          <div className="stats-count-row">
            <span className="stats-number">{highlightCount}</span>
            <span className="stats-unit">words logically highlighted</span>
          </div>
        </section>

        {/* AI Switch Card */}
        <section className="config-card">
          <div className="config-row">
            <div className="config-info">
              <span className="config-title">✨ Enable Local AI on Double-Click</span>
              <span className="config-desc">Double-click unfamiliar or unmarked words to call the local LLM for breakdown</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={isEnabled}
                disabled={!(availability.available === 'yes' || availability.available === 'readily') || loading}
                onChange={handleToggle}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className={`ai-status-badge ${aiStatus.class}`}>
            <span className="dot"></span>
            <span className="badge-text">{aiStatus.text}</span>
          </div>
          <p className="ai-status-desc">{aiStatus.desc}</p>
        </section>

        {/* Matching Mode Card */}
        <section className="config-card">
          <div className="config-row">
            <div className="config-info">
              <span className="config-title">🚀 Aggressive Matching Mode</span>
              <span className="config-desc">Enable to use prefix/suffix algorithms for aggressive page-wide highlighting; disable for 100% precise dictionary highlights (recommended)</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={matchingMode === 'algorithm'}
                onChange={handleMatchingModeToggle}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>

        {/* Vocabulary.com Link Card */}
        <section className="config-card">
          <div className="config-row">
            <div className="config-info">
              <span className="config-title">📖 Quick Link to Vocabulary.com (Recommended)</span>
              <span className="config-desc">Display a direct link button in the tooltip to view smart contexts & word families on vocabulary.com</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={vocabularyEnabled}
                onChange={handleVocabularyToggle}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>

        {/* Etymonline Link Card */}
        <section className="config-card">
          <div className="config-row">
            <div className="config-info">
              <span className="config-title">🔍 Quick Link to Etymonline</span>
              <span className="config-desc">Display a direct link button in the tooltip to view the word's full origins on etymonline.com</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={etymonlineEnabled}
                onChange={handleEtymonlineToggle}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>

        {/* PDF Switch Card */}
        <section className="config-card">
          <div className="config-row">
            <div className="config-info">
              <span className="config-title">📄 Enable Custom PDF Viewer</span>
              <span className="config-desc">Automatically intercept and open online or local PDFs in our interactive etymology-aware viewer</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={pdfEnabled}
                onChange={handlePdfToggle}
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>

        {/* Short Guide Card */}
        <section className="guide-card">
          <h3 className="guide-title">💡 Instructions</h3>
          <ul className="guide-list">
            <li>
              <span className="action-tag">Hover</span>
              <span>Words matching root/affix patterns will instantly display details from the local offline database of 600+ entries.</span>
            </li>
            <li>
              <span className="action-tag">Double-click</span>
              <span>If AI is enabled, double-clicking any English word will call the local AI model for on-the-spot in-depth analysis.</span>
            </li>
            <li>
              <span className="action-tag">PDF Support</span>
              <span>Open online PDFs or drag local PDF files into the browser to render them in our viewer with the same highlight interactions.</span>
            </li>
          </ul>
        </section>
      </main>

      {/* Footer */}
      <footer className="popup-footer">
        <span>Version 1.0.0 • 100% Local Processing • 0 Privacy Risk</span>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<Popup />);
}
