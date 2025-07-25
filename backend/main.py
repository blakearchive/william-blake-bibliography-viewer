

from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import List, Optional
import fitz  # PyMuPDF
import os
import urllib.request
from whoosh.index import create_in, open_dir
from whoosh.fields import Schema, TEXT, NUMERIC
from whoosh.qparser import QueryParser
from functools import lru_cache
from threading import Lock

# Simple in-memory cache for first 5 pages
_first_pages_cache = {}
_first_pages_lock = Lock()
from io import BytesIO
from rapidfuzz import fuzz, process

PDF_PATH = os.path.join(os.path.dirname(__file__), "Bibliography Final Draft.pdf")
# Use /tmp for index directory in containerized environments
INDEX_DIR = os.getenv('SEARCH_INDEX_DIR', '/tmp/indexdir')

app = FastAPI()

# Check if PDF exists, if not try to download it
def ensure_pdf_exists():
    if not os.path.exists(PDF_PATH):
        print(f"PDF not found at {PDF_PATH}, attempting to download...")
        try:
            pdf_url = "https://github.com/blakearchive/william-blake-bibliography-viewer/raw/main/backend/Bibliography%20Final%20Draft.pdf"
            urllib.request.urlretrieve(pdf_url, PDF_PATH)
            print(f"PDF downloaded successfully to {PDF_PATH}")
        except Exception as e:
            print(f"Failed to download PDF: {e}")
            raise HTTPException(
                status_code=503, 
                detail="PDF file not available. Please ensure the PDF is properly uploaded to the container."
            )

# Ensure PDF is available on startup
try:
    ensure_pdf_exists()
except Exception as e:
    print(f"Warning: PDF initialization failed: {e}")

@lru_cache(maxsize=128)
def get_page_image(page_num: int):
    # Cache first 5 pages in memory
    if 1 <= page_num <= 5:
        with _first_pages_lock:
            if page_num in _first_pages_cache:
                return BytesIO(_first_pages_cache[page_num])
    doc = fitz.open(PDF_PATH)
    page = doc.load_page(page_num - 1)
    img = page.get_pixmap()
    img_bytes = img.tobytes("png")
    if 1 <= page_num <= 5:
        with _first_pages_lock:
            _first_pages_cache[page_num] = img_bytes
    return BytesIO(img_bytes)

@lru_cache(maxsize=128)
def get_page_text_blocks(page_num: int):
    """Extract text blocks with coordinates for a page"""
    doc = fitz.open(PDF_PATH)
    page = doc.load_page(page_num - 1)
    
    # Get text blocks with coordinates
    text_blocks = page.get_text("dict")
    
    # Extract text with bounding boxes
    result = {
        "page": page_num,
        "width": page.rect.width,
        "height": page.rect.height,
        "blocks": []
    }
    
    for block in text_blocks["blocks"]:
        if "lines" in block:  # Text block
            block_data = {
                "bbox": block["bbox"],  # [x0, y0, x1, y1]
                "lines": []
            }
            
            for line in block["lines"]:
                line_data = {
                    "bbox": line["bbox"],
                    "spans": []
                }
                
                for span in line["spans"]:
                    span_data = {
                        "text": span["text"],
                        "bbox": span["bbox"],
                        "font": span["font"],
                        "size": span["size"],
                        "flags": span["flags"]
                    }
                    line_data["spans"].append(span_data)
                
                block_data["lines"].append(line_data)
            
            result["blocks"].append(block_data)
    
    return result

def get_pdf():
    return fitz.open(PDF_PATH)

def extract_bookmarks_hierarchical():
    doc = get_pdf()
    toc = doc.get_toc()
    def build_tree(toc):
        tree = []
        stack = [(0, tree)]
        for item in toc:
            level, title, page = item[:3]
            node = {"title": title, "page": page, "children": []}
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack[-1][1].append(node)
            stack.append((level, node["children"]))
        return tree
    return build_tree(toc)

def build_search_index():
    try:
        if not os.path.exists(INDEX_DIR):
            os.makedirs(INDEX_DIR, exist_ok=True)
        schema = Schema(page=NUMERIC(stored=True), content=TEXT(stored=True))
        ix = create_in(INDEX_DIR, schema)
        writer = ix.writer()
        doc = get_pdf()
        for page_num in range(doc.page_count):
            text = doc.load_page(page_num).get_text()
            writer.add_document(page=page_num+1, content=text)
        writer.commit()
        print(f"Search index built successfully at {INDEX_DIR}")
    except PermissionError as e:
        print(f"Permission error creating index directory {INDEX_DIR}: {e}")
        print("Search functionality will be disabled")
        return False
    except Exception as e:
        print(f"Error building search index: {e}")
        return False
    return True

def ensure_index():
    if not os.path.exists(INDEX_DIR):
        return build_search_index()
    return True

def search_pdf(query, fuzzy=False):
    if not ensure_index():
        # Return empty results if indexing fails
        return []
    
    try:
        ix = open_dir(INDEX_DIR)
        qp = QueryParser("content", schema=ix.schema)
        q = qp.parse(query)
        
        with ix.searcher() as searcher:
            results = searcher.search(q, limit=50)
            output = []
            for result in results:
                content = result["content"]
                # Find the line containing the query (case-insensitive)
                lines = content.splitlines()
                match_line = next((line for line in lines if query.lower() in line.lower()), "")
                output.append({
                    "page": result["page"],
                    "content": content[:200] + "...",
                    "line": match_line
                })
            return output
    except Exception as e:
        print(f"Search error: {e}")
        return []

@app.on_event("startup")
def startup_event():
    print("Starting Blake Bibliography Backend...")
    print(f"Search index directory: {INDEX_DIR}")
    if ensure_index():
        print("Search index initialized successfully")
    else:
        print("Warning: Search index initialization failed, search will be disabled")

@app.get("/api/page/{page_num}")
def get_page(page_num: int):
    try:
        doc = get_pdf()
        if page_num < 1 or page_num > doc.page_count:
            return JSONResponse({"error": "Page out of range"}, status_code=404)
        img_bytes = get_page_image(page_num)
        img_bytes.seek(0)
        return StreamingResponse(img_bytes, media_type="image/png")
    except Exception as e:
        print(f"Error loading page {page_num}: {e}")
        return JSONResponse({"error": f"Failed to load page {page_num}"}, status_code=500)

@app.get("/api/info")
def get_pdf_info():
    """Get PDF information including total page count"""
    try:
        doc = get_pdf()
        return {
            "total_pages": doc.page_count,
            "title": doc.metadata.get("title", "Bibliography Final Draft"),
            "author": doc.metadata.get("author", ""),
        }
    except Exception as e:
        print(f"Error getting PDF info: {e}")
        return JSONResponse({"error": "Failed to get PDF information"}, status_code=500)

@app.get("/api/page/{page_num}/text")
def get_page_text(page_num: int):
    """Get text blocks with coordinates for a specific page"""
    try:
        doc = get_pdf()
        if page_num < 1 or page_num > doc.page_count:
            return JSONResponse({"error": "Page out of range"}, status_code=404)
        text_data = get_page_text_blocks(page_num)
        return JSONResponse(text_data)
    except Exception as e:
        print(f"Error loading text for page {page_num}: {e}")
        return JSONResponse({"error": f"Failed to load text for page {page_num}"}, status_code=500)

@app.get("/api/bookmarks")
def get_bookmarks():
    return JSONResponse({"bookmarks": extract_bookmarks_hierarchical()})

@app.get("/api/search")
def search(query: str = Query(...), fuzzy: bool = Query(False)):
    results = search_pdf(query, fuzzy=fuzzy)
    return JSONResponse({"results": results})

@app.get("/api/anchor/{anchor_title}")
def jump_to_anchor(anchor_title: str):
    bookmarks = extract_bookmarks_hierarchical()
    def find_anchor(tree, title):
        for node in tree:
            if node["title"] == title:
                return node["page"]
            result = find_anchor(node["children"], title)
            if result:
                return result
        return None
    page = find_anchor(bookmarks, anchor_title)
    if page:
        return JSONResponse({"page": page})
    return JSONResponse({"error": "Anchor not found"}, status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
