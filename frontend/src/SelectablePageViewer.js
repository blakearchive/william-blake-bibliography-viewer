import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SelectablePageViewer = ({ pageNum, imageUrl, style }) => {
  const [textBlocks, setTextBlocks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const fetchTextData = async () => {
      if (!pageNum) return;
      
      console.log(`Fetching text data for page ${pageNum}`);
      setLoading(true);
      try {
        const response = await axios.get(`/api/page/${pageNum}/text`);
        console.log(`Text data loaded for page ${pageNum}:`, response.data);
        setTextBlocks(response.data);
      } catch (error) {
        console.error(`Error loading text for page ${pageNum}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchTextData();
  }, [pageNum]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      setImageSize({
        width: imageRef.current.offsetWidth,
        height: imageRef.current.offsetHeight
      });
    }
  };

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
    
    const style = {
      position: 'absolute',
      left: `${x0 * scaleX}px`,
      top: `${y0 * scaleY}px`,
      width: `${(x1 - x0) * scaleX}px`,
      height: `${(y1 - y0) * scaleY}px`,
      fontSize: `${Math.max(span.size * scaleY, 8)}px`, // Minimum font size
      fontFamily: span.font,
      fontWeight: span.flags & 16 ? 'bold' : 'normal', // Bold flag
      fontStyle: span.flags & 2 ? 'italic' : 'normal', // Italic flag
      color: 'rgba(0, 0, 0, 0.01)', // Nearly transparent but selectable
      cursor: 'text',
      userSelect: 'text',
      pointerEvents: 'all',
      zIndex: 10,
      lineHeight: `${(y1 - y0) * scaleY}px`,
      overflow: 'visible',
      whiteSpace: 'pre',
      display: 'flex',
      alignItems: 'center',
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
        style={{ 
          display: 'block',
          maxWidth: '100%',
          height: 'auto',
          userSelect: 'none' // Prevent image selection
        }}
        draggable={false}
      />
      
      {/* Selectable Text Overlay */}
      {textBlocks && imageSize.width > 0 && (
        <div 
          className="selectable-text-overlay"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          {textBlocks.blocks.map((block, blockIndex) => 
            block.lines.map((line, lineIndex) =>
              line.spans.map((span, spanIndex) =>
                span.text.trim() && renderTextSpan(span, blockIndex, lineIndex, spanIndex)
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
    </div>
  );
};

export default SelectablePageViewer;
