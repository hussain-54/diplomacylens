# Global Diplomacy Lens — cPanel deployment guide

**Repository:** https://github.com/hussain-54/diplomacylens.git  
**Branch:** `main`  
**cPanel clone:** `/home/diplaboi/repositories/diplomacylens`  
**Web root:** `/home/diplaboi/public_html/`

## Audit summary

| Item | Value |
|------|--------|
| Framework | Vite 8 + React 19 SPA (TanStack Router) |
| Build | `npm run build` → **`dist/`** |
| Server on cPanel? | **No** for the app shell — static files only |
| Backend | Existing **Supabase** (Auth, Postgres, Storage) from the browser |
| SPA routing | `public/.htaccess` → copied into `dist/.htaccess` |
| Deploy config | `.cpanel.yml` + `scripts/cpanel-deploy.sh` |

Vercel `api/*` serverless routes (sitemap, RSS, social-preview, staff invite) are **not** executed on cPanel. Core site + CMS still work via Supabase.

## One-time server setup (before first Deploy)

### 1. Node.js on the account

cPanel → **Setup Node.js App** (or enable Node so `node` / `npm` exist in the shell used by Git Deployment).  
Note the Node version (18+ recommended) and ensure `npm` is on `PATH` for deployment tasks.

### 2. Create env file **outside** Git

Create:

`/home/diplaboi/.env.diplomacylens`

Example (use your real publishable values — never commit this file):

```bash
# Required for Vite production build
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
VITE_SITE_URL=https://YOUR_DOMAIN.com

# Ensure npm is available to the deploy script (adjust to your cPanel Node path)
# export PATH=/home/diplaboi/nodevenv/..../bin:$PATH
```

**Do not** put `SUPABASE_SERVICE_ROLE_KEY` in this file or in any `VITE_*` variable.

Optional: source your Node.js app’s `nodevenv` PATH in that same file so `npm ci` works during Deploy.

### 3. Supabase Auth

In the Supabase dashboard, add your production domain to Auth redirect / site URL allow-lists.

## What `.cpanel.yml` does

1. Copies the repo to `/home/diplaboi/tmp/diplomacylens-build` (keeps the Git clone clean).
2. Loads `/home/diplaboi/.env.diplomacylens`.
3. Runs `npm ci` + `npm run build`.
4. Copies **only** production files into `public_html`:
   - `index.html`, `.htaccess`, `robots.txt`
   - `assets/` (replaced entirely — removes stale hashed chunks)
   - `images/`, favicons
5. Sets file permissions; deletes the temp build directory.

Unrelated files already in `public_html` are **not** bulk-deleted.

## Required environment variables

### Build-time (must be in `/home/diplaboi/.env.diplomacylens`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Yes | Supabase API URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon / publishable key |
| `VITE_SITE_URL` | Strongly recommended | Canonical / SEO base URL |

### Not used by cPanel static hosting

| Variable | Where |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel `api/staff` only — never on cPanel |
| `SUPABASE_URL` / `SITE_URL` (non-VITE) | Vercel `api/*` only |

## Deploy through cPanel (Pull / Deploy)

1. Push approved changes to GitHub `main` (includes `.cpanel.yml`).
2. cPanel → **Git Version Control** → repository `diplomacylens`.
3. Ensure working tree is clean (this setup avoids dirtying the clone).
4. Click **Update from Remote** / **Pull** (or **Deploy HEAD Commit**).
5. Watch deployment task output for `npm ci` / `npm run build` / `Deploy complete`.
6. Visit the site root and test a deep link refresh (e.g. `/latest`).

If Pull says the tree is dirty: do **not** force-reset blindly. Inspect `git status` in the clone; remove accidental local edits, then Pull again.

## Manual fallback (File Manager / FTP)

If Node is unavailable on the host:

1. Locally: set `VITE_*`, run `npm ci && npm run build`.
2. Upload **contents of `dist/`** into `public_html/` (including `.htaccess`).
3. Do not upload `.env`, `src/`, or `node_modules/`.

## Post-deploy checks

- [ ] Homepage loads over HTTPS  
- [ ] Refresh on `/article/...` or `/latest` does not 404  
- [ ] CSS/JS under `/assets/` load  
- [ ] Images load  
- [ ] Login `/auth` and admin articles/media work  
- [ ] Staff invite/suspend may fail without Vercel `/api/staff` (expected on cPanel-only)

## Safety

- No database migrations or Supabase project changes are performed by this deploy.
- `.env` / service-role keys stay off GitHub (`.gitignore` ignores `.env*`).
