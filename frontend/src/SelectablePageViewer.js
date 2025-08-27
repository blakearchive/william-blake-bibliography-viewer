import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import PdfLinkOverlay from './PdfLinkOverlay';

// Accept onNavigate prop for internal PDF navigation
const SelectablePageViewer = ({ pageNum, imageUrl, style, onNavigate, highlightQuery = '' }) => {
  // highlightQuery: optional search term to visually highlight on load and auto-scroll to
  // Note: prop destructuring below will accept highlightQuery if provided
  // Handler for internal navigation (page or anchor)
  const handleNavigate = (target) => {
    if (typeof target === 'number') {
      // Go to page number
      if (onNavigate) onNavigate(target);
    } else if (typeof target === 'string') {
      // Go to anchor (dest)
      if (onNavigate) onNavigate(target);
    }
  };
  const [textBlocks, setTextBlocks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const imageFetchControllerRef = useRef(null);
  const createdLocalObjectUrlRef = useRef(null);
  const [selectionRect, setSelectionRect] = useState(null);
  const tempHighlightRef = useRef(null);
  const highlightDebounceRef = useRef(null);

  // Highlight and auto-scroll to first match when highlightQuery or textBlocks changes
  useEffect(() => {
    // clear any previous highlights
    const clearHighlights = () => {
      try {
        const prev = tempHighlightRef.current || [];
        prev.forEach(el => {
          try { if (el && el.parentElement) el.parentElement.removeChild(el); } catch (e) {}
        });
      } catch (e) {}
      tempHighlightRef.current = [];
    };

    if (!highlightQuery) {
      clearHighlights();
      return;
    }

    // don't attempt to create highlights until we have textBlocks and the image has a measured size
    if (!textBlocks || !imageSize || !imageSize.width) {
      // wait for both textBlocks and imageSize to be available
      return;
    }

    // Debounced highlight work: wait briefly to avoid thrashing and ensure layout has settled
    if (highlightDebounceRef.current) {
      clearTimeout(highlightDebounceRef.current);
      highlightDebounceRef.current = null;
    }

    const doHighlight = () => {
      // build a case-insensitive regex for the query (phrase or terms)
      const rawQ = highlightQuery.trim();
      if (!rawQ) { clearHighlights(); return; }

      // If the user wrapped the query in quotes, treat the quoted content as an exact phrase
      // (this preserves short/stop words inside the phrase). Otherwise, if the query is a
      // single alphanumeric token we prefer whole-word matching; otherwise use a substring match.
      let pattern;
      const quotedMatch = rawQ.match(/^"(.*)"$|^'(.*)'$/);
      if (quotedMatch) {
        const phrase = quotedMatch[1] || quotedMatch[2] || '';
        try { pattern = phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); } catch (e) { pattern = phrase; }
      } else {
        // Escape the raw query for safe regex construction
        let escaped;
        try { escaped = rawQ.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'); } catch (e) { escaped = rawQ; }
        const singleWord = /^[A-Za-z0-9]+$/.test(rawQ);
        pattern = singleWord ? `\\b${escaped}\\b` : escaped;
      }
      const regexGlobal = new RegExp(pattern, 'gi');

      // find matching span elements inside our selectable overlay and create small absolute highlight rects
      const container = containerRef.current;
      if (!container) return;
      const created = [];
      try {
        const spans = container.querySelectorAll('.selectable-text-span');
        spans.forEach(sp => {
          try {
            const raw = (sp.getAttribute('data-text') || sp.textContent || '');
            if (!raw) return;
            let m;
            while ((m = regexGlobal.exec(raw)) !== null) {
              const matchText = m[0];
              const idx = m.index;
              // measure span dimensions and compute fractional positions
              const spanRect = sp.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const relLeft = spanRect.left - containerRect.left;
              const relTop = spanRect.top - containerRect.top;
              const spanW = spanRect.width || 1;
              const spanH = spanRect.height || 16;
              const fracStart = idx / Math.max(1, raw.length);
              const fracLen = matchText.length / Math.max(1, raw.length);
              const leftPx = Math.round(relLeft + spanW * fracStart);
              const widthPx = Math.max(6, Math.round(spanW * fracLen));
              const topPx = Math.round(relTop);
              const heightPx = Math.max(12, Math.round(spanH));
              // create highlight element
              const el = document.createElement('div');
              el.className = 'selectable-search-rect';
              el.style.position = 'absolute';
              el.style.left = `${leftPx}px`;
              el.style.top = `${topPx}px`;
              el.style.width = `${widthPx}px`;
              el.style.height = `${heightPx}px`;
              el.style.pointerEvents = 'none';
              el.style.zIndex = 24;
              container.appendChild(el);
              created.push(el);
            }
          } catch (e) {}
        });
      } catch (e) {}

      tempHighlightRef.current = created;

      // scroll the nearest scrollable ancestor (or window) so first match is visible
      if (created.length > 0) {
        try {
          const first = created[0];

          function findScrollParent(el) {
            let p = el.parentElement;
            while (p) {
              const style = window.getComputedStyle(p);
              const overflowY = style.overflowY;
              if (overflowY === 'auto' || overflowY === 'scroll') return p;
              // if element scrolls because content is larger
              if (p.scrollHeight > p.clientHeight) return p;
              p = p.parentElement;
            }
            return null;
          }

          const scrollParent = findScrollParent(container) || document.scrollingElement || document.documentElement || window;
          const firstRect = first.getBoundingClientRect();

          if (scrollParent === window || scrollParent === document.scrollingElement || scrollParent === document.documentElement) {
            // scroll the window so the match is visible with some padding
            const desiredTop = window.scrollY + firstRect.top - Math.round(window.innerHeight * 0.18);
            window.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });
          } else {
            const parentRect = scrollParent.getBoundingClientRect();
            const offsetTop = firstRect.top - parentRect.top + scrollParent.scrollTop - 40; // 40px padding
            if (typeof scrollParent.scrollTo === 'function') {
              scrollParent.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
            } else {
              scrollParent.scrollTop = Math.max(0, offsetTop);
            }
          }
        } catch (e) {
          // ignore scroll errors
        }
      }
    };

  // Small debounce so we don't thrash layout during continuous updates
  highlightDebounceRef.current = setTimeout(doHighlight, 180);

    // cleanup function: clear debounce and highlights
    return () => {
      try { if (highlightDebounceRef.current) { clearTimeout(highlightDebounceRef.current); highlightDebounceRef.current = null; } } catch (e) {}
      clearHighlights();
    };
  }, [highlightQuery, textBlocks, imageSize && imageSize.width]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTextData = async () => {
      if (!pageNum) return;
      console.log(`Fetching text data for page ${pageNum}`);
      setLoading(true);
      try {
        const response = await axios.get(`/api/page/${pageNum}/text`, { signal: controller.signal });
        console.log(`Text data loaded for page ${pageNum}:`, response.data);
        setTextBlocks(response.data);
      } catch (error) {
        if (error && error.name === 'CanceledError') {
          // request aborted
          return;
        }
        console.error(`Error loading text for page ${pageNum}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchTextData();
    return () => {
      try { controller.abort(); } catch (e) {}
    };
  }, [pageNum]);

  // Cleanup for image fetches and any locally-created object URLs
  useEffect(() => {
    return () => {
      // abort any in-progress image retry fetch
      try {
        if (imageFetchControllerRef.current) imageFetchControllerRef.current.abort();
      } catch (e) {}
      // if we created a local object URL during a retry, revoke it
      try {
        if (createdLocalObjectUrlRef.current) {
          URL.revokeObjectURL(createdLocalObjectUrlRef.current);
          createdLocalObjectUrlRef.current = null;
        }
      } catch (e) {}
      // clear image src to avoid continuing browser fetch
      try { if (imageRef.current) imageRef.current.src = ''; } catch (e) {}
    };
  }, []);

  const handleImageLoad = async () => {
    if (imageRef.current) {
      // prefer decode() so we measure after the browser has decoded the image
      try { if (imageRef.current.decode) await imageRef.current.decode(); } catch (e) { /* ignore decode errors */ }

      // Use getBoundingClientRect to get the actual displayed width and height
      const rect = imageRef.current.getBoundingClientRect();
      let displayedWidth = Math.round(rect.width);
      // Use the actual rendered height from the rect to avoid forcing a computed height that can clip
      let displayedHeight = Math.round(rect.height);

      // Fallback: if the rect measured 0 (can happen when opened in a new tab or during layout quirks),
      // use the image's natural dimensions so we don't set an erroneously small min-height.
      const natW = imageRef.current.naturalWidth || 0;
      const natH = imageRef.current.naturalHeight || 0;

      // If bounding rect is tiny or zero, compute a reasonable displayedWidth based on parent/viewport
      const parent = containerRef.current && containerRef.current.parentElement;
      const parentAvailable = parent ? Math.round(parent.getBoundingClientRect().width) : window.innerWidth;
      if ((!displayedWidth || !displayedHeight) || displayedWidth < 100) {
        // Prefer parentAvailable but cap at natural width and the viewer's maxWidth (900px)
        const cap = Math.min(natW || 1224, 900, parentAvailable || window.innerWidth);
        displayedWidth = cap || displayedWidth || natW || 800;
        if (natW && natH) {
          displayedHeight = Math.round((displayedWidth / natW) * natH);
        } else if (!displayedHeight) {
          displayedHeight = Math.round(displayedWidth * 1.3); // fallback aspect
        }
      }

      // Defensive: make sure container won't clip via CSS overflow/height settings
      if (containerRef.current) {
        containerRef.current.style.overflow = 'visible';
        containerRef.current.style.height = 'auto';
      }

      setImageSize({ width: displayedWidth, height: displayedHeight });
      // Ensure container tall enough to show the image (prevents collapse/clipping on initial load/new tabs)
      if (containerRef.current) {
        containerRef.current.style.minHeight = `${displayedHeight}px`;
        // additionally set an explicit height briefly to avoid clipping from ancestor styles
        containerRef.current.style.height = `${displayedHeight}px`;
        const container = containerRef.current;
        try {
          // Only set a temporary minWidth if the container appears collapsed; don't force width permanently
          if (container.clientWidth === 0) {
            const tempMin = `${Math.min(displayedWidth, window.innerWidth)}px`;
            container.style.minWidth = tempMin;
            setTimeout(() => {
              try { if (container) container.style.minWidth = ''; } catch (e) { /* ignore */ }
            }, 400);
          }
          // clear the temporary explicit height after 1 second so normal responsive layout resumes
          setTimeout(() => {
            try { if (container) container.style.height = ''; } catch (e) { /* ignore */ }
          }, 1000);
        } catch (e) {
          console.warn('Could not apply temporary width/height fix for image container', e);
        }
      }

      // Ensure the image itself isn't visually obscured by overlays during layout races
      try {
        if (imageRef.current) {
          imageRef.current.style.position = imageRef.current.style.position || 'relative';
          imageRef.current.style.zIndex = imageRef.current.style.zIndex || '5';
          imageRef.current.style.maxHeight = 'none';
        }
        // clear temporary zIndex after a short delay to restore normal stacking
        setTimeout(() => {
          try { if (imageRef.current) imageRef.current.style.zIndex = ''; } catch (e) {}
        }, 1000);
      } catch (e) {
        // ignore
      }

      // Re-measure after paint to catch layout races (some browsers report correct natural sizes only after paint)
      // If the re-measured rect is much smaller than expected, fall back to natural-scaled dimensions.
      window.requestAnimationFrame(() => {
        try {
          if (!imageRef.current) return;
          const rect2 = imageRef.current.getBoundingClientRect();
          const measuredW = Math.round(rect2.width);
          const measuredH = Math.round(rect2.height);
          // If measurement still looks wrong (very small or tiny fraction of expected), recalc
          if (measuredH > 0 && measuredW > 0) {
            // If measurements differ significantly (e.g., measuredH < 60% of our computed), prefer natural-scaled
            if (measuredH < Math.max(100, Math.round((natH || 1584) * 0.6))) {
              // compute natural-scaled dims to parentAvailable or cap
              const capW = Math.min(natW || 1224, 900, parentAvailable || window.innerWidth);
              const newW = capW;
              const newH = natW && natH ? Math.round((newW / natW) * natH) : Math.round(newW * 1.3);
              setImageSize({ width: newW, height: newH });
              if (containerRef.current) containerRef.current.style.minHeight = `${newH}px`;
              // small reflow to let layout settle
              setTimeout(() => {
                try {
                  if (containerRef.current) containerRef.current.style.minWidth = '';
                } catch (e) {}
              }, 300);
            } else {
              // Use measured values (most likely correct)
              setImageSize({ width: measuredW, height: measuredH });
              if (containerRef.current) containerRef.current.style.minHeight = `${measuredH}px`;
            }
          }
        } catch (e) {
          // ignore
        }
      });

      // Stabilize: re-measure multiple times to catch late layout changes (helps vertical clipping)
      const stabilizeDisplay = (initialW, initialH) => {
        const attempts = [80, 240, 600];
        attempts.forEach((delay) => {
          setTimeout(() => {
            try {
              if (!imageRef.current) return;
              const r = imageRef.current.getBoundingClientRect();
              const w = Math.round(r.width);
              const h = Math.round(r.height);
              if (w > 50 && h > initialH * 0.5) {
                // if measured is reasonable, adopt it
                setImageSize({ width: w, height: h });
                if (containerRef.current) containerRef.current.style.minHeight = `${h}px`;
              } else if (h > 50 && initialH < h) {
                // measured larger than initial estimate, adopt larger
                setImageSize({ width: w || initialW, height: h });
                if (containerRef.current) containerRef.current.style.minHeight = `${h}px`;
              } else {
                // if still small, expand to natural-scaled cap
                const natW2 = imageRef.current.naturalWidth || 0;
                const natH2 = imageRef.current.naturalHeight || 0;
                const capW2 = Math.min(natW2 || 1224, 900, (containerRef.current && containerRef.current.parentElement) ? Math.round(containerRef.current.parentElement.getBoundingClientRect().width) : window.innerWidth);
                if (natW2 && natH2) {
                  const newH2 = Math.round((capW2 / natW2) * natH2);
                  setImageSize({ width: capW2, height: newH2 });
                  if (containerRef.current) containerRef.current.style.minHeight = `${newH2}px`;
                }
              }
            } catch (e) {
              // ignore
            }
          }, delay);
        });
      };
      try { stabilizeDisplay(displayedWidth, displayedHeight); } catch (e) {}

      // Debug log to help diagnose mis-sized pages
      // eslint-disable-next-line no-console
      console.log(`Image loaded page ${pageNum} displayed:${displayedWidth}x${displayedHeight}`);
    }
  };

  // Retry loading via XHR if the <img> fails to load (useful if object URL becomes invalid)
  const handleImageError = async () => {
    console.warn(`Image failed to load for page ${pageNum}, attempting XHR retry`);
    // Abort previous retry if any
    try { if (imageFetchControllerRef.current) imageFetchControllerRef.current.abort(); } catch (e) {}
    const controller = new AbortController();
    imageFetchControllerRef.current = controller;
    try {
      const res = await axios.get(`/api/page/${pageNum}`, { responseType: 'blob', timeout: 10000, signal: controller.signal });
      if (controller.signal.aborted) return;
      const newUrl = URL.createObjectURL(res.data);
      // track locally-created URL so we can revoke it on unmount
      try {
        if (createdLocalObjectUrlRef.current) {
          // revoke previous one
          URL.revokeObjectURL(createdLocalObjectUrlRef.current);
        }
      } catch (e) {}
      createdLocalObjectUrlRef.current = newUrl;
      if (imageRef.current) {
        imageRef.current.src = newUrl;
        // small delay to allow load event
        setTimeout(handleImageLoad, 100);
      }
    } catch (err) {
      if (err && err.name === 'CanceledError') {
        // aborted, nothing to do
        return;
      }
      console.error(`Retry failed for page ${pageNum}:`, err);
    } finally {
      // clear controller reference
      try { if (imageFetchControllerRef.current === controller) imageFetchControllerRef.current = null; } catch (e) {}
    }
  };

  // Recompute image size on window resize to keep overlays aligned when layout changes
  useEffect(() => {
    const onResize = () => {
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        let displayedWidth = Math.round(rect.width);
        let displayedHeight = Math.round(rect.height);

        // Fallback to natural size if browser reports 0 during a transient layout state
        const natW = imageRef.current.naturalWidth || 0;
        const natH = imageRef.current.naturalHeight || 0;
        if ((!displayedWidth || !displayedHeight) && natW && natH) {
          displayedWidth = natW;
          displayedHeight = natH;
        }

        setImageSize({ width: displayedWidth, height: displayedHeight });
        if (containerRef.current) {
          // update minHeight to avoid collapse
          containerRef.current.style.minHeight = `${displayedHeight}px`;
          // keep the container width in sync with the image to avoid transient clipping
          containerRef.current.style.width = `${displayedWidth}px`;
        }
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const calculateScaleFactor = () => {
    if (!textBlocks || !imageSize.width || !imageSize.height) return { scaleX: 1, scaleY: 1 };
    
    return {
      scaleX: imageSize.width / textBlocks.width,
      scaleY: imageSize.height / textBlocks.height
    };
  };

  const renderTextSpan = (span, blockIndex, lineIndex, spanIndex) => {
    const { scaleX, scaleY } = calculateScaleFactor();
    const [x0, y0, x1, y1] = span.bbox;
    
    const leftPx = Math.round(x0 * scaleX);
    const topPx = Math.round(y0 * scaleY);
    const widthPx = Math.max(Math.round((x1 - x0) * scaleX), 1);
    const heightPx = Math.max(Math.round((y1 - y0) * scaleY), 1);

    // Skip spans that fall completely outside the measured image bounds (prevents overflow/clipping issues)
    if (imageSize.width && imageSize.height) {
      if (leftPx > imageSize.width || topPx > imageSize.height) return null;
      if (leftPx + widthPx < 0 || topPx + heightPx < 0) return null;
    }

    const style = {
      position: 'absolute',
      left: `${leftPx}px`,
      top: `${topPx}px`,
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      fontSize: `${Math.max(Math.round(span.size * scaleY), 8)}px`,
      fontFamily: span.font || 'serif',
      fontWeight: span.flags & 16 ? 'bold' : 'normal',
      fontStyle: span.flags & 2 ? 'italic' : 'normal',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      cursor: 'text',
      userSelect: 'text',
      WebkitUserSelect: 'text',
      MozUserSelect: 'text',
      pointerEvents: 'auto',
      zIndex: 20,
      lineHeight: `${heightPx}px`,
      overflow: 'hidden',
      whiteSpace: 'pre',
      display: 'inline-block',
      verticalAlign: 'top',
      backgroundColor: 'transparent'
    };

    return (
      <div
        key={`${blockIndex}-${lineIndex}-${spanIndex}`}
        className="selectable-text-span"
        style={style}
        data-text={span.text} // For debugging
      >
        {span.text}
      </div>
    );
  };

  // Clear selection helpers
  const clearSelectionOverlay = () => {
    setSelectionRect(null);
  };

  // Monitor selection inside the selectable overlay and show a temporary highlight rect + copy button
  useEffect(() => {
    const onMouseUp = (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        clearSelectionOverlay();
        return;
      }
      // Only consider selections that are inside our containerRef
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      if (!containerRef.current || !containerRef.current.contains(common)) {
        // selection outside container
        return;
      }
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      // compute position relative to container
      const left = rect.left - containerRect.left;
      const top = rect.top - containerRect.top;
      setSelectionRect({ left, top, width: rect.width, height: rect.height, text: sel.toString() });
    };
    const onKeyUp = (e) => {
      if (e.key === 'Escape') clearSelectionOverlay();
    };
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const copySelectionToClipboard = async () => {
    if (!selectionRect || !selectionRect.text) return;
    try {
      await navigator.clipboard.writeText(selectionRect.text);
      // small visual feedback
      const prev = selectionRect;
      setSelectionRect({ ...prev, copied: true });
      setTimeout(() => clearSelectionOverlay(), 1200);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="page-container"
      style={{ 
        position: 'relative', 
        display: 'inline-block',
        ...style 
      }}
    >
      {/* PDF Image */}
      <img 
        ref={imageRef}
        src={imageUrl} 
        alt={`Page ${pageNum}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ 
          display: 'block',
          maxWidth: '900px',
          width: '100%',
          height: 'auto',
          userSelect: 'none' // Prevent image selection
        }}
        draggable={false}
      />

      {/* PDF Link Overlay */}
      {textBlocks && imageSize.width > 0 && (
        <PdfLinkOverlay
          pageNum={pageNum}
          pdfWidth={textBlocks.width}
          pdfHeight={textBlocks.height}
          renderedWidth={imageSize.width}
          renderedHeight={imageSize.height}
          onNavigate={handleNavigate}
        />
      )}

      {/* Selectable Text Overlay */}
      {textBlocks && imageSize.width > 0 && (
        <div 
          className="selectable-text-overlay"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: `${imageSize.width}px`, 
            height: `${imageSize.height}px`,
            pointerEvents: 'auto', // allow selection and click-through for child spans
            userSelect: 'text',
            WebkitUserSelect: 'text',
            zIndex: 15,
            overflow: 'hidden' // clip spans that mistakenly extend beyond image bounds
          }}
        >
          {textBlocks.blocks.map((block, blockIndex) => 
            block.lines.map((line, lineIndex) =>
              line.spans.map((span, spanIndex) =>
                span.text && span.text.trim() && renderTextSpan(span, blockIndex, lineIndex, spanIndex)
              )
            )
          )}
        </div>
      )}

      {/* Loading indicator for text */}
      {loading && (
        <div 
          style={{ 
            position: 'absolute', 
            top: 10, 
            right: 10, 
            background: 'rgba(25, 118, 210, 0.9)', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: 4, 
            fontSize: '12px',
            zIndex: 20
          }}
        >
          📄 Loading text...
        </div>
      )}

      {/* Text ready indicator */}
      {textBlocks && !loading && (
        <div 
          style={{ 
            position: 'absolute', 
            top: 10, 
            right: 10, 
            background: 'rgba(76, 175, 80, 0.9)', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: 4, 
            fontSize: '12px',
            zIndex: 20,
            opacity: 0.8
          }}
          title="Text is selectable and copyable"
        >
          📝 Text Ready
        </div>
      )}

      {/* Temporary selection highlight and copy button */}
      {selectionRect && (
        <>
          <div
            className="selectable-temp-highlight"
            style={{
              left: `${selectionRect.left}px`,
              top: `${selectionRect.top}px`,
              width: `${selectionRect.width}px`,
              height: `${selectionRect.height}px`
            }}
          />
          <button
            onClick={copySelectionToClipboard}
            style={{
              position: 'absolute',
              left: `${Math.min(selectionRect.left + selectionRect.width + 8, (imageSize.width || 800) - 90)}px`,
              top: `${Math.max(selectionRect.top, 8)}px`,
              zIndex: 30,
              padding: '6px 8px',
              borderRadius: 6,
              border: 'none',
              background: selectionRect.copied ? '#4caf50' : '#1976d2',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            {selectionRect.copied ? 'Copied' : 'Copy'}
          </button>
        </>
      )}
    </div>
  );
};

export default SelectablePageViewer;
