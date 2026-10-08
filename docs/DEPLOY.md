# Deploy the demos under vanitatech.co.uk

Target URLs on the existing server:

- Store: `https://vanitatech.co.uk/demos/django-react-ecommerce/`
- Private Hindi app: `https://vanitatech.co.uk/demos/hindi/`
- Optional portfolio index: `https://vanitatech.co.uk/demos/`

**Do not remove the existing main-domain app first.** Prepare and test the
new paths, then retire the old root routes. Keep the same store backend,
database and uploaded media. No new DNS records or sub-domain certificates
are needed: the existing domain and HTTPS certificate can serve these paths.

The server inspected in October 2026 uses host-installed Nginx, socket-activated
Gunicorn and local PostgreSQL on an EC2 `t3.small` in `eu-north-1`.
The chosen replacement is a fresh Docker deployment of both apps and databases,
retaining host Nginx and its existing HTTPS/certificate renewal configuration.
The non-Docker examples below remain alternatives, not instructions to mix
with the container routes.
Root/sub-domain hosting remains supported when both base paths are `/`.

## Docker deployment on the existing EC2 server

Docker Engine and Compose have been installed and verified on the server.
Keep the old services running until the new routes work; the old Gunicorn service
is socket-activated, so retiring it requires disabling both its socket and service.
Do not stop host PostgreSQL until no remaining applications use it.

The new store stack uses three containers: PostgreSQL, Gunicorn, and Nginx serving
the compiled frontend, static files and public media. The internal Nginx is not
a competing HTTPS proxy: only its port 80 is published on `127.0.0.1:3302`.
Gunicorn and PostgreSQL have no published ports. The store and Hindi use distinct
Compose projects and volumes; the new store database starts empty.

Create a private `.env` next to `docker-compose.prod.yml` (mode `600`):

```dotenv
POSTGRES_PASSWORD=YOUR_NEW_RANDOM_DATABASE_PASSWORD
DJANGO_SECRET_KEY=YOUR_NEW_RANDOM_KEY_AT_LEAST_50_CHARACTERS
DJANGO_ALLOWED_HOSTS=vanitatech.co.uk
FRONTEND_URL=https://vanitatech.co.uk/demos/django-react-ecommerce
STORE_PORT=3302
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Generate each secret separately with `openssl rand -hex 32` on the server; do not
paste them into chat or commit the environment file. Stripe can be configured
later with test keys. The Docker images contain no deployed environment file.

For a local build (prefer GitHub-built images on this small instance):

```sh
sudo docker compose -p store -f docker-compose.prod.yml up -d --build
```

For GitHub-built images, add `STORE_BACKEND_IMAGE` and `STORE_FRONTEND_IMAGE`
to the environment file using the exact commit SHA tags from the successful
workflow, then:

```sh
sudo docker compose -p store -f docker-compose.prod.yml pull
sudo docker compose -p store -f docker-compose.prod.yml up -d --no-build
sudo docker compose -p store -f docker-compose.prod.yml ps
sudo docker compose -p store -f docker-compose.prod.yml logs --tail=50 backend
sudo docker compose -p store -f docker-compose.prod.yml exec backend \
  python manage.py createsuperuser
```

Startup checks, migrations and `collectstatic` run before Gunicorn starts and
stop startup on failure. Named volumes preserve database, media and static files
across image updates. Never use `down -v` for a routine deployment. The frontend
health check verifies its web server only; separately test the API, admin,
database access and uploads before accepting a release.

In the existing domain's HTTPS server block, use the following store routes
**instead of** the host-installed store locations in section 5:

```nginx
location = /demos/django-react-ecommerce {
    return 308 /demos/django-react-ecommerce/;
}
location ^~ /demos/django-react-ecommerce/ {
    client_max_body_size 10m;
    proxy_pass http://127.0.0.1:3302;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Preserve the prefix here. The container handles prefix stripping for Django,
React's admin exceptions and static/media paths. Use section 5's Hindi locations
unchanged, preserving the Hindi prefix and its whole-path password gate.
Check `sudo nginx -t` before reloading Nginx; leave existing certificates,
renewal handling and root routes intact until verification.

### GitHub Container Registry and automation

The CI workflow now builds/publishes store backend and frontend images only
after both existing test jobs pass on `main`. Manual runs are available too.
It uses the workflow's `GITHUB_TOKEN` for publishing, not an AWS key.
Images are tagged with the full source commit SHA:

- `ghcr.io/vanitatech/django-react-ecommerce-project-backend:COMMIT_SHA`
- `ghcr.io/vanitatech/django-react-ecommerce-project-frontend:COMMIT_SHA`

Check that both packages are **Private** in GitHub package settings before
configuring the server; do not change them to public. For private pulls, use a
dedicated classic GitHub PAT with only `read:packages`, an expiry, and access to
these packages (authorize organization SSO if applicable). A token owner must
already have package read permission. Do not grant write/delete package scopes.
Enter it through `sudo docker login ghcr.io --username YOUR_GITHUB_USERNAME`;
the password prompt avoids putting it in shell history. Docker stores it in
root's Docker configuration, so treat that file as a credential.

These jobs **publish images, but do not yet deploy EC2**. Server automation still
needs a restricted deployment script, GitHub OIDC role, EC2 Systems Manager
configuration, cross-app deployment locking and application-level health checks.
No merges, pushes or live deployment are performed by creating these files.
The ecommerce release branch is `main`; merge the prepared feature branch only
after review. Pin a release to its SHA; rolling back code does not reverse
database migrations.

## 1. Discover and back up the existing deployment

### Ecommerce deployment command preparation

`deploy/deploy-ecommerce.sh` is the server-side command for the selected fresh
Docker deployment. Install it as `/usr/local/sbin/deploy-ecommerce`, owned by
root with mode `755`. Make `/srv/demos/ecommerce` root-owned with mode `755`,
its Compose file root-owned with mode `644`, and its `.env` root-owned with
mode `600`. Do not change or share the environment file's contents.

The command takes one full lowercase commit SHA, pulls both fixed ecommerce
packages, backs up PostgreSQL and uploaded media, updates the configured image
versions, recreates the internal frontend proxy to resolve the backend's new
address, and waits for the database-backed products API and mounted frontend.
It uses the same server-wide lock as Hindi and does not update host Nginx,
Hindi, or database volumes. A brief ecommerce interruption is expected.

Test it with the currently deployed image SHA before configuring GitHub access.
Then create the SSM Command document `Vanitatech-DeployEcommerce` from
`deploy/ssm-deploy-ecommerce.json` in `eu-north-1`.
The server command has passed its manual test and the SSM test was reported
successful. Create `github-deploy-ecommerce` using
`deploy/github-role-trust.json` as its custom trust policy, then attach
`deploy/github-role-policy.json` as an inline permissions policy.
The repository ID `1353434997` was verified through GitHub. The trust subject
uses the ID-qualified format observed for Hindi on this account; verify the
first ecommerce OIDC run before treating authentication as complete.
Trust is restricted to ecommerce's `main` branch, and SendCommand is limited to
the ecommerce document and existing instance. Result-reading requires `*`
because GetCommandInvocation does not support resource-level permissions.
The automatic deployment job has not yet been configured.
Do not grant general SSM shell access or reuse Hindi's deployment role.

Backups accumulate under `/var/backups/vanitatech/ecommerce`; monitor space,
configure retention and keep protected off-server copies. Database and media
backups are taken sequentially while the app runs, not as an atomic snapshot.
For strict consistency, prevent writes during a maintenance window.
Failures stay failed; never automatically restore the pre-release database
or roll back an image across migrations without reviewing compatibility.

On the server, run these read-only checks:

```sh
sudo ss -ltnp
systemctl --type=service --state=running
free -h
df -h
```

If Docker is installed:

```sh
docker compose ls
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Record the existing reverse proxy, certificate/renewal method, store service
name, checkout, service user, virtual environment, backend port/socket,
production settings module, frontend build directory, database and media
directory. For Nginx, inspect `sudo nginx -T` locally; it can contain sensitive
configuration, so do not publish its output.

Back up the proxy configuration, service settings/environment, current React
build, production database and media. Keep a protected off-server copy.
Use the existing PostgreSQL dump procedure, or SQLite's backup API/command
rather than copying a database while writes are in progress.

Do not overwrite production data with this checkout's `db.sqlite3` or media.
Do not run `seed_store` on the deployed database. A hostname/path move needs no
schema migration. If also updating code, review migrations separately.

Do not install a competing proxy on ports 80/443 or replace the existing
firewall/DNS. Hindi needs its own Docker project, Postgres and unused loopback
port, not the store's database. Check spare capacity and build off-peak.

## 2. Configure the Django mount path and production settings

Update the **existing store service's** private environment:

```dotenv
APP_BASE_PATH=/demos/django-react-ecommerce/
FRONTEND_URL=https://vanitatech.co.uk/demos/django-react-ecommerce
```

The repository now uses `APP_BASE_PATH` for Django's `FORCE_SCRIPT_NAME`,
static/media URLs and cookie paths. Its proxy must strip that prefix before
forwarding requests to Django. Do not add the prefix to `backend/urls.py` too:
that would require it twice.
Mounted Django cookies use `vanitacart_sessionid` and `vanitacart_csrftoken`
to avoid collisions with old root-site cookies; root hosting keeps Django's
usual names.

The base settings are development-only. If the server already has production
settings, preserve their database, logging and storage configuration and ensure
they use the new path settings. If it does not, select the provided production
module with:

```dotenv
DJANGO_SETTINGS_MODULE=backend.production_settings
DJANGO_ALLOWED_HOSTS=vanitatech.co.uk
DJANGO_SECRET_KEY=YOUR_PRIVATE_DEPLOYED_SECRET_KEY
DJANGO_TRUST_PROXY=true
DJANGO_ALLOWED_ORIGINS=
```

`DJANGO_SETTINGS_MODULE` must be set in the service's **process environment**
(for example its systemd `Environment=`/`EnvironmentFile=` or container
environment), not merely added to Django's `.env`: Django selects its module
before the base settings load that file. Keep using the existing service
definition and add this selector there. The commands below select it explicitly.

- Preserve the existing secret key if it is private and safe. The committed
  development key must not be used in production; generate a private replacement
  with `openssl rand -hex 32` if necessary. Rotation invalidates sessions/tokens,
  so expect users to log in again.
- `DJANGO_ALLOWED_HOSTS` is hostnames only. Add `www.vanitatech.co.uk` only if
  the store is also deliberately served there; preferably redirect `www` to
  the canonical domain using the existing proxy.
- `DJANGO_ALLOWED_ORIGINS` is an optional comma-separated list of origins
  **without paths**. Same-origin React/API deployment needs no CORS exception.
- Enable `DJANGO_TRUST_PROXY` only if the backend is loopback/private and the
  proxy replaces `X-Forwarded-Proto` with its own value. Otherwise HTTPS
  detection/redirects can be spoofed or loop.
- Preserve the real database settings. PostgreSQL requires `USE_SQLITE=false`
  and **all** of `DB_NAME`, `DB_USER`, `DB_HOST` plus the password/port.
  The production module rejects incomplete PostgreSQL configuration rather
  than silently opening a new SQLite database. An intentional existing SQLite
  deployment must explicitly use `USE_SQLITE=true`.

Run from the actual backend directory using its virtual environment and the
same production environment as the service:

```sh
python -m pip install -r requirements.txt
python manage.py check --deploy --settings=backend.production_settings
python manage.py collectstatic --noinput --settings=backend.production_settings
```

Do not ignore deployment warnings. Enable HSTS deliberately after verifying
HTTPS; do not blindly enable domain-wide preload/includeSubDomains.
Substitute the existing production module in these commands if using one instead.
Keep the existing service supervisor and Gunicorn, bound to a private socket
or loopback address (example: `127.0.0.1:8000`). Do not use Django `runserver` or
expose port 8000 publicly. Reload/restart only this store service in the
maintenance window, after adding the new proxy locations.

## 3. Build and stage React

Both Vite settings are build-time values:

```sh
cd frontend
npm ci
VITE_BASE_PATH=/demos/django-react-ecommerce/ \
VITE_DJANGO_BASE_URL=/demos/django-react-ecommerce \
npm run build
```

Use Node.js 22.12+. An existing `.env` may contain the old backend URL:
the explicit values above override it. The router, assets and all API calls
must agree with the Django mount.

Copy the built `dist/` contents to a **separate** release directory, e.g.
`/srv/demos/django-react-ecommerce/`, leaving the old root build available for
rollback. Nginx's `root /srv` example below resolves the public path to that
directory; substitute actual paths consistently. Give the proxy read/traverse
permissions without exposing source files, `.env`, database files or other
directories.

The app namespaces tokens/guest carts by mount path; root hosting retains the
old keys. Moving to the demo path requires another login and does not transfer
the old guest cart. Database-backed users/orders/carts remain unchanged.

## 4. Stage the Hindi stack independently

Follow the Hindi repository's `docs/DEPLOY.md`, in a separate checkout such as
`/srv/hindi`. Its `.env` should include:

```dotenv
APP_BASE_PATH=/demos/hindi/
HINDI_PORT=3301
ALLOWED_ORIGINS=https://vanitatech.co.uk
ALLOWED_SIGNUP_EMAILS=your-real-email@example.com
```

Set a random Hindi `POSTGRES_PASSWORD`; do not reuse the store's database.
Confirm 3301 is unused. The production Compose configuration uses the path at
**both build and runtime** and binds the port to localhost only.

Create a basic-auth file for Hindi using `htpasswd` (Ubuntu package:
`apache2-utils`):

```sh
sudo htpasswd -c /etc/nginx/hindi.htpasswd me
sudo chown root:www-data /etc/nginx/hindi.htpasswd
sudo chmod 640 /etc/nginx/hindi.htpasswd
```

Use the actual Nginx worker group if different. `-c` creates/overwrites a file:
never target another site's auth file, and omit `-c` when updating this one.
The gate must cover **all** of `/demos/hindi/`, including its API, assets,
manifest and service worker. A sign-up allowlist alone does not make it private.

## 5. Add locations to the existing HTTPS virtual host

Keep the existing `server_name`, certificate directives, TLS settings,
renewal challenge handling and main-domain routes during staging. Add these
locations to the existing `vanitatech.co.uk` HTTPS `server` block; do not
create another conflicting virtual host with the same name.

Adjust backend ports and filesystem paths to match discovery:

```nginx
# Canonical trailing slashes for app roots.
location = /demos/django-react-ecommerce {
    return 302 /demos/django-react-ecommerce/;
}
location = /demos/hindi {
    return 302 /demos/hindi/;
}

# Django sees /api/... (the mount prefix is stripped).
location = /demos/django-react-ecommerce/api {
    return 308 /demos/django-react-ecommerce/api/;
}
location ^~ /demos/django-react-ecommerce/api/ {
    proxy_pass http://127.0.0.1:8000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}

# These two /admin/... paths belong to React, not Django admin.
location = /demos/django-react-ecommerce/admin/orders/ {
    return 308 /demos/django-react-ecommerce/admin/orders;
}
location = /demos/django-react-ecommerce/admin/orders {
    root /srv;
    try_files /demos/django-react-ecommerce/index.html =404;
}
location ~ ^/demos/django-react-ecommerce/admin/content/[^/]+/preview/?$ {
    root /srv;
    try_files /demos/django-react-ecommerce/index.html =404;
}
location /demos/django-react-ecommerce/admin/ {
    proxy_pass http://127.0.0.1:8000/admin/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
location = /demos/django-react-ecommerce/admin {
    return 302 /demos/django-react-ecommerce/admin/;
}

location ^~ /demos/django-react-ecommerce/static/ {
    alias /srv/vanitacart/backend/staticfiles/;
}
location ^~ /demos/django-react-ecommerce/media/ {
    alias /srv/vanitacart/backend/media/;
    add_header X-Content-Type-Options nosniff always;
}
location ^~ /demos/django-react-ecommerce/assets/ {
    root /srv;
    try_files $uri =404;
}
location /demos/django-react-ecommerce/ {
    root /srv;
    try_files $uri $uri/ /demos/django-react-ecommerce/index.html;
}

# Hindi's API/server already understand the mount: preserve the prefix.
location ^~ /demos/hindi/ {
    auth_basic "Private Hindi test";
    auth_basic_user_file /etc/nginx/hindi.htpasswd;
    add_header X-Robots-Tag "noindex, nofollow" always;
    proxy_pass http://127.0.0.1:3301;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Use the **existing production** media/static directories. Product media is
public; private documents must not be stored there. Preserve existing upload
limits or set appropriate ones. Ensure other regex locations in the existing
Nginx config do not override the new store routes. API, media and static requests
must never fall through to a root-site SPA or return a React HTML page.

Do not add a trailing slash to Hindi's `proxy_pass`: unlike Django, its prefix
must not be stripped. Backend forwarding headers are replaced rather than
extended with client-supplied values in this one-proxy example.

```sh
sudo nginx -t && sudo systemctl reload nginx
```

Reload, do not stop the whole proxy. If it is inside a container, localhost
means that container: use the existing private network/upstream conventions,
not publicly exposed application ports.

### If the proxy is not Nginx

Keep the same routing contract:

- Caddy/Apache must strip only the store mount before forwarding `/api/` and
  Django `/admin/`; keep its React admin exceptions, assets/media and SPA fallback.
- Preserve Hindi's prefix and put the private gate around the entire Hindi path.
- A Cloudflare Tunnel used for the **same domain** must route through this
  shared proxy, not point the whole domain at Hindi. Keep existing DNS/tunnel
  routes. An Access application can protect `vanitatech.co.uk/demos/hindi/*`;
  ensure the no-trailing-slash URL is also covered/redirected safely and that
  direct access to the origin cannot bypass Access. For a publicly reachable
  origin, retain proxy basic auth or configure authenticated origin protection.
- Do not blindly apply these Nginx directives to Caddy/Apache or a managed host.
  First obtain a configuration matching the discovered proxy.

## 6. Stripe cutover

Use a short maintenance window and avoid starting new test checkouts during
the final switch. Outstanding sessions may still return to the old URLs.

1. Set backend `FRONTEND_URL` as in section 2 and reload the store service.
2. In Stripe's test/sandbox dashboard, add the endpoint
   `https://vanitatech.co.uk/demos/django-react-ecommerce/api/payments/stripe/webhook/`.
3. Subscribe to `checkout.session.completed`, `checkout.session.expired` and
   `checkout.session.async_payment_failed`, as used by this app.
4. Update `STRIPE_WEBHOOK_SECRET` to that endpoint's signing secret. The app
   supports one configured secret, not two concurrent endpoint secrets.
   Coordinate the secret/endpoint switch and reconcile pending deliveries;
   retry failed events through the new endpoint. Do not silently lose updates.
5. Keep `STRIPE_SECRET_KEY` in test mode; the code rejects live keys.
6. Verify a sandbox checkout, success/cancel URL, paid status, stock and webhook
   delivery before retiring the old endpoint.

Hindi's gate must not apply to the store's webhook path. If separately gating
the store, Stripe needs a narrowly scoped webhook exception and signature
verification must remain enabled.

## 7. Verify before retiring root routes

- Both new app roots and React deep links load after refresh.
- No asset/API request escapes its app path or points to localhost in browser JS.
- Store products/images, guest/member cart, login, signup, profile, order
  creation/history/tracking and staff operations work.
- Django admin redirects and CSS stay inside the store path; CMS draft previews
  go to React rather than Django's admin catch-all.
- Existing users, products and orders are still present in the same database.
- Stripe sandbox checkout and signed webhook delivery pass.
- In an incognito browser, Hindi shows the proxy login wall **before** showing
  any app content. Without credentials its API, manifest and assets return 401.
- After passing the gate, register the allowlisted email, complete a Hindi lesson,
  open Review/Stats/Profile, log out/in and check audio on the phone.
- Hindi's service-worker scope/start URL are `/demos/hindi/`, not `/`. If an old
  root-scoped Hindi worker was previously installed on this origin, unregister
  that worker and clear its old Hindi caches before using other demos.
- The original main-domain site and unrelated apps still behave as before.

Cookie paths and storage namespaces prevent accidental collisions, **not a
security boundary**: all paths share an origin. A compromised public store
could access Hindi after you log in to its gate. Use sub-domains if you later
need isolation between untrusted/public demos.

## 8. Remove the old root storefront route, not the running app

For the selected fresh Docker deployment, the public root page is
maintained separately in the `vanitatech-website` project as `index.html`,
linking to Vanita's GitHub and LinkedIn profiles.
Copy it to `/var/www/vanita-landing/index.html`, readable by Nginx.
In the existing main-domain HTTPS server block, change the old frontend
`root` to `/var/www/vanita-landing`, remove any server-level SPA `try_files`,
and replace the old `location /` with:

```nginx
location = / {
    try_files /index.html =404;
}
location / {
    return 404;
}
```

Keep both `/demos/` proxy locations, TLS directives and certificate-renewal
locations. Validate and reload Nginx, then check the landing page, both profile
links and both demo routes. The landing page deliberately does not list Hindi.
This static page is deployed separately from app images.

The preservation guidance below applies to migrations retaining the original
backend. For the selected fresh replacement, retire the old API virtual host
before disabling both `gunicorn.socket` and `gunicorn.service`; only stop host
PostgreSQL after confirming no other application uses it. Do not delete old
directories or databases merely to retire their services.

Once section 7 passes, replace only the old root frontend/API/admin/static/media
locations. Do not stop Gunicorn, drop the database, remove uploaded media or
delete the existing domain certificate. Keep old files/config for rollback.

For example, after removing the old root-serving locations, use:

```nginx
location = / {
    return 302 /demos/;
}
location = /demos {
    return 302 /demos/;
}
location = /demos/ {
    default_type text/html;
    return 200 '<!doctype html><title>Demos</title><h1>Demos</h1><a href="/demos/django-react-ecommerce/">Store demo</a>';
}
location / {
    return 410;
}
```

The demo routes in section 5 are more specific and remain active. Retain
certificate challenge and other intentionally hosted routes. Keep private Hindi
unlisted on the public demo index if desired; its gate is still mandatory.

Do not merely add the catch-all while leaving old `/api/`, `/admin/`, `/media/`
or `/static/` proxy locations: those more-specific locations would still work.
Do not blanket-redirect old POST/API/webhook traffic. Add individually reviewed
frontend redirects only if old product/guest tracking bookmarks need to survive;
tracking URLs contain private bearer tokens, so never publish them.

Validate and reload, then check:

```sh
curl -I https://vanitatech.co.uk/
curl -I https://vanitatech.co.uk/api/products/
curl -I https://vanitatech.co.uk/demos/django-react-ecommerce/
curl -I https://vanitatech.co.uk/demos/hindi/api/units
```

Expect a reversible 302 for `/`, 410 for the old API, a working store and 401
for Hindi without basic-auth credentials. Recheck `www` if it previously hosted
the store, and reconcile old Stripe deliveries before removing its endpoint.

## 9. Rollback and updates

Restore the saved proxy configuration, old frontend build and previous backend
path/origin/settings if the move fails. Validate before reloading. Restore the
previous Stripe endpoint/signing-secret pairing if changed and test the old site.
A path-only rollback should not require database restoration or losing orders.

For updates, build React with the same demo path, retain rollback builds,
back up before schema changes, restart only the intended service and continue
database/media backups and TLS renewal. Keep Hindi's Compose project separate.
This guide is not a security audit of the ecommerce app.
