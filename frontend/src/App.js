import React, { useState, useEffect } from 'react';

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        className="bookmark-title"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => setOpen(!open)}
      >
        <span>{open ? '▼' : '▶'}</span>
        {title}
      </div>
      {open && <div style={{ marginLeft: 12 }}>{children}</div>}
    </div>
  );
}

function PrefatoryMaterialTree({ onJump }) {
  const items = [
    { title: "User Note", page: 5 },
    { title: "Abbreviations", page: 6 },
    { title: "Acknowledgements", page: 9 },
    { title: "Introduction", page: 12 },
    { title: "Citations, Annotations, and Links", page: 19 },
    { title: "A Note on Specialized Terms for Researchers New to William Blake", page: 21 },
    { title: "Different Blake Journals", page: 23 }
  ];
  return (
    <CollapsibleSection title="Prefatory Material" defaultOpen={true}>
      <ul style={{ paddingLeft: 0, marginTop: 8 }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>
            <span className="bookmark-title anchor-link" onClick={() => onJump(item.page)}>{item.title}</span>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}
// Restore BookmarkTree component
function BookmarkTree({ bookmarks, onJump }) {
  if (!bookmarks || bookmarks.length === 0) return null;
  return (
    <ul>
      {bookmarks.map((bm, idx) => (
        <li key={idx}>
          <span className="bookmark-title anchor-link" onClick={() => onJump(bm.page)}>{bm.title}</span>
          {bm.children && bm.children.length > 0 && (
            <div className="bookmark-children">
              <BookmarkTree bookmarks={bm.children} onJump={onJump} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

import axios from 'axios';
import './blakeArchiveStyle.css';
import SelectablePageViewer from './SelectablePageViewer';

// Custom sidebar for Prefatory Material
// PrefatorySidebar removed as per user request

function App() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageImg, setPageImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'continuous'
  const [totalPages, setTotalPages] = useState(0);
  const [allPages, setAllPages] = useState([]);

  useEffect(() => {
    // Fetch bookmarks and PDF info on mount
    axios.get('/api/bookmarks').then(res => {
      setBookmarks(res.data.bookmarks);
    });
    
    // Fetch PDF info to get actual page count
    axios.get('/api/info').then(res => {
      setTotalPages(res.data.total_pages);
    }).catch(err => {
      console.error('Failed to fetch PDF info:', err);
      setTotalPages(1782); // Fallback to known page count
    });
  }, []);

  useEffect(() => {
    // Fetch page image when pageNum changes with retry logic
    setLoading(true);
    setError(''); // Clear any previous errors
    const fetchPage = async (retries = 3) => {
      try {
        const res = await axios.get(`/api/page/${pageNum}`, { responseType: 'blob' });
        setPageImg(URL.createObjectURL(res.data));
        setLoading(false);
        setError(''); // Clear error on success
      } catch (error) {
        if (retries > 0) {
          console.log(`Retrying page ${pageNum}, attempts left: ${retries}`);
          setError(`Connection issue loading page ${pageNum}, retrying... (${4 - retries}/3)`);
          setTimeout(() => fetchPage(retries - 1), 1000);
        } else {
          console.error(`Failed to load page ${pageNum}:`, error);
          setError(`Failed to load page ${pageNum}. Please check that the backend server is running.`);
          setLoading(false);
        }
      }
    };
    fetchPage();
  }, [pageNum]);

  const handleSearch = async () => {
    const res = await axios.get(`/api/search?query=${encodeURIComponent(search)}`);
    setResults(res.data.results);
  };

  // Load all pages for continuous view
  const loadAllPages = async () => {
    if (allPages.length > 0) return; // Already loaded
    
    setLoading(true);
    setError('');
    const pages = [];
    
    try {
      // Load pages in chunks of 50 for better performance
      const chunkSize = 50;
      const totalChunks = Math.ceil(totalPages / chunkSize);
      
      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const startPage = chunk * chunkSize + 1;
        const endPage = Math.min((chunk + 1) * chunkSize, totalPages);
        
        const chunkPromises = [];
        for (let i = startPage; i <= endPage; i++) {
          chunkPromises.push(
            axios.get(`/api/page/${i}`, {
              responseType: 'blob',
              timeout: 10000
            }).then(response => ({
              pageNum: i,
              imageUrl: URL.createObjectURL(response.data)
            }))
          );
        }
        
        try {
          const chunkPages = await Promise.all(chunkPromises);
          pages.push(...chunkPages);
          setAllPages([...pages]); // Update UI progressively
        } catch (chunkError) {
          console.error(`Error loading chunk ${chunk + 1}:`, chunkError);
          // Continue with next chunk instead of failing completely
        }
      }
      
    } catch (error) {
      console.error('Error loading pages:', error);
      setError('Failed to load pages for continuous view');
    } finally {
      setLoading(false);
    }
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (mode === 'continuous') {
      loadAllPages();
    }
  };

  const handleJump = (page) => {
    if (viewMode === 'single') {
      setPageNum(page);
    } else {
      // In continuous mode, scroll to the page
      const pageElement = document.getElementById(`page-${page}`);
      if (pageElement) {
        pageElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
    setResults([]);
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <PrefatoryMaterialTree onJump={handleJump} />
        {bookmarks.filter(bm => {
          const removeTitles = [
            "Contents0F",
            "Citations, Annotations, and Links 19",
            "User Note",
            "Abbreviations",
            "William Blake’s Works",
            "Secondary Texts and Notes",
            "Acknowledgments",
            "Preface",
            "Introduction",
            "Organization",
            "Citations, Annotations, and Links",
            "A Note on Specialized Terms for Researchers New to William Blake",
            "Different Blake Journals",
            "Document Bookmarks"
          ];
          return !removeTitles.includes(bm.title);
        }).map((bm, idx, arr) => (
          <CollapsibleSection key={bm.title} title={bm.title} defaultOpen={false}>
            {bm.children && bm.children.length > 0 ? (
              <BookmarkTree bookmarks={bm.children} onJump={handleJump} />
            ) : (
              <span className="bookmark-title anchor-link" onClick={() => handleJump(bm.page)}>{bm.title}</span>
            )}
          </CollapsibleSection>
        ))}
      </aside>
      <main className="viewer">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '1.8em', fontWeight: 700, color: '#1976d2', letterSpacing: '0.5px', lineHeight: 1.2 }}>
                A Selected Annotated Bibliography of William Blake and His Circle
              </div>
            </div>
          </div>
          
          {/* Search moved to top right */}
          <div className="search-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, marginTop: 30 }}>
            <div className="search-bar" style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search PDF..."
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd', minWidth: 200 }}
                onKeyPress={e => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} style={{ padding: '8px 16px' }}>Search</button>
            </div>
            {results.length > 0 && (
              <div style={{ fontSize: '0.9em', color: '#666' }}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>
        </div>
        
        {/* Search Results - Now in a collapsible section */}
        {results.length > 0 && (
          <div style={{ marginBottom: 20, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            <h3 style={{ color: '#7c6f57', marginBottom: 12, fontSize: '1.1em' }}>Search Results</h3>
            <div style={{ maxHeight: 400, minWidth: 500, overflowY: 'auto' }}>
              {results.map((r, idx) => (
                <div key={idx} className="search-result" style={{ marginBottom: 8, padding: 8, backgroundColor: '#fff', borderRadius: 4 }}>
                  <span className="anchor-link" onClick={() => handleJump(r.page)} style={{ fontWeight: 600, color: '#1976d2' }}>
                    Page {r.page}
                  </span>: <span dangerouslySetInnerHTML={{ __html: r.snippet }} />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* View Mode Controls */}
        <div className="view-mode-controls" style={{ marginBottom: 20, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <label style={{ marginRight: 20, fontWeight: 600, color: '#333' }}>View Mode:</label>
            <button 
              className={viewMode === 'single' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => handleViewModeChange('single')}
              style={{ marginRight: 10 }}
            >
              Single Page
            </button>
            <button 
              className={viewMode === 'continuous' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => handleViewModeChange('continuous')}
            >
              Continuous Scroll
            </button>
          </div>
          <button 
            onClick={() => handleJump(1)} 
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#1976d2', 
              color: 'white', 
              border: 'none', 
              borderRadius: 6, 
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9em'
            }}
            title="Go to page 1"
          >
            Home
          </button>
        </div>
        
        {error && (
          <div className="error-message" style={{ color: 'red', padding: 12, backgroundColor: '#fff2f2', borderRadius: 8, marginBottom: 20 }}>
            {error}
            <button 
              onClick={() => window.location.reload()} 
              style={{ marginLeft: 12, padding: '4px 8px', backgroundColor: '#1976d2', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Refresh Page
            </button>
          </div>
        )}
        
        {/* Main Page Content Area */}
        <div className="page-content" style={{ flexGrow: 1 }}>
        
        {/* Single Page View */}
        {viewMode === 'single' && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: 12, fontWeight: 600 }}>Page {pageNum}</h3>
            {loading ? (
              <div>Loading...</div>
            ) : (
              pageImg && (
                <SelectablePageViewer 
                  pageNum={pageNum}
                  imageUrl={pageImg}
                  style={{ 
                    maxWidth: '900px', 
                    width: '100%', 
                    boxShadow: '0 4px 24px #e0e0e0', 
                    border: '2px solid #1976d2', 
                    background: '#fff' 
                  }}
                />
              )
            )}
            <div className="nav-buttons">
              <button 
                onClick={() => setPageNum(pageNum > 1 ? pageNum - 1 : 1)}
                disabled={pageNum <= 1}
              >
                &lt; Prev
              </button>
              <span style={{ margin: '0 12px', color: '#666' }}>
                Page {pageNum} of {totalPages}
              </span>
              <button 
                onClick={() => setPageNum(pageNum < totalPages ? pageNum + 1 : totalPages)}
                disabled={pageNum >= totalPages}
              >
                Next &gt;
              </button>
            </div>
          </div>
        )}
        
        {/* Continuous View */}
        {viewMode === 'continuous' && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: 12, fontWeight: 600 }}>
              Continuous View {allPages.length > 0 && `(${allPages.length}/${totalPages} pages loaded)`}
            </h3>
            {loading && allPages.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <div>Loading pages for continuous view...</div>
                <div style={{ fontSize: '0.9em', color: '#666', marginTop: 8 }}>
                  This may take a moment...
                </div>
              </div>
            ) : (
              <div className="continuous-pages" style={{ maxHeight: '80vh', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16 }}>
                {allPages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                    Click "Continuous Scroll" to load all pages
                  </div>
                ) : (
                  <>
                    {allPages.map((page) => (
                      <div key={page.pageNum} id={`page-${page.pageNum}`} style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: '1.2em', fontWeight: 600, color: '#1976d2', marginBottom: 8 }}>
                          Page {page.pageNum}
                        </div>
                        <SelectablePageViewer 
                          pageNum={page.pageNum}
                          imageUrl={page.imageUrl}
                          style={{ 
                            maxWidth: '900px', 
                            width: '100%', 
                            boxShadow: '0 4px 24px #e0e0e0', 
                            border: '2px solid #1976d2', 
                            background: '#fff' 
                          }}
                        />
                      </div>
                    ))}
                    {loading && (
                      <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                        Loading more pages...
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}

export default App;
