import React, { useRef, useCallback, useEffect, useState } from 'react';
import { VariableSizeList as List } from 'react-window';
import SelectablePageViewer from './SelectablePageViewer';

// Virtualized list of pages for continuous view.
// Assumptions: `pages` is an array of { pageNum, imageUrl, error }
// We'll estimate item heights by measuring rendered image width -> height using a known aspect ratio.

export default function VirtualizedPageList({ pages, width = 960, onNavigate, containerHeight = 800 }) {
  const listRef = useRef(null);
  const itemHeights = useRef(new Map());

  // default aspect ratio based on server natural image size 1224 x 1584 => height / width ~ 1.294
  const defaultAspect = 1584 / 1224;

  const getItemSize = useCallback((index) => {
    const key = pages[index].pageNum;
    if (itemHeights.current.has(key)) return itemHeights.current.get(key);
    // estimate height using width and aspect
    const estimated = Math.round(Math.min(width, 900) * defaultAspect) + 80; // add padding for header + margins
    return estimated;
  }, [pages, width]);

  // When a rendered item reports its actual height, we store and force the list to recompute sizes
  const setItemHeight = useCallback((pageNum, height) => {
    const prev = itemHeights.current.get(pageNum);
    if (prev !== height) {
      itemHeights.current.set(pageNum, height);
      if (listRef.current) listRef.current.resetAfterIndex(0, true);
    }
  }, []);

  // Rendered row
  const Row = ({ index, style }) => {
    const page = pages[index];
    if (!page) return null;
    return (
      <div style={{ ...style, paddingBottom: 20, boxSizing: 'border-box' }}>
        <div style={{ fontSize: '1.1em', fontWeight: 600, color: '#1976d2', marginBottom: 8 }}>Page {page.pageNum}</div>
        {page.imageUrl ? (
          <MeasuredPageViewer
            pageNum={page.pageNum}
            imageUrl={page.imageUrl}
            onHeight={(h) => setItemHeight(page.pageNum, h)}
            onNavigate={onNavigate}
          />
        ) : (
          <div style={{ color: 'red', padding: 12, backgroundColor: '#fff2f2', borderRadius: 8 }}>{page.error || `Loading page ${page.pageNum}...`}</div>
        )}
      </div>
    );
  };

  return (
    <List
      height={containerHeight}
      itemCount={pages.length}
      itemSize={getItemSize}
      width={width}
      ref={listRef}
    >
      {Row}
    </List>
  );
}

// MeasuredPageViewer wraps SelectablePageViewer and reports its real height after layout
function MeasuredPageViewer({ pageNum, imageUrl, onHeight, onNavigate }) {
  const ref = useRef(null);
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = Math.round(rect.height + 12); // a bit of padding
      onHeight(h);
      setMeasured(true);
    };
    // measure after paint and after a short delay to account for decode/layout
    requestAnimationFrame(() => setTimeout(measure, 80));
    const t = setTimeout(measure, 400);
    return () => clearTimeout(t);
  }, [imageUrl, onHeight]);

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <SelectablePageViewer pageNum={pageNum} imageUrl={imageUrl} onNavigate={onNavigate} />
    </div>
  );
}
