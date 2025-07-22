#!/bin/bash

# GitHub Release Creator for PDF Asset
# This script helps create a GitHub release with the PDF as an asset

REPO="blakearchive/william-blake-bibliography-viewer"
TAG="v1.0.0"
RELEASE_NAME="William Blake Bibliography PDF v1.0"
PDF_FILE="backend/Bibliography Final Draft.pdf"

echo "Creating GitHub release for PDF deployment..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. Please install it first:"
    echo "https://cli.github.com/"
    exit 1
fi

# Check if user is logged in
if ! gh auth status &> /dev/null; then
    echo "Please login to GitHub CLI first:"
    echo "gh auth login"
    exit 1
fi

# Create the release with PDF as asset
echo "Creating release $TAG..."
gh release create "$TAG" \
    --repo "$REPO" \
    --title "$RELEASE_NAME" \
    --notes "Release containing the William Blake Bibliography PDF for deployment purposes.

This release provides the PDF file as a downloadable asset to avoid Git LFS issues in containerized deployments.

**For Developers:**
- Use this release asset URL in Docker builds
- Download URL: https://github.com/$REPO/releases/download/$TAG/Bibliography-Final-Draft.pdf

**File Details:**
- Original filename: Bibliography Final Draft.pdf
- Size: ~18MB
- Pages: 1,782" \
    "$PDF_FILE#Bibliography-Final-Draft.pdf"

if [ $? -eq 0 ]; then
    echo "✅ Release created successfully!"
    echo "🔗 PDF download URL: https://github.com/$REPO/releases/download/$TAG/Bibliography-Final-Draft.pdf"
    echo ""
    echo "You can now use this URL in your OpenShift deployment:"
    echo "curl -L -o 'Bibliography Final Draft.pdf' \\"
    echo "  'https://github.com/$REPO/releases/download/$TAG/Bibliography-Final-Draft.pdf'"
else
    echo "❌ Failed to create release"
    exit 1
fi
