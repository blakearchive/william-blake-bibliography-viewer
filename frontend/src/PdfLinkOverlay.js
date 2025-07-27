import React, { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Overlay clickable links on a PDF page image.
 * @param {number} pageNum - The PDF page number (1-based)
 * @param {number} pdfWidth - The width of the PDF page in points (from backend)
 * @param {number} pdfHeight - The height of the PDF page in points (from backend)
 * @param {number} renderedWidth - The width of the rendered image in px
 * @param {number} renderedHeight - The height of the rendered image in px
 * @param {function} onNavigate - (optional) callback for internal navigation (pageNum) 
 */
function PdfLinkOverlay({ pageNum, pdfWidth, pdfHeight, renderedWidth, renderedHeight, onNavigate }) {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    axios.get(`/api/page/${pageNum}/links`).then(res => {
      setLinks(res.data.links || []);
    });
  }, [pageNum]);

  // Scale PDF coordinates to rendered image size
  const scaleX = renderedWidth / pdfWidth;
  const scaleY = renderedHeight / pdfHeight;

  // Helper: is external link
  const isExternal = (link) => typeof link.uri === 'string' && /^https?:\/\//i.test(link.uri);

  // Helper: is internal link (page or dest)
  const isInternal = (link) => (typeof link.page === 'number' && link.page > 0) || (typeof link.dest === 'string' && link.dest);

  const handleClick = (e, link) => {
    if (isInternal(link) && onNavigate) {
      e.preventDefault();
      if (typeof link.page === 'number' && link.page > 0) {
        onNavigate(link.page);
      } else if (typeof link.dest === 'string' && link.dest) {
        onNavigate(link.dest); // let parent resolve dest to page
      }
    }
    // else let default for external
  };

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: renderedWidth,
      height: renderedHeight,
      pointerEvents: 'none', // let links handle pointer events only
      zIndex: 1000 // ensure always on top
    }}>
      {links.map((link, idx) => {
        const [x0, y0, x1, y1] = link.rect;
        const left = x0 * scaleX;
        const top = y0 * scaleY;
        const width = (x1 - x0) * scaleX;
        const height = (y1 - y0) * scaleY;
        let href = '#';
        let title = '';
        let target = undefined;
        let rel = undefined;
        if (isExternal(link)) {
          href = link.uri;
          title = link.uri;
          target = '_blank';
          rel = 'noopener noreferrer';
        } else if (isInternal(link)) {
          if (typeof link.page === 'number' && link.page > 0) {
            href = `#page-${link.page}`;
            title = `Go to page ${link.page}`;
          } else if (typeof link.dest === 'string' && link.dest) {
            href = `#dest-${link.dest}`;
            title = `Go to anchor ${link.dest}`;
          }
        } else if (typeof link.uri === 'string') {
          href = link.uri;
          title = link.uri;
        }
        return (
          <a
            key={idx}
            href={href}
            target={target}
            rel={rel}
            onClick={e => handleClick(e, link)}
            style={{
              position: 'absolute',
              left,
              top,
              width,
              height,
              background: 'transparent',
              pointerEvents: 'auto',
              zIndex: 2000,
              display: 'block',
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
            title={title}
          />
        );
      })}
    </div>
  );
}


/**
 * Overlay clickable links on a PDF page image.
 * @param {number} pageNum - The PDF page number (1-based)
 * @param {number} pdfWidth - The width of the PDF page in points (from backend)
 * @param {number} pdfHeight - The height of the PDF page in points (from backend)
 * @param {number} renderedWidth - The width of the rendered image in px
 * @param {number} renderedHeight - The height of the rendered image in px
 */

export default PdfLinkOverlay;
