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
    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
      {bookmarks.map((bm, idx) => (
        <li key={idx}>
          {bm.children && bm.children.length > 0 ? (
            <CollapsibleSection title={bm.title} defaultOpen={false}>
              <BookmarkTree bookmarks={bm.children} onJump={onJump} />
            </CollapsibleSection>
          ) : (
            <span className="bookmark-title anchor-link" onClick={() => onJump(bm.page)}>{bm.title}</span>
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
  const [searchPage, setSearchPage] = useState(1);
  const [searchPageSize, setSearchPageSize] = useState(50);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchTotalResults, setSearchTotalResults] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageImg, setPageImg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('single'); // 'single' or 'continuous'
  const [totalPages, setTotalPages] = useState(0);
  // Handler functions
  const [allPages, setAllPages] = useState([]);

  useEffect(() => {
    // Fetch bookmarks and PDF info on mount
    axios.get('/api/bookmarks').then(res => {
      setBookmarks(res.data.bookmarks);
    });
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
    setError('');
    const fetchPage = async (retries = 3) => {
      try {
        const res = await axios.get(`/api/page/${pageNum}`, { responseType: 'blob' });
        setPageImg(URL.createObjectURL(res.data));
        setLoading(false);
        setError('');
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

  const fetchSearchResults = async (page = 1, pageSize = searchPageSize) => {
    const res = await axios.get(`/api/search?query=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`);
    setResults(res.data.results);
    setSearchPage(page);
    setSearchPageSize(pageSize);
    setSearchTotalPages(res.data.total_pages);
    setSearchTotalResults(res.data.total_results);
  };

  const handleSearch = async () => {
    fetchSearchResults(1, searchPageSize);
  };

  const handleSearchPageChange = (newPage) => {
    fetchSearchResults(newPage, searchPageSize);
  };

  const handleSearchPageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    setSearchPageSize(newSize);
    fetchSearchResults(1, newSize);
  };

  // Load all pages for continuous view
  const loadAllPages = async () => {
    if (allPages.length > 0) return;
    setLoading(true);
    setError('');
    const pages = [];
    const failedPages = [];
    const fetchPageWithRetry = async (pageNum, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await axios.get(`/api/page/${pageNum}`, {
            responseType: 'blob',
            timeout: 10000
          });
          return {
            pageNum,
            imageUrl: URL.createObjectURL(response.data)
          };
        } catch (error) {
          if (attempt === retries) {
            failedPages.push(pageNum);
            return {
              pageNum,
              imageUrl: null,
              error: `Failed to load page ${pageNum}`
            };
          }
          await new Promise(res => setTimeout(res, 1000));
        }
      }
    };
    try {
      const chunkSize = 50;
      const totalChunks = Math.ceil(totalPages / chunkSize);
      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const startPage = chunk * chunkSize + 1;
        const endPage = Math.min((chunk + 1) * chunkSize, totalPages);
        const chunkPromises = [];
        for (let i = startPage; i <= endPage; i++) {
          chunkPromises.push(fetchPageWithRetry(i));
        }
        try {
          const chunkPages = await Promise.all(chunkPromises);
          pages.push(...chunkPages);
          setAllPages([...pages]);
        } catch (chunkError) {
          console.error(`Error loading chunk ${chunk + 1}:`, chunkError);
        }
      }
      if (failedPages.length > 0) {
        setError(`Failed to load ${failedPages.length} page(s). Try refreshing or switching to Single Page mode.`);
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
        {/* Search Results - Now in a collapsible section with pagination and explanation */}
        {results.length > 0 && (
          <div style={{ marginBottom: 20, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #e0e0e0' }}>
            <h3 style={{ color: '#7c6f57', marginBottom: 12, fontSize: '1.1em' }}>Search Results</h3>
            <div style={{ marginBottom: 8, color: '#444', fontSize: '0.98em', background: '#fffbe6', padding: 8, borderRadius: 6 }}>
              <strong>How search works:</strong> Each result shows all lines on the page that contain your search terms. If a page matches, you may need to visually scan the page for context. Search terms are highlighted below.
            </div>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: '0.95em', color: '#666' }}>
                Showing {results.length} of {searchTotalResults} result{searchTotalResults !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '0.95em', color: '#666' }}>
                Page {searchPage} of {searchTotalPages}
              </span>
              <button onClick={() => handleSearchPageChange(searchPage - 1)} disabled={searchPage <= 1} style={{ padding: '4px 10px', borderRadius: 4 }}>Prev</button>
              <button onClick={() => handleSearchPageChange(searchPage + 1)} disabled={searchPage >= searchTotalPages} style={{ padding: '4px 10px', borderRadius: 4 }}>Next</button>
              <label style={{ marginLeft: 8 }}>Page Size:</label>
              <select value={searchPageSize} onChange={handleSearchPageSizeChange} style={{ padding: '2px 8px', borderRadius: 4 }}>
                {[25, 50, 100, 200, 500].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div style={{ maxHeight: 400, minWidth: 500, overflowY: 'auto' }}>
              {results.map((r, idx) => (
                <div key={idx} className="search-result" style={{ marginBottom: 8, padding: 8, backgroundColor: '#fff', borderRadius: 4 }}>
                  <span className="anchor-link" onClick={() => handleJump(r.page)} style={{ fontWeight: 600, color: '#1976d2' }}>
                    Page {r.page}
                  </span>
                  {r.lines && r.lines.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {r.lines.map((line, i) => (
                        <div key={i} style={{ color: '#333', fontStyle: 'italic', marginBottom: 2 }}>
                          <span dangerouslySetInnerHTML={{ __html: highlightTerms(line, search) }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {r.content && (
                    <div style={{ marginTop: 2, color: '#666', fontSize: '0.95em' }}>
                      <span dangerouslySetInnerHTML={{ __html: r.content }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                          {page.imageUrl ? (
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
                          ) : (
                            <div style={{ color: 'red', padding: 12, backgroundColor: '#fff2f2', borderRadius: 8 }}>
                              {page.error || `Loading page ${page.pageNum}...`}
                            </div>
                          )}
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
// ...existing code...
}

// Highlight search terms in a line (case-insensitive)
function highlightTerms(line, search) {
  if (!search) return line;
  // Remove surrounding quotes if present
  let cleanSearch = search.trim();
  if ((cleanSearch.startsWith('"') && cleanSearch.endsWith('"')) || (cleanSearch.startsWith("'") && cleanSearch.endsWith("'"))) {
    cleanSearch = cleanSearch.slice(1, -1);
  }
  // Split search into words, escape regex
  const terms = cleanSearch.split(/\s+/).filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (terms.length === 0) return line;
  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  return line.replace(regex, '<mark style="background: #ffe066; color: #222;">$1</mark>');
}

export default App;
