# Diplomacy Lens (Client)

Lightweight client-delivery version of [Diplomacy Lens](https://diplomacylens.com) — a professional digital publication with a focused CMS.

## What’s included

1. **Public website** — homepage, category pages, article listings, article detail, navigation, SEO
2. **Basic blog management** — create, edit, draft, publish, unpublish, delete articles; categories & tags
3. **Professional article editor** — rich text, images, SEO fields, preview, featured image
4. **Media library** — upload, preview, alt text, featured image selection, delete

## Stack

- Vite + React 19 + TypeScript
- TanStack Router & Query
- Supabase (Auth, Postgres, Storage)
- TipTap rich-text editor

## Setup

```bash
cp .env.example .env
# Fill in Supabase URL and anon key
npm install
npm run dev
```

Open `http://localhost:5173`. Admin: sign in at `/login`, then `/admin`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Environment

See `.env.example`. Never commit `.env` or service-role keys. The browser uses the Supabase **anon** key only; Row Level Security remains enabled.

## Admin

Sidebar:

- Dashboard
- Articles
- New Article
- Media Library
- Categories & Tags
- Settings
- Logout

## Notes

This is a selective extraction from the full Diplomacy Lens newsroom platform. Enterprise modules (newsroom ops, homepage builder, analytics, revenue, etc.) are intentionally excluded. Database schema is shared/compatible with the original project; no destructive migrations are applied by this client.
