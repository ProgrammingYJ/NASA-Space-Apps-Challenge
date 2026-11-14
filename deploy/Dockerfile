FROM node:22.17.0-bookworm-slim AS frontend
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 APP_STATE_DIR=/app/var
WORKDIR /app
COPY requirements.runtime.lock.txt ./
RUN pip install --no-cache-dir -r requirements.runtime.lock.txt
COPY api/ api/
COPY science/ science/
COPY worker/ worker/
COPY THIRD_PARTY_NOTICES.md ./
COPY data/manifests/ data/manifests/
COPY --from=frontend /build/web/dist web/dist
EXPOSE 8000
# Exactly one API writer. It launches one science process via IPC.
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
