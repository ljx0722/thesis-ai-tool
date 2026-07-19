FROM python:3.11-slim
ARG APP_VERSION=0.9.0
ARG BUILD_SHA=dev
ARG BUILD_TIME=
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV APP_VERSION=$APP_VERSION
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME
RUN addgroup --system --gid 999 thesisbuddy && adduser --system --uid 999 --ingroup thesisbuddy thesisbuddy
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY --chown=thesisbuddy:thesisbuddy . .
RUN mkdir -p /app/data /app/static/qr && chown -R thesisbuddy:thesisbuddy /app/data /app/static
ENV PORT=5000
ENV DB_PATH=/app/data/thesis.db
ENV MATERIALS_DIR=/app/data/materials
ENV SNAPSHOTS_DIR=/app/data/snapshots
ENV DEEPSEEK_API_KEY=""
USER thesisbuddy
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/health/live', timeout=3)"
CMD ["gunicorn", "kg_server:app", "--bind", "0.0.0.0:5000", "--workers", "1", "--timeout", "180"]
