# Nutrition Tracker

Personal lean-bulk nutrition tracker. PWA, offline-first, single user.

Live: https://nutrition-eux.pages.dev

## Stack

Vite + React + TypeScript, Dexie (IndexedDB), Tailwind, Recharts, ZXing for barcode scan. PWA via `vite-plugin-pwa`. Hosted on Cloudflare Pages with auto-deploy on push to `master`.

## Develop

```bash
npm install
cp .env.example .env   # set VITE_USDA_API_KEY (DEMO_KEY works, heavily rate-limited)
npm run dev
npm test
npm run typecheck
npm run build
```

## Note on `VITE_USDA_API_KEY`

The USDA FoodData Central key is a `VITE_*` var, so it ends up in the public client bundle. That's fine here — it's a free, per-key rate-limited (1000 req/hr) key with no account access, and this is a single-user personal app. Worst case someone scrapes the key and I burn through the hourly quota. Accepting that trade-off vs. running a proxy.

If this ever needs to be multi-user, swap to a tiny Cloudflare Worker that holds the key server-side.
