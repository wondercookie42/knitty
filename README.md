# Knit Chart Guide

Interactive explainer for knitting charts: tap a stitch, see what it means, watch the needle-and-yarn animation. English and Russian now; Chinese and Japanese planned.

Currently two hand-entered demo charts (cable beanie, lace star) that exercise the full pipeline: chart grid, round-by-round reading, per-stitch explanation, animations, stitch-count check.

## Run locally
    npx wrangler dev        # http://localhost:8787
    npm test                # translation key parity

## Deploy to Cloudflare (Workers static assets)
Option A, CLI: `npm install && npx wrangler login && npm run deploy`

Option B, Git-connected (auto-deploys on push): Cloudflare dashboard, Workers & Pages, Create, Import a repository. Build command: empty. Deploy command: `npx wrangler deploy`.

## Layout
- `public/index.html`: the whole app (single file, no build step). Translations live between `/*STR_START*/` and `/*STR_END*/`.
- `public/manifest.webmanifest`, `public/icon.svg`: installable-PWA basics.
- `wrangler.jsonc`: serves `public/` as static assets.

## Add a language
Copy the `en` block inside `STR`, translate, add an entry to `LANG_LIST`, run `npm test`.

## Roadmap (not built yet)
1. Upload + chart reader without ML calls: classical image processing (grid detection, symbol template matching), legend OCR/matching against a built-in symbol dictionary, user correction of low-confidence cells.
2. "Can't explain this" diagnosis: not a chart / too blurry / no legend and unknown symbols / stitch counts don't add up, each with a specific ask.
3. Parametric animation library (cables N held, M worked, front or back).
4. Service worker for offline use, then Capacitor wrapper for the app stores.

Uploaded charts are copyrighted by their publishers: process on-device, don't store or redistribute them.
