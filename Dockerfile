FROM node:22-slim AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_BASE_PATH=/demos/django-react-ecommerce/ \
    VITE_DJANGO_BASE_URL=/demos/django-react-ecommerce
RUN npm run build

FROM python:3.12-slim AS backend
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=backend.production_settings
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home app
COPY --chown=app:app backend/ ./
COPY --chmod=755 deploy/backend-entrypoint.sh /usr/local/bin/backend-entrypoint
RUN mkdir -p media staticfiles && chown app:app media staticfiles
USER app
EXPOSE 8000
ENTRYPOINT ["backend-entrypoint"]
CMD ["gunicorn", "backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--access-logfile", "-", "--error-logfile", "-"]

FROM nginx:stable-alpine AS frontend
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /frontend/dist/ /usr/share/nginx/html/demos/django-react-ecommerce/
EXPOSE 80
