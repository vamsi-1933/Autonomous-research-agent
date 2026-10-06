FROM python:3.12-slim
WORKDIR /app

# 1. Copy ONLY requirements first (this layer caches unless deps change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy source code AFTER dependencies are installed
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]