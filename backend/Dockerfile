FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y gcc g++ musl-dev libffi-dev wget curl && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend source files (including main.py) into the image
COPY . .

# Download the PDF only if it does not already exist
ARG PDF_FILENAME=Bibliography_Revised_8.6.25.pdf
ARG PDF_URL="https://github.com/user-attachments/files/21687901/Bibliography_Revised_8.6.25.pdf"
RUN if [ ! -f "${PDF_FILENAME}" ]; then \
    wget -O "${PDF_FILENAME}" "${PDF_URL}"; \
    fi && \
    [ $(stat -c %s "${PDF_FILENAME}") -gt 1000000 ]

RUN useradd -m -u 1001 appuser || true && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
