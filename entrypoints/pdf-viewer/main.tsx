import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
const pdfjsLib = (window as any).pdfjsLib;
import { highlightDOM } from '../../utils/highlighter';
import { initializeDatabase } from '../../utils/etymologyMatcher';
import { Tooltip } from '../../components/Tooltip';
import '../../assets/tooltip.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

function PdfViewer() {
  /* ── State ────────────────────────────────────────────────────────────── */
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('Document.pdf');
  const [highlightCount, setHighlightCount] = useState<number>(0);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  /* ── DOM refs ─────────────────────────────────────────────────────────── */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const viewerContentRef = useRef<HTMLDivElement>(null);

  /* ── Stable refs for event handlers (avoid stale closures) ───────────── */
  const pageNumRef = useRef<number>(1);
  const numPagesRef = useRef<number>(0);
  const pdfDocRef = useRef<any>(null);
  const scaleRef = useRef<number>(1.0);
  // True while wheel/keyboard is in the middle of flipping a page
  const isFlippingRef = useRef<boolean>(false);
  // True after the first page has fully rendered — prevents wheel from
  // triggering while the canvas is still empty (scrollHeight == clientHeight)
  const renderCompleteRef = useRef<boolean>(false);

  useEffect(() => { pageNumRef.current = pageNum; renderCompleteRef.current = false; }, [pageNum]);
  useEffect(() => { numPagesRef.current = numPages; }, [numPages]);
  useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  /* ── 1. Extract PDF URL from query string ─────────────────────────────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('pdf');
    if (urlParam) {
      setPdfUrl(urlParam);
      try {
        const decoded = decodeURIComponent(urlParam);
        const name = decoded.substring(decoded.lastIndexOf('/') + 1).split('?')[0];
        setFileName(name || 'Document.pdf');
      } catch {
        setFileName('Document.pdf');
      }
    } else {
      setError('No PDF file specified. Please append ?pdf=<url> to the URL.');
      setLoading(false);
    }
  }, []);

  /* ── 2. Load PDF document + compute fit-to-width scale ───────────────── */
  useEffect(() => {
    if (!pdfUrl) return;
    setLoading(true);
    setError('');

    const cMapUrl = chrome.runtime.getURL('cmaps/');
    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, cMapUrl, cMapPacked: true });

    loadingTask.promise.then(
      async (doc: any) => {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);

        // Compute fit-to-width: get natural page width in PDF points, map to CSS px.
        // dpr is applied only at render time — scale here is a CSS-pixel ratio.
        try {
          const firstPage = await doc.getPage(1);
          const naturalVp = firstPage.getViewport({ scale: 1.0 });
          const container = viewerContentRef.current;
          if (container && container.clientWidth > 0) {
            const available = container.clientWidth - 48; // 24px padding × 2
            setScale(Math.max(0.5, available / naturalVp.width));
          }
        } catch { /* keep default scale */ }

        setLoading(false);
      },
      (err: any) => {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err.message || err.toString()}`);
        setLoading(false);
      }
    );

    return () => { loadingTask.destroy(); };
  }, [pdfUrl]);

  /* ── 3. Render current page ──────────────────────────────────────────── */
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        // Wait for any in-flight render to finish being cancelled
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          try { await renderTaskRef.current.promise; } catch { /* RenderingCancelledException expected */ }
          renderTaskRef.current = null;
        }
        if (cancelled) return;

        await initializeDatabase();
        if (cancelled) return;

        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        // Use dpr for pixel-perfect rendering on Retina; display at CSS size
        const dpr = window.devicePixelRatio || 1;
        const s = scale;
        const viewport = page.getViewport({ scale: s * dpr });
        const cssWidth = viewport.width / dpr;
        const cssHeight = viewport.height / dpr;

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const renderTask = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        if (cancelled) return;

        // Text layer uses CSS-scale viewport so positions align with displayed canvas
        const cssViewport = page.getViewport({ scale: s });
        const textLayer = textLayerRef.current;
        if (!textLayer || cancelled) return;

        textLayer.innerHTML = '';
        textLayer.style.width = `${cssWidth}px`;
        textLayer.style.height = `${cssHeight}px`;

        const textContent = await page.getTextContent();
        if (cancelled) return;

        const tl = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: cssViewport,
        });
        await tl.render();
        if (cancelled) return;

        const count = highlightDOM(textLayer);
        setHighlightCount(count);

        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          try { chrome.runtime.sendMessage({ action: 'updateHighlightCount', count }); } catch { /* ok */ }
        }

        // Mark render complete — wheel handler may now flip pages
        renderCompleteRef.current = true;

        // Reset scroll to top of new page (unless a wheel flip already did it)
        const container = viewerContentRef.current;
        if (container && !isFlippingRef.current) {
          container.scrollTop = 0;
        }

      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return;
        if (!cancelled) console.error('Error rendering page:', err);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pdfDoc, pageNum, scale]);

  /* ── 4. Tooltip event delegation (within text layer) ────────────────── */
  useEffect(() => {
    let hoverTimer: ReturnType<typeof setTimeout> | null = null;

    const onMouseOver = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (!el.classList.contains('etymoread-highlight')) return;
      const word = el.getAttribute('data-etymo-word') || el.textContent || '';
      const rect = el.getBoundingClientRect();
      hoverTimer && clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        document.dispatchEvent(new CustomEvent('etymoread-show-tooltip', {
          detail: { word, type: 'local', x: rect.left + rect.width / 2, y: rect.top, targetHeight: rect.height },
        }));
      }, 200);
    };

    const onMouseOut = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).classList.contains('etymoread-highlight')) return;
      hoverTimer && clearTimeout(hoverTimer);
      hoverTimer = null;
      document.dispatchEvent(new CustomEvent('etymoread-hide-tooltip'));
    };

    const onDblClick = (e: MouseEvent) => {
      const sel = window.getSelection()?.toString().trim() || '';
      if (!/^[a-zA-Z]{3,}$/.test(sel)) return;
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        try {
          chrome.storage.local.get(['aiEnabled'], (res: any) => {
            if (res?.aiEnabled) {
              document.dispatchEvent(new CustomEvent('etymoread-show-tooltip', {
                detail: { word: sel, type: 'ai', x: e.clientX, y: e.clientY },
              }));
            }
          });
        } catch { /* ok */ }
      }
    };

    const container = viewerContentRef.current;
    if (container) {
      container.addEventListener('mouseover', onMouseOver);
      container.addEventListener('mouseout', onMouseOut);
      container.addEventListener('dblclick', onDblClick);
    }
    return () => {
      hoverTimer && clearTimeout(hoverTimer);
      if (container) {
        container.removeEventListener('mouseover', onMouseOver);
        container.removeEventListener('mouseout', onMouseOut);
        container.removeEventListener('dblclick', onDblClick);
      }
    };
  }, []);

  /* ── 5. Mouse wheel: scroll within page, flip at boundary ───────────── */
  useEffect(() => {
    const container = viewerContentRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't flip while a flip is in progress
      if (isFlippingRef.current) { return; }
      // Don't flip before the page has rendered (canvas still empty → scrollHeight==clientHeight)
      if (!renderCompleteRef.current) { return; }
      // Don't flip if no PDF is loaded
      if (!pdfDocRef.current) { return; }

      const { scrollTop, clientHeight, scrollHeight } = container;
      const isScrollable = scrollHeight > clientHeight + 4;

      // --- Scrolling DOWN ---
      if (e.deltaY > 0) {
        const atBottom = !isScrollable || (scrollTop + clientHeight >= scrollHeight - 2);
        if (atBottom && pageNumRef.current < numPagesRef.current) {
          e.preventDefault();
          isFlippingRef.current = true;
          setPageNum(prev => prev + 1);
          // Give React time to start re-rendering, then reset scroll
          setTimeout(() => {
            container.scrollTop = 0;
            // Hold isFlipping a bit longer to absorb trackpad inertia
            setTimeout(() => { isFlippingRef.current = false; }, 500);
          }, 80);
        }
        // else: let the browser scroll normally within the page
        return;
      }

      // --- Scrolling UP ---
      if (e.deltaY < 0) {
        const atTop = !isScrollable || scrollTop <= 2;
        if (atTop && pageNumRef.current > 1) {
          e.preventDefault();
          isFlippingRef.current = true;
          setPageNum(prev => prev - 1);
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
            setTimeout(() => { isFlippingRef.current = false; }, 500);
          }, 80);
        }
        // else: let the browser scroll normally within the page
      }
    };

    // Register once — handler reads live refs, no need to re-register per page
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 6. Keyboard navigation ──────────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const container = viewerContentRef.current;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!container) break;
          const { scrollTop, clientHeight, scrollHeight } = container;
          if (scrollTop + clientHeight >= scrollHeight - 2 && pageNum < numPages) {
            // At bottom → flip
            setPageNum(p => p + 1);
          } else {
            container.scrollBy({ top: 120, behavior: 'smooth' });
          }
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!container) break;
          if (container.scrollTop <= 2 && pageNum > 1) {
            // At top → flip to previous
            setPageNum(p => p - 1);
          } else {
            container.scrollBy({ top: -120, behavior: 'smooth' });
          }
          break;
        }
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          if (pageNum < numPages) setPageNum(p => p + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          if (pageNum > 1) setPageNum(p => p - 1);
          break;
        case 'Home':
          e.preventDefault();
          setPageNum(1);
          break;
        case 'End':
          e.preventDefault();
          setPageNum(numPages);
          break;
        case ' ':
          e.preventDefault();
          if (container) {
            const { scrollTop, clientHeight, scrollHeight } = container;
            if (scrollTop + clientHeight >= scrollHeight - 2 && pageNum < numPages) {
              setPageNum(p => p + 1);
            } else {
              container.scrollBy({ top: clientHeight * 0.85, behavior: 'smooth' });
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNum, numPages]);

  /* ── Navigation helpers ──────────────────────────────────────────────── */
  const handleZoomIn = () => setScale(s => Math.min(s + 0.25, 3.0));
  const handleZoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  /* ── 7. Drag-to-pan (抓手) — using Pointer Events + setPointerCapture ──── */
  useEffect(() => {
    const container = viewerContentRef.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let scrollX = 0;
    let scrollY = 0;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      // Only left/touch primary pointer
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Let highlight spans handle their own click (tooltip)
      const target = e.target as HTMLElement;
      if (target.closest('.etymoread-highlight')) return;

      startX = e.clientX;
      startY = e.clientY;
      scrollX = container.scrollLeft;
      scrollY = container.scrollTop;
      dragging = false;

      // Capture all future pointer events for this pointer ID on this element.
      // This keeps pointermove firing even if the pointer leaves the element.
      try { container.setPointerCapture(e.pointerId); } catch { /* ok */ }

      // Prevent browser's native image/text drag
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!container.hasPointerCapture(e.pointerId)) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        dragging = true;
        setIsDragging(true);
        container.style.cursor = 'grabbing';
        container.style.userSelect = 'none';
      }

      if (dragging) {
        container.scrollLeft = scrollX - dx;
        container.scrollTop = scrollY - dy;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!container.hasPointerCapture(e.pointerId)) return;
      try { container.releasePointerCapture(e.pointerId); } catch { /* ok */ }

      if (dragging) {
        container.style.cursor = '';
        container.style.userSelect = '';
        dragging = false;
        setTimeout(() => setIsDragging(false), 50);
      }
    };

    // All three on the container — setPointerCapture routes subsequent events here
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="viewer-container">
      {/* Toolbar */}
      <header className="viewer-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-logo">📖</span>
          <span className="toolbar-title" title={fileName}>{fileName}</span>
        </div>

        <div className="toolbar-center">
          <button
            className="toolbar-btn"
            onClick={() => pageNum > 1 && setPageNum(p => p - 1)}
            disabled={pageNum <= 1 || loading}
          >◀</button>
          <span className="page-indicator">
            {loading ? 'Loading…' : `Page ${pageNum} of ${numPages || '?'}`}
          </span>
          <button
            className="toolbar-btn"
            onClick={() => pageNum < numPages && setPageNum(p => p + 1)}
            disabled={pageNum >= numPages || loading}
          >▶</button>
        </div>

        <div className="toolbar-right">
          <span className="highlight-stats-badge">
            🏷️ Highlights: {highlightCount} words
          </span>
          <div className="zoom-controls">
            <button className="toolbar-btn" onClick={handleZoomOut} disabled={scale <= 0.5 || loading}>➖</button>
            <span className="zoom-text">{Math.round(scale * 100)}%</span>
            <button className="toolbar-btn" onClick={handleZoomIn} disabled={scale >= 3.0 || loading}>➕</button>
          </div>
        </div>
      </header>

      {/* Scrollable page area — one page at a time */}
      <main
        ref={viewerContentRef}
        className={`viewer-content${isDragging ? ' dragging' : ''}`}
      >
        {loading && (
          <div className="viewer-loading">
            <div className="spinner" />
            <p>Loading and parsing PDF file…</p>
          </div>
        )}
        {error && (
          <div className="viewer-error-card">
            <h3>⚠️ Load Failed</h3>
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="pdf-page-wrapper">
            {/* draggable=false prevents Chrome native image drag from stealing pointermove */}
            <canvas ref={canvasRef} className="pdf-canvas" draggable={false} />
            <div ref={textLayerRef} className="pdf-text-layer textLayer" />
          </div>
        )}
      </main>

      <Tooltip />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PdfViewer />);
}
