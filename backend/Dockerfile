FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for PyMuPDF and wget
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

# Copy application code (excluding PDF)
COPY main.py .
COPY PDF_SETUP.md .

# Download the PDF from GitHub releases or direct URL
# This avoids the Git LFS issue
RUN wget -O "Bibliography Final Draft.pdf" \
    "https://github.com/blakearchive/william-blake-bibliography-viewer/raw/main/backend/Bibliography%20Final%20Draft.pdf" \
    || curl -L -o "Bibliography Final Draft.pdf" \
    "https://github.com/blakearchive/william-blake-bibliography-viewer/raw/main/backend/Bibliography%20Final%20Draft.pdf" \
    || echo "PDF download failed - will need manual upload"

# Create non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
