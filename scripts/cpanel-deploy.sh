#!/bin/bash
# Deploy Global Diplomacy Lens production build to cPanel public_html.
# Invoked from .cpanel.yml against a COPY of the repo under /home/diplaboi/tmp
# so the Git working tree in /home/diplaboi/repositories/diplomacylens stays clean.

set -euo pipefail

DEPLOYPATH="${DEPLOYPATH:-/home/diplaboi/public_html}"
BUILDDIR="${BUILDDIR:-/home/diplaboi/tmp/diplomacylens-build}"
ENVFILE="${ENVFILE:-/home/diplaboi/.env.diplomacylens}"

echo "[cpanel-deploy] BUILDDIR=$BUILDDIR"
echo "[cpanel-deploy] DEPLOYPATH=$DEPLOYPATH"

if [ ! -d "$BUILDDIR" ]; then
  echo "[cpanel-deploy] ERROR: build directory missing: $BUILDDIR" >&2
  exit 1
fi

cd "$BUILDDIR"

# Load production Vite env (outside Git — never commit secrets)
if [ -f "$ENVFILE" ]; then
  echo "[cpanel-deploy] Loading env from $ENVFILE"
  set -a
  # shellcheck disable=SC1090
  . "$ENVFILE"
  set +a
else
  echo "[cpanel-deploy] WARNING: $ENVFILE not found. Build will fail if VITE_* vars are unset." >&2
fi

if [ -z "${VITE_SUPABASE_URL:-}" ] || [ -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  echo "[cpanel-deploy] ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required." >&2
  exit 1
fi

if [ -z "${VITE_SITE_URL:-}" ]; then
  echo "[cpanel-deploy] WARNING: VITE_SITE_URL unset; SEO canonical URLs may fall back at runtime." >&2
fi

# Prefer Node from cPanel "Setup Node.js App" if the user exported NVM/node paths in ENVFILE
if ! command -v npm >/dev/null 2>&1; then
  echo "[cpanel-deploy] ERROR: npm not found on PATH. Enable Node.js in cPanel or add it to $ENVFILE PATH." >&2
  exit 1
fi

echo "[cpanel-deploy] node=$(command -v node) ($(node -v 2>/dev/null || true))"
echo "[cpanel-deploy] npm=$(command -v npm) ($(npm -v 2>/dev/null || true))"

npm ci
npm run build

test -f dist/index.html
test -f dist/.htaccess
test -d dist/assets

# Deploy production assets only — do NOT wipe unrelated files in public_html
mkdir -p "$DEPLOYPATH"

# Replace hashed bundles (remove stale Vite chunks)
rm -rf "$DEPLOYPATH/assets"
cp -R dist/assets "$DEPLOYPATH/"

if [ -d dist/images ]; then
  mkdir -p "$DEPLOYPATH/images"
  cp -R dist/images/. "$DEPLOYPATH/images/"
fi

cp -f dist/index.html "$DEPLOYPATH/index.html"
cp -f dist/.htaccess "$DEPLOYPATH/.htaccess"

if [ -f dist/robots.txt ]; then
  cp -f dist/robots.txt "$DEPLOYPATH/robots.txt"
fi

for f in favicon.ico favicon.png favicon.svg favicon-32.png favicon-48.png apple-touch-icon.png; do
  if [ -f "dist/$f" ]; then
    cp -f "dist/$f" "$DEPLOYPATH/$f"
  fi
done

# Sensible permissions for shared hosting
chmod 644 "$DEPLOYPATH/index.html" "$DEPLOYPATH/.htaccess" 2>/dev/null || true
chmod -R u=rwX,go=rX "$DEPLOYPATH/assets" 2>/dev/null || true
if [ -d "$DEPLOYPATH/images" ]; then
  chmod -R u=rwX,go=rX "$DEPLOYPATH/images" 2>/dev/null || true
fi

# Remove temp build copy so nothing lingers; repo clone stays untouched/clean
cd /
rm -rf "$BUILDDIR"

echo "[cpanel-deploy] Deploy complete → $DEPLOYPATH"
