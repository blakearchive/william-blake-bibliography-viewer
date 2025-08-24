import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import PdfLinkOverlay from './PdfLinkOverlay';

// Accept onNavigate prop for internal PDF navigation
const SelectablePageViewer = ({ pageNum, imageUrl, style, onNavigate }) => {
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
  const [selectionRect, setSelectionRect] = useState(null);
  const tempHighlightRef = useRef(null);

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
    try {
      const res = await axios.get(`/api/page/${pageNum}`, { responseType: 'blob', timeout: 10000 });
      const newUrl = URL.createObjectURL(res.data);
      if (imageRef.current) {
        imageRef.current.src = newUrl;
        // small delay to allow load event
        setTimeout(handleImageLoad, 100);
      }
    } catch (err) {
      console.error(`Retry failed for page ${pageNum}:`, err);
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
