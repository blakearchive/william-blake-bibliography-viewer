#!/bin/bash

# Test GitHub Release PDF Download
echo "Testing GitHub release PDF download..."

RELEASE_URL="https://github.com/blakearchive/william-blake-bibliography-viewer/releases/download/v1.0.0/Bibliography-Final-Draft.pdf"

echo "Attempting to download from: $RELEASE_URL"

# Test with curl
if curl -I -L "$RELEASE_URL" 2>/dev/null | grep -q "200 OK"; then
    echo "✅ PDF download URL is accessible"
    
    # Get file size
    SIZE=$(curl -I -L "$RELEASE_URL" 2>/dev/null | grep -i content-length | awk '{print $2}' | tr -d '\r')
    if [ ! -z "$SIZE" ]; then
        SIZE_MB=$((SIZE / 1024 / 1024))
        echo "📊 File size: ${SIZE_MB}MB (${SIZE} bytes)"
    fi
else
    echo "❌ PDF download URL is not accessible yet"
    echo "   Please make sure you've created the GitHub release with the PDF asset"
fi
