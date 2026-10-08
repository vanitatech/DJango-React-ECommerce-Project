#!/bin/bash
set -Eeuo pipefail
umask 077

if [[ $# != 1 || ! $1 =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: deploy-ecommerce.sh FULL_LOWERCASE_COMMIT_SHA" >&2
  exit 2
fi
if [[ $EUID != 0 ]]; then
  echo "Deployment must run as root." >&2
  exit 1
fi

exec 9>/run/lock/vanitatech-deploy.lock
flock -w 900 9 || { echo "Another deployment holds the server lock." >&2; exit 1; }

env_file=/srv/demos/ecommerce/.env
compose_file=/srv/demos/ecommerce/docker-compose.prod.yml
backend_image="ghcr.io/vanitatech/django-react-ecommerce-project-backend:$1"
frontend_image="ghcr.io/vanitatech/django-react-ecommerce-project-frontend:$1"
compose=(docker compose --env-file "$env_file" -p store -f "$compose_file")
trap 'echo "Ecommerce deployment failed. Inspect container status; do not restore the database or roll back across migrations blindly." >&2' ERR

for directory in /srv/demos/ecommerce; do
  if [[ ! -d $directory || -L $directory || $(stat -c %u "$directory") != 0 ]] \
    || (( (8#$(stat -c %a "$directory") & 8#022) != 0 )); then
    echo "Deployment directory must be root-owned and not group/world writable." >&2
    exit 1
  fi
done
for file in "$env_file" "$compose_file"; do
  if [[ ! -f $file || -L $file || $(stat -c %u "$file") != 0 ]]; then
    echo "Deployment configuration must be a regular root-owned file: $file" >&2
    exit 1
  fi
  if (( (8#$(stat -c %a "$file") & 8#022) != 0 )); then
    echo "Deployment configuration must not be group/world writable: $file" >&2
    exit 1
  fi
done
if [[ $(stat -c %a "$env_file") != 600 ]] \
  || [[ $(grep -c '^STORE_BACKEND_IMAGE=' "$env_file") != 1 ]] \
  || [[ $(grep -c '^STORE_FRONTEND_IMAGE=' "$env_file") != 1 ]] \
  || ! grep -qx 'STORE_PORT=3302' "$env_file"; then
  echo "Expected environment mode 600, one entry per image and port 3302." >&2
  exit 1
fi

"${compose[@]}" config --quiet
docker pull "$backend_image"
docker pull "$frontend_image"

backup_dir=/var/backups/vanitatech/ecommerce
install -d -m 700 "$backup_dir"
release_dir=$(mktemp -d "$backup_dir/release-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
cp "$env_file" "$release_dir/previous.env"
"${compose[@]}" exec -T db pg_dump -U store -d store -Fc > "$release_dir/database.dump"
test -s "$release_dir/database.dump"
"${compose[@]}" exec -T backend tar -C /app/media -czf - . > "$release_dir/media.tar.gz"
test -s "$release_dir/media.tar.gz"

sed -e "s|^STORE_BACKEND_IMAGE=.*|STORE_BACKEND_IMAGE=$backend_image|" \
  -e "s|^STORE_FRONTEND_IMAGE=.*|STORE_FRONTEND_IMAGE=$frontend_image|" \
  "$env_file" > "$release_dir/next.env"
install -m 600 "$release_dir/next.env" "$env_file"
"${compose[@]}" up -d --no-build --no-deps backend

# Nginx resolves the backend address at startup, so recreate it after backend updates.
"${compose[@]}" up -d --no-build --no-deps --force-recreate \
  --wait --wait-timeout 180 frontend

ready=false
for ((attempt=0; attempt<60; attempt++)); do
  if curl --fail --silent --show-error --max-time 10 --output /dev/null \
    -H 'Host: vanitatech.co.uk' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3302/demos/django-react-ecommerce/api/products/ \
    2>"$release_dir/readiness-error.log"; then
    ready=true
    break
  fi
  sleep 5
done
if [[ $ready != true ]]; then
  cat "$release_dir/readiness-error.log" >&2
  echo "Ecommerce API did not become ready." >&2
  exit 1
fi
curl --fail --silent --show-error --max-time 15 --output /dev/null \
  -H 'Host: vanitatech.co.uk' -H 'X-Forwarded-Proto: https' \
  http://127.0.0.1:3302/demos/django-react-ecommerce/
echo "Ecommerce deployment succeeded: $1"
echo "Database, media and previous configuration backups: $release_dir"
