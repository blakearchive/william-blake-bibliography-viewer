#!/bin/bash

# PDF Download Script for OpenShift Build
# This script downloads the PDF file when Git LFS is not available

PDF_NAME="Bibliography Final Draft.pdf"
PDF_URL="https://github.com/blakearchive/william-blake-bibliography-viewer/raw/main/backend/Bibliography%20Final%20Draft.pdf"

echo "Downloading PDF file for OpenShift deployment..."

# Try multiple download methods
if command -v wget &> /dev/null; then
    echo "Using wget to download PDF..."
    wget -O "$PDF_NAME" "$PDF_URL"
elif command -v curl &> /dev/null; then
    echo "Using curl to download PDF..."
    curl -L -o "$PDF_NAME" "$PDF_URL"
else
    echo "Neither wget nor curl available. Trying python..."
    python3 -c "
import urllib.request
import sys
try:
    urllib.request.urlretrieve('$PDF_URL', '$PDF_NAME')
    print('PDF downloaded successfully with Python')
except Exception as e:
    print(f'Failed to download PDF: {e}')
    sys.exit(1)
"
fi

# Check if download was successful
if [ -f "$PDF_NAME" ]; then
    file_size=$(stat -c%s "$PDF_NAME" 2>/dev/null || stat -f%z "$PDF_NAME" 2>/dev/null)
    if [ "$file_size" -gt 1000000 ]; then  # At least 1MB
        echo "PDF downloaded successfully (${file_size} bytes)"
        exit 0
    else
        echo "PDF file seems too small (${file_size} bytes) - possible download error"
        exit 1
    fi
else
    echo "PDF download failed - file not found"
    exit 1
fi
