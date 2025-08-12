import React, { useState, useEffect } from 'react';

function CollapsibleSection({ title, children, defaultOpen = true, onTitleClick }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        className="bookmark-title"
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setOpen(!open)}
        >
          {open ? '▼' : '▶'}
        </span>
        {onTitleClick ? (
          <span
            className="anchor-link"
            style={{ cursor: 'pointer', flex: 1 }}
            onClick={e => {
              e.stopPropagation();
              onTitleClick();
            }}
          >
            {title}
          </span>
        ) : (
          <span style={{ flex: 1 }}>{title}</span>
        )}
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
// Helper to clean unwanted trailing number/letter patterns (e.g., 32F, 35FF, 39f, 12a, 123)
function cleanBookmarkTitle(title) {
  // Only remove trailing page codes (e.g., '39F', '35FF', '12a') at the end of the title, not numbers in parentheses or text
  // Examples: 'IV. Biographies39F (Including ...' => 'IV. Biographies (Including ...'
  return title.replace(/(\d+[a-zA-Z]{0,2})$/, '').replace(/\s{2,}/g, ' ').trim();
}

function BookmarkTree({ bookmarks, onJump }) {
  if (!bookmarks || bookmarks.length === 0) return null;
  return (
    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
      {bookmarks.map((bm, idx) => (
        <li key={idx}>
          {bm.children && bm.children.length > 0 ? (
            <CollapsibleSection
              title={cleanBookmarkTitle(bm.title)}
              defaultOpen={false}
              onTitleClick={bm.page ? () => onJump(bm.page) : undefined}
            >
              <BookmarkTree bookmarks={bm.children} onJump={onJump} />
            </CollapsibleSection>
          ) : (
            <span className="bookmark-title anchor-link" onClick={() => onJump(bm.page)}>{cleanBookmarkTitle(bm.title)}</span>
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
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchPageSize, setSearchPageSize] = useState(50);
  const [searchTotalPages, setSearchTotalPages] = useState(1);
  const [searchTotalResults, setSearchTotalResults] = useState(0);
  const [bookmarks, setBookmarks] = useState([]);
  // Read ?page=... from URL on load
  function getInitialPageNum() {
    const params = new URLSearchParams(window.location.search);
    const p = parseInt(params.get('page'), 10);
    return (p && !isNaN(p) && p > 0) ? p : 1;
  }
  const [pageNum, setPageNum] = useState(getInitialPageNum());
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
    await fetchSearchResults(1, searchPageSize);
    setSearchModalOpen(true);
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

  // Sidebar/bookmark links: go to actual page
  const handleJump = (page) => {
    window.open(`?page=${page}`, '_blank');
  };

  // Internal document links: add offset
  const handleInternalLink = (page) => {
    const correctedPage = page + 3;
    window.open(`?page=${correctedPage}`, '_blank');
  };

  return (
    <div className="app-container">
      {/* Search Results Modal */}
      {searchModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px #2222', padding: 32, minWidth: 600, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button style={{ position: 'absolute', top: 16, right: 16, fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setSearchModalOpen(false)}>&times;</button>
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
                  <span className="anchor-link" onClick={() => handleJump(r.page)} style={{ fontWeight: 600, color: '#1976d2', cursor: 'pointer' }}>
                    Page {r.page}
                  </span>
                  {/* Always show highlighted lines if present, otherwise highlight content */}
                  {r.lines && r.lines.length > 0 ? (
                    <div style={{ marginTop: 4 }}>
                      {r.lines.map((line, i) => (
                        <div key={i} style={{ color: '#333', fontStyle: 'italic', marginBottom: 2 }}>
                          <span dangerouslySetInnerHTML={{ __html: highlightTerms(line, search) }} />
                        </div>
                      ))}
                    </div>
                  ) : r.content && (
                    <div style={{ marginTop: 4, color: '#333', fontStyle: 'italic', marginBottom: 2 }}>
                      <span dangerouslySetInnerHTML={{ __html: highlightTerms(r.content, search) }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ...existing sidebar and main viewer code... */}
      <aside className="sidebar">
        <button
          style={{ margin: '12px 0', padding: '8px 16px', borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => handleJump(1)}
        >
          Return to Title Page/Home
        </button>
        <PrefatoryMaterialTree onJump={handleJump} />
        {(() => {
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
          const superscriptPattern = /^\d+[a-zA-Z]*f{1,2}$|^\d+[a-zA-Z]$|^\d+$/;
          const filtered = bookmarks.filter(bm => !removeTitles.includes(bm.title) && !superscriptPattern.test(bm.title.trim()));
          return filtered.map((bm, idx, arr) => {
            // Insert a blank line between Appendix B and Appendix C
            if (
              cleanBookmarkTitle(bm.title).toLowerCase().startsWith('appendix c') &&
              idx > 0 && cleanBookmarkTitle(arr[idx - 1].title).toLowerCase().startsWith('appendix b')
            ) {
              return [
                <div key={bm.title + '-spacer'} style={{ height: 16 }} />,
                <CollapsibleSection
                  key={bm.title}
                  title={cleanBookmarkTitle(bm.title)}
                  defaultOpen={false}
                  onTitleClick={bm.page ? () => handleJump(bm.page) : undefined}
                >
                  {bm.children && bm.children.length > 0 ? (
                    <BookmarkTree bookmarks={bm.children} onJump={handleJump} />
                  ) : (
                    <span className="bookmark-title anchor-link" onClick={() => handleJump(bm.page)}>{cleanBookmarkTitle(bm.title)}</span>
                  )}
                </CollapsibleSection>
              ];
            }
            return (
              <CollapsibleSection
                key={bm.title}
                title={cleanBookmarkTitle(bm.title)}
                defaultOpen={false}
                onTitleClick={bm.page ? () => handleJump(bm.page) : undefined}
              >
                {bm.children && bm.children.length > 0 ? (
                  <BookmarkTree bookmarks={bm.children} onJump={handleJump} />
                ) : (
                  <span className="bookmark-title anchor-link" onClick={() => handleJump(bm.page)}>{cleanBookmarkTitle(bm.title)}</span>
                )}
              </CollapsibleSection>
            );
          });
        })()}
      </aside>
      <main className="viewer">
        {/* ...existing header, search bar, and viewer code... */}
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
                    onNavigate={target => {
                      if (typeof target === 'number') {
                        handleInternalLink(target);
                      }
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
                              onNavigate={target => {
                                if (typeof target === 'number') {
                                  window.open(`?page=${target}`, '_blank');
                                }
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
  let cleanSearch = search.trim();
  const isQuoted =
    (cleanSearch.startsWith('"') && cleanSearch.endsWith('"')) ||
    (cleanSearch.startsWith("'") && cleanSearch.endsWith("'"));
  if (isQuoted) {
    cleanSearch = cleanSearch.slice(1, -1);
  }
  if (!cleanSearch) return line;

  // Helper: highlight text in a DOM node tree, preserving tags
  function highlightInNode(node, regex) {
    if (node.nodeType === 3) { // Text node
      const parts = node.data.split(regex);
      if (parts.length === 1) return node.data;
      let result = [];
      let match;
      let lastIndex = 0;
      regex.lastIndex = 0;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) result.push(parts[i]);
        if (i < parts.length - 1) {
          match = regex.exec(node.data.slice(lastIndex));
          if (match) {
            result.push(`<mark style="background: #ffe066; color: #222;">${match[0]}</mark>`);
            lastIndex += match.index + match[0].length;
          }
        }
      }
      return result.join('');
    } else if (node.nodeType === 1) { // Element node
      let html = '';
      for (let child of node.childNodes) {
        html += highlightInNode(child, regex);
      }
      return node.tagName === 'A'
        ? `<a href="${node.getAttribute('href')}"${node.getAttribute('target') ? ` target="${node.getAttribute('target')}"` : ''}>${html}</a>`
        : `<${node.tagName.toLowerCase()}${[...node.attributes].map(a => ` ${a.name}="${a.value}"`).join('')}>${html}</${node.tagName.toLowerCase()}>`;
    }
    return '';
  }

  // Build regex for phrase or word highlighting
  let regex;
  if (isQuoted) {
    const words = cleanSearch.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
      let phrasePattern;
      try {
        phrasePattern = words.map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('[\\s\\p{P}]+');
        regex = new RegExp(phrasePattern, 'giu');
      } catch (e) {
        phrasePattern = words.map(w => w.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('[\\s\\W]+');
        regex = new RegExp(phrasePattern, 'gi');
      }
    } else {
      regex = new RegExp(cleanSearch.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'gi');
    }
  } else {
    const terms = cleanSearch.split(/\s+/).filter(Boolean).map(term => term.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
    if (terms.length === 0) return line;
    regex = new RegExp(terms.join('|'), 'gi');
  }

  // Parse HTML and walk DOM
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(`<div>${line}</div>`, 'text/html');
  const root = doc.body.firstChild;
  return highlightInNode(root, regex);
}

export default App;
