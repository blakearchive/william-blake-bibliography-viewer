FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PyMuPDF and download tools
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    musl-dev \
    libffi-dev \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (no PDF in repository anymore)
COPY main.py .
COPY PDF_SETUP.md .

# Download PDF from GitHub release with authentication support
ARG GITHUB_TOKEN
RUN echo "Downloading PDF from GitHub release..." && \
    (if [ ! -z "$GITHUB_TOKEN" ]; then \
        echo "Using GitHub token for private repository..."; \
        curl -L -H "Authorization: token $GITHUB_TOKEN" -o "Bibliography Final Draft.pdf" \
        "https://github.com/blakearchive/william-blake-bibliography-viewer/releases/download/v1.0.0/Bibliography-Final-Draft.pdf"; \
    else \
        echo "Trying without authentication..."; \
        curl -L -o "Bibliography Final Draft.pdf" \
        "https://github.com/blakearchive/william-blake-bibliography-viewer/releases/download/v1.0.0/Bibliography-Final-Draft.pdf"; \
    fi) \
    && echo "PDF download completed: $(ls -lh 'Bibliography Final Draft.pdf' 2>/dev/null || echo 'file not found')" \
    || (echo "PDF download failed, creating placeholder..." && echo "PDF download failed - will try at runtime" > "Bibliography Final Draft.pdf")

# Verify PDF file exists and has reasonable size
RUN if [ -f "Bibliography Final Draft.pdf" ]; then \
        FILE_SIZE=$(stat -c%s "Bibliography Final Draft.pdf" 2>/dev/null || stat -f%z "Bibliography Final Draft.pdf" 2>/dev/null); \
        if [ "$FILE_SIZE" -gt 1000000 ]; then \
            echo "✅ PDF verified: ${FILE_SIZE} bytes"; \
        else \
            echo "⚠️  Warning: PDF file seems too small (${FILE_SIZE} bytes)"; \
        fi; \
    else \
        echo "❌ Error: PDF file not found"; \
    fi

# Create non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
