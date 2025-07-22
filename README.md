# PDF Navigator Web App

# William Blake Bibliography PDF Viewer

A full-stack web application for serving and navigating large PDF documents with bookmarks, search functionality, and text selection. Built specifically for "A Selected Annotated Bibliography of William Blake and His Circle" - a 1,782-page academic resource.

## Features

- **PDF Viewing**: High-quality page rendering with image optimization
- **Text Selection**: Overlay selectable text on PDF images with precise coordinate mapping
- **Full-Text Search**: Fast search with fuzzy matching and highlighted snippets
- **Hierarchical Bookmarks**: Collapsible navigation tree with organized sections
- **Dual View Modes**: Single page and continuous scroll viewing
- **Performance Optimized**: LRU caching, chunked loading, and streaming responses
- **Modern UI**: Blake Archive-inspired design with responsive layout

## Tech Stack

### Backend
- **FastAPI**: Modern Python web framework
- **PyMuPDF**: PDF processing and text extraction
- **Whoosh**: Full-text search indexing
- **rapidfuzz**: Fuzzy string matching
- **uvicorn**: ASGI server

### Frontend
- **React**: User interface framework
- **Axios**: HTTP client for API calls
- **CSS3**: Custom styling with Blake Archive inspiration

## Installation

### Quick Start (Recommended)

The easiest way to run the application locally is using the provided startup script:

```bash
./start.sh
```

This script will:
1. Set up a Python virtual environment
2. Install all dependencies (backend and frontend)
3. Start both servers
4. Open the application in your browser

### Manual Installation

### Prerequisites
- Python 3.8+
- Node.js 14+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install fastapi uvicorn pymupdf whoosh rapidfuzz python-multipart
```

4. Place your PDF file in the backend directory and update the filename in `main.py` if needed.

5. Start the backend server:
```bash
PYTHONPATH=/path/to/your/backend python3 -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Deployment

### OpenShift Deployment

For production deployment on Red Hat OpenShift:

```bash
# Login to your OpenShift cluster
oc login <your-openshift-cluster-url>

# Deploy the application
./deploy-openshift.sh
```

The deployment includes:
- Containerized backend (FastAPI) and frontend (React + Nginx)
- Automatic builds from GitHub repository
- HTTPS-enabled public routes
- High availability with multiple replicas
- Health checks and resource management
- OpenShift-compatible security contexts and permissions

#### Recent Fixes Applied:
- ✅ **Git LFS Resolution**: PDF hosted via GitHub releases (v1.0.0)
- ✅ **Backend Permissions**: Uses `/tmp/indexdir` for OpenShift compatibility
- ✅ **Frontend Assets**: Added missing `public/` directory to repository
- ✅ **Nginx Service Discovery**: Uses OpenShift internal DNS resolver
- ✅ **Container Permissions**: Fixed nginx cache directory permissions for restricted security context
- ✅ **Nginx Configuration**: Optimized for containerized environment with stderr logging

**Status**: All known OpenShift deployment issues have been resolved. The application should now deploy successfully.

See [OPENSHIFT.md](OPENSHIFT.md) for detailed deployment instructions, architecture overview, and troubleshooting guide.

## API Endpoints

- `GET /api/info` - PDF metadata (page count, etc.)
- `GET /api/page/{page_num}` - Page image as PNG
- `GET /api/page/{page_num}/text` - Text blocks with coordinates
- `GET /api/bookmarks` - Hierarchical bookmark structure
- `GET /api/search?query={query}` - Full-text search with snippets

## Usage

1. **Navigation**: Use the sidebar to browse through prefatory material and organized sections
2. **Search**: Enter keywords in the search box to find relevant pages
3. **View Modes**: Toggle between single page and continuous scroll viewing
4. **Text Selection**: Click and drag to select text on any page
5. **Home Button**: Quick return to page 1

## Project Structure

```
├── backend/
│   ├── main.py              # FastAPI application
│   ├── Bibliography Final Draft.pdf  # Source PDF
│   └── indexdir/            # Search index (auto-generated)
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main React component
│   │   ├── SelectablePageViewer.js  # Text overlay component
│   │   └── blakeArchiveStyle.css    # Custom styling
│   ├── public/
│   └── package.json
└── README.md
```

## Development

### Backend Development
- The backend automatically generates a search index on first run
- PDF text extraction includes coordinate mapping for precise text overlay
- Caching is implemented for improved performance with large documents

### Frontend Development
- React components are organized for reusability
- Custom CSS provides Blake Archive-inspired styling
- Text selection uses SVG overlays with coordinate scaling

## Performance Considerations

- **Image Caching**: LRU cache for page images and text blocks
- **Chunked Loading**: Continuous view loads pages in batches of 50
- **Search Optimization**: Pre-built Whoosh index for fast text search
- **Retry Logic**: Automatic retry for failed page loads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Academic Use

This application was specifically designed for academic research and bibliography navigation. The interface prioritizes readability and scholarly workflow efficiency.

## Features
- FastAPI backend for PDF extraction and serving
- React frontend for navigation, search, and page viewing
- Sidebar for bookmarks/anchors
- Search bar for full-text search
- Page viewer that preserves PDF look

## Getting Started
- Backend: Python (FastAPI)
- Frontend: React

## Project Structure
- `/backend`: FastAPI backend
- `/frontend`: React frontend

## Setup Instructions
1. Install backend dependencies and start FastAPI server
2. Install frontend dependencies and start React app

See each folder for more details.
# Updated Tue Jul 22 00:23:16 EDT 2025
# Force rebuild - Tue Jul 22 00:40:14 EDT 2025
# Frontend rebuild - Tue Jul 22 00:49:59 EDT 2025
