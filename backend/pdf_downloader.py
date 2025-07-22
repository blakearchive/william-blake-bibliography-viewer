import os
import requests
from pathlib import Path

def download_pdf_if_needed():
    """Download PDF from GitHub releases or external source if not present"""
    pdf_path = "Bibliography Final Draft.pdf"
    
    if os.path.exists(pdf_path):
        return pdf_path
    
    print("PDF not found locally, downloading...")
    
    # Option 1: Download from GitHub Releases (you'll need to create a release with the PDF)
    github_release_url = "https://github.com/blakearchive/william-blake-bibliography-viewer/releases/download/v1.0/Bibliography_Final_Draft.pdf"
    
    # Option 2: Download from a public cloud storage (S3, Azure Blob, etc.)
    # cloud_url = "https://your-storage.blob.core.windows.net/pdfs/Bibliography_Final_Draft.pdf"
    
    try:
        response = requests.get(github_release_url, stream=True)
        response.raise_for_status()
        
        with open(pdf_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        print(f"PDF downloaded successfully to {pdf_path}")
        return pdf_path
        
    except Exception as e:
        print(f"Failed to download PDF: {e}")
        raise Exception("PDF file not available")
