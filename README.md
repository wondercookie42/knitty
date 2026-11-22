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

## Chart reader (`public/reader.html`, `public/reader.js`)
Classic image processing, no ML, no network. Pipeline: quality gate (size, contrast, sharpness) -> adaptive binarize -> grid-line detection -> lattice fit (prefers square cells, weights long lines over in-cell strokes) -> cell existence (border coverage, largest connected block) -> cell fingerprints -> grouping -> dictionary suggestions -> user labels each group -> stitch-count check.
Rejects non-charts with a specific reason and advice; drag a box on the picture to crop.

Tested on: Russian hat chart (196/196 cells, 3 groups), German lace star (100/100 cells, round widths all correct), a text page (rejected).

Known limits
- Symbols spanning several cells (the 1-to-3 increase arc, wide cables) are split across cells and get mixed into neighbouring groups; the count check flags it, but groups can't be split by hand yet.
- Suggestions come from a few stroke templates and are only pre-selected at high confidence; most groups need one tap.
- Perspective-skewed or curved-page photos fail with an "irregular grid" message (no de-skew yet).
- Not wired into the explainer yet: labelled groups do not yet produce a lesson.

## Roadmap
1. Merge groups / split a group by hand; multi-cell symbols; remember labels per publisher.
2. Feed the labelled grid into the explainer (lessons and animations from the grid).
3. Perspective correction; legend text recognition on-device.
4. Parametric cable animations; Chinese and Japanese strings.
5. Service worker for offline use, then Capacitor wrapper for the app stores.
