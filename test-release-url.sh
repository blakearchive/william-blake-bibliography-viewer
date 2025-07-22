#!/bin/bash

# Test GitHub Release PDF Download
echo "Testing GitHub release PDF download..."

RELEASE_URL="https://github.com/blakearchive/william-blake-bibliography-viewer/releases/download/v1.0.0/Bibliography-Final-Draft.pdf"

echo "Attempting to download from: $RELEASE_URL"

# Test with authentication if GITHUB_TOKEN is available
if [ ! -z "$GITHUB_TOKEN" ]; then
    echo "🔐 Using GitHub token for authentication..."
    if curl -I -L -H "Authorization: token $GITHUB_TOKEN" "$RELEASE_URL" 2>/dev/null | grep -q "200 OK"; then
        echo "✅ PDF download URL is accessible with authentication"
        
        # Get file size
        SIZE=$(curl -I -L -H "Authorization: token $GITHUB_TOKEN" "$RELEASE_URL" 2>/dev/null | grep -i content-length | awk '{print $2}' | tr -d '\r')
        if [ ! -z "$SIZE" ]; then
            SIZE_MB=$((SIZE / 1024 / 1024))
            echo "📊 File size: ${SIZE_MB}MB (${SIZE} bytes)"
        fi
        exit 0
    fi
fi

# Test without authentication (for public releases)
echo "🌐 Trying without authentication..."
if curl -I -L "$RELEASE_URL" 2>/dev/null | grep -E "HTTP.*200" >/dev/null; then
    echo "✅ PDF download URL is accessible"
    
    # Get file size from the final response after following redirects
    SIZE=$(curl -I -L "$RELEASE_URL" 2>/dev/null | grep -i content-length | tail -1 | awk '{print $2}' | tr -d '\r')
    if [ ! -z "$SIZE" ]; then
        SIZE_MB=$((SIZE / 1024 / 1024))
        echo "📊 File size: ${SIZE_MB}MB (${SIZE} bytes)"
    fi
else
    echo "❌ PDF download URL is not accessible"
    echo ""
    echo "📋 For private repositories, you have these options:"
    echo "   1. Set GITHUB_TOKEN environment variable:"
    echo "      export GITHUB_TOKEN=your_personal_access_token"
    echo "      ./test-release-url.sh"
    echo ""
    echo "   2. Make the GitHub release publicly accessible"
    echo "      (Edit the release and check 'Make this release public')"
    echo ""
    echo "   3. Create a personal access token with 'repo' permissions at:"
    echo "      https://github.com/settings/tokens"
fi
