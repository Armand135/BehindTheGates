FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form (not exec-array) so ${PORT} expands -- Render and similar
# platforms assign the port dynamically via this env var at runtime.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
