# PDF Configuration

## Setting up your PDF file

1. Place your PDF file in the `backend/` directory
2. Update the `PDF_FILE` variable in `backend/main.py` to match your PDF filename
3. The default configuration expects a file named "Bibliography Final Draft.pdf"

## Current Configuration

```python
PDF_FILE = "Bibliography Final Draft.pdf"
```

## For Different PDF Files

If you're using a different PDF file, update the `PDF_FILE` variable in `main.py`:

```python
PDF_FILE = "your-pdf-filename.pdf"
```

## File Size Considerations

- PDFs up to 100MB are supported
- For larger files, consider using PDF compression tools
- The search index is automatically generated based on your PDF content
