import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
// Access the globally loaded PDF.js library from index.html script tag
const pdfjsLib = (window as any).pdfjsLib;
import { highlightDOM } from '../../utils/highlighter';
import { initializeDatabase } from '../../utils/etymologyMatcher';
import { Tooltip, TooltipEventDetail } from '../../components/Tooltip';
import '../../assets/tooltip.css'; // Import tooltip styling

// Set PDF.js worker source from the local extension static path
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');

function PdfViewer() {
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.5);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [fileName, setFileName] = useState<string>('Document.pdf');
  const [highlightCount, setHighlightCount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  const [trackHeight, setTrackHeight] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const viewerContentRef = useRef<HTMLDivElement>(null);
  const scrollbarTrackRef = useRef<HTMLDivElement>(null);
  const isFlippingRef = useRef<boolean>(false);

  // 1. Get PDF URL from hash/query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('pdf');
    if (urlParam) {
      setPdfUrl(urlParam);
      
      // Extract file name
      try {
        const decoded = decodeURIComponent(urlParam);
        const name = decoded.substring(decoded.lastIndexOf('/') + 1).split('?')[0];
        setFileName(name || 'Document.pdf');
      } catch (e) {
        setFileName('Document.pdf');
      }
    } else {
      setError('No PDF file specified. Please append ?pdf=<url> to the URL.');
      setLoading(false);
    }
  }, []);

  // 2. Load PDF document
  useEffect(() => {
    if (!pdfUrl) return;

    setLoading(true);
    setError('');
    
    const cMapUrl = chrome.runtime.getURL('cmaps/');
    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl,
      cMapPacked: true
    });
    
    loadingTask.promise.then(
      (doc: any) => {
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setLoading(false);
      },
      (err: any) => {
        console.error('Error loading PDF document:', err);
        setError(`Failed to load PDF: ${err.message || err.toString()}`);
        setLoading(false);
      }
    );

    return () => {
      loadingTask.destroy();
    };
  }, [pdfUrl]);

  // 3. Render PDF page (canvas + textLayer)
  useEffect(() => {
    if (!pdfDoc) return;

    const renderPage = async () => {
      try {
        // Cancel ongoing render task if any
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        await initializeDatabase();

        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // Render canvas
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;

        // Render Text Layer
        const textLayer = textLayerRef.current;
        if (!textLayer) return;

        textLayer.innerHTML = '';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        
        // Render text divs using PDF.js v4 TextLayer class
        const textLayerInstance = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayer,
          viewport: viewport
        });

        await textLayerInstance.render();

        // 4. Run Highlighter on the rendered text layer!
        const count = highlightDOM(textLayer);
        setHighlightCount(count);

        // Update popup stats for this tab
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          chrome.runtime.sendMessage({ action: 'updateHighlightCount', count });
        }
      } catch (err: any) {
        if (err.name === 'RenderingCancelledException') {
          // Normal cancellation, do nothing
          return;
        }
        console.error('Error rendering page:', err);
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, scale]);

  // 5. Setup event delegation for tooltip hovering & AI dblclick
  useEffect(() => {
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

    const handleDblClick = (e: MouseEvent) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';
      
      // Match clean english words of length >= 3
      if (/^[a-zA-Z]{3,}$/.test(selectedText)) {
        // Query storage to check if AI is enabled
        chrome.storage.local.get(['aiEnabled'], (res) => {
          if (res.aiEnabled) {
            document.dispatchEvent(
              new CustomEvent<TooltipEventDetail>('etymoread-show-tooltip', {
                detail: {
                  word: selectedText,
                  type: 'ai',
                  x: e.clientX,
                  y: e.clientY
                }
              })
            );
          }
        });
      }
    };

    const textLayer = textLayerRef.current;
    if (textLayer) {
      textLayer.addEventListener('mouseover', handleMouseOver);
      textLayer.addEventListener('mouseout', handleMouseOut);
      textLayer.addEventListener('dblclick', handleDblClick);
    }

    return () => {
      if (hoverShowTimer) {
        clearTimeout(hoverShowTimer);
        hoverShowTimer = null;
      }
      if (textLayer) {
        textLayer.removeEventListener('mouseover', handleMouseOver);
        textLayer.removeEventListener('mouseout', handleMouseOut);
        textLayer.removeEventListener('dblclick', handleDblClick);
      }
    };
  }, [pdfDoc, pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(pageNum - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(pageNum + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.75));
  };

  // Measure scrollbar track height
  useEffect(() => {
    if (loading || error || numPages <= 1) return;
    
    const updateHeight = () => {
      if (scrollbarTrackRef.current) {
        setTrackHeight(scrollbarTrackRef.current.clientHeight);
      }
    };
    
    // Tiny delay to ensure layout is ready
    const timer = setTimeout(updateHeight, 150);
    
    window.addEventListener('resize', updateHeight);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateHeight);
    };
  }, [loading, error, numPages]);

  // Mouse wheel flipping listener
  useEffect(() => {
    const container = viewerContentRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!pdfDoc || isFlippingRef.current) return;

      const { scrollTop, clientHeight, scrollHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 15;
      const isAtTop = scrollTop <= 15;

      if (e.deltaY > 0 && isAtBottom) {
        if (pageNum < numPages) {
          e.preventDefault();
          isFlippingRef.current = true;
          setPageNum(prev => prev + 1);
          setTimeout(() => {
            container.scrollTop = 0;
            isFlippingRef.current = false;
          }, 600); // 600ms settling time for trackpad inertial scrolls
        }
      } else if (e.deltaY < 0 && isAtTop) {
        if (pageNum > 1) {
          e.preventDefault();
          isFlippingRef.current = true;
          setPageNum(prev => prev - 1);
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
            isFlippingRef.current = false;
          }, 600);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [pdfDoc, pageNum, numPages]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setPageNum(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setPageNum(numPages);
      } else if (e.key === ' ') {
        e.preventDefault();
        const container = viewerContentRef.current;
        if (container) {
          const { scrollTop, clientHeight, scrollHeight } = container;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 15;
          if (isAtBottom) {
            handleNextPage();
          } else {
            container.scrollBy({ top: clientHeight * 0.8, behavior: 'smooth' });
          }
        } else {
          handleNextPage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pdfDoc, pageNum, numPages]);

  // Click on scrollbar track to jump to page
  const handleScrollbarTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const track = scrollbarTrackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percentage = clickY / rect.height;
    const targetPage = Math.max(1, Math.min(numPages, Math.ceil(percentage * numPages)));
    setPageNum(targetPage);
  };

  // Drag scrollbar thumb
  const handleScrollbarThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    const track = scrollbarTrackRef.current;
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const trackHeight = rect.height;
    const trackTop = rect.top;
    
    setIsDragging(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const clickY = moveEvent.clientY - trackTop;
      const percentage = clickY / trackHeight;
      const targetPage = Math.max(1, Math.min(numPages, Math.ceil(percentage * numPages)));
      setPageNum(targetPage);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const minThumbHeight = 35;
  const computedThumbHeight = trackHeight ? Math.max(minThumbHeight, trackHeight / numPages) : 35;
  const computedThumbOffset = trackHeight && numPages > 1
    ? ((pageNum - 1) / (numPages - 1)) * (trackHeight - computedThumbHeight)
    : 0;

  return (
    <div className="viewer-container">
      {/* Top Toolbar */}
      <header className="viewer-toolbar">
        <div className="toolbar-left">
          <span className="toolbar-logo">📖</span>
          <span className="toolbar-title" title={fileName}>{fileName}</span>
        </div>

        <div className="toolbar-center">
          <button 
            className="toolbar-btn" 
            onClick={handlePrevPage} 
            disabled={pageNum <= 1 || loading}
          >
            ◀
          </button>
          <span className="page-indicator">
            Page {pageNum} of {numPages || '?'}
          </span>
          <button 
            className="toolbar-btn" 
            onClick={handleNextPage} 
            disabled={pageNum >= numPages || loading}
          >
            ▶
          </button>
        </div>

        <div className="toolbar-right">
          <span className="highlight-stats-badge">
            🏷️ Highlights: {highlightCount} words
          </span>
          <div className="zoom-controls">
            <button className="toolbar-btn" onClick={handleZoomOut} disabled={scale <= 0.75 || loading}>
              ➖
            </button>
            <span className="zoom-text">{Math.round(scale * 100)}%</span>
            <button className="toolbar-btn" onClick={handleZoomIn} disabled={scale >= 3.0 || loading}>
              ➕
            </button>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main ref={viewerContentRef} className="viewer-content">
        {loading && (
          <div className="viewer-loading">
            <div className="spinner"></div>
            <p>Loading and parsing PDF file...</p>
          </div>
        )}

        {error && (
          <div className="viewer-error-card">
            <h3>⚠️ Load Failed</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="pdf-page-wrapper" style={{ scale: '1' }}>
            <canvas ref={canvasRef} className="pdf-canvas"></canvas>
            <div ref={textLayerRef} className="pdf-text-layer textLayer"></div>
          </div>
        )}
      </main>

      {/* Custom Scrollbar Page Navigator */}
      {!loading && !error && numPages > 1 && (
        <div 
          className="pdf-custom-scrollbar-track" 
          ref={scrollbarTrackRef} 
          onClick={handleScrollbarTrackClick}
        >
          <div 
            className={`pdf-custom-scrollbar-thumb ${isDragging ? 'dragging' : ''}`}
            style={{
              height: `${computedThumbHeight}px`,
              transform: `translateY(${computedThumbOffset}px)`
            }}
            onMouseDown={handleScrollbarThumbMouseDown}
          />
        </div>
      )}

      {/* Overlay Tooltip */}
      <Tooltip />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PdfViewer />);
}
