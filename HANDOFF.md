# Handoff: knitting chart reader ("knitty")

Goal: user uploads a photo of a knitting chart; no ML; if readable, build step-by-step visual explainers
(needle/yarn animations in `public/index.html`); if not, say what is wrong and ask. Website first
(Cloudflare Workers static assets, repo wondercookie42/knitty, auto-deploy on push to main), phone app later (PWA -> Capacitor).
Users are beginners: show symbols (not only words) on choices. Languages: EN + RU now (ZH/JA later). Russian
term for the legend: «Условные обозначения». Keep `tests/i18n-parity.js` passing.

## Files
- `public/reader.js`  pure image analysis (window.Reader). `analyze(gray,w,h,lenient)`.
- `public/reader.html` upload -> mark chart / symbol key / written text -> answer symbols -> count check -> handoff
  to `/?pattern=upload` (sessionStorage `knitUpload`). `window.__readerDebug()` exposes state for tests.
- `public/index.html` explainer (hat, lace star, uploaded chart).
- `tests/dev/` Playwright harnesses (see README there).

## What works now (verified on the user's real photos, small ~577x761 JPEGs, cells only 6-10 px)
- Whole-page upload is rejected (cov<0.4 or area<0.3 of picture) -> user marks the chart box. Boxes: chart/key/text, each with
  its own rotation in degrees (`box.rot`), slider +-45 and +-1 buttons, 90 buttons.
- Region upscaled up to 8x (`prep`), adaptive binarize window r=max(10,min/30), retries with fainter threshold (0.92, 0.96) when lenient.
- Lattice: fitLattice (lenient accepts 4 lines), half-pitch detection (`fixHalf`), per-line snapping (`snapTo`), trimmed to printed lines (`trimTo`),
  per-cell edge search with slope (`bestEdge`), candidates scored (cells*s4*coverage) not first-pass.
- Results: simple 4x7 chart (f88f2e0d box [44,118,128,168]) 28 cells 4 groups; triangle chart (f63a20d1) 98 cells; diamond lace 111; etc.
- Count check ("round N doesn't add up") is now non-blocking (triangles/shaped charts legitimately fail it).

## Known problems / TODO (priority order)
1. DONE (v1): symbol library in `public/symbols.js` (sets de/jis/us; knit, purl, yo, k2tog, skp, ktbl, k3tog, sk2p, inc3, cable). Matching in reader.js `suggest()`; auto-fill only if d<=0.2 and margin>=0.05, suggestion if d<0.35. Calibrated on real pages with tests/dev/cal.js + sheet.py. Still TODO: learned library in localStorage, more symbols/sets (bobble, purl2tog, cables by width), JIS verification with the Japanese book. Original note: Symbol library (user asked): built-in library of standard meanings so the user is not asked per symbol.
   Researched: Craft Yarn Council (K, P, YO, K2tog, SSK, K3tog, SK2P, S2KP2, inc 1-to-3/4/5, bobble, no-stitch, cables), Japanese JIS L 0201
   (blank=knit, vertical/horizontal bars, O yarn over...), Russian/German conventions. Symbols differ by publisher: key the library by
   symbol SET (jis / cyc / de-book / ru) and match by shape (`sdist` on 14x14 fingerprints against drawn templates), auto-answer when confident,
   still let the user confirm. The German book used in the samples: | knit(1 M re), U yarn over(1 Umschlag), V with 2 = 2 M re zusstr (k2tog),
   down-arrow = 1 überz Abn (slip-knit-pass-over), horizontal dash = 1 M li (purl). Also a learned library in localStorage (store fingerprints of
   confirmed answers and reuse them next time).
2. DONE: delete-box button. TODO:  an "auto-find chart" option.
3. Groups still over-split on some charts (red lace 10 groups, pink 9); partial-grid warning shows when cov<0.6. Consider matching cells
   by sdist with larger shift tolerance and merging by key text.
4. Tilt: 1-3 degree tilt of the whole picture can still make grid detection fail; consider row-wise or perspective correction.
5. Multi-square symbols (cables, 1->3 increase drawn as one unit across cells) unsupported; mapped to "can't explain yet".
6. Written text is only shown, not read (OCR optional). Chart of two blocks (Modell 10) reads only one block.
7. Game-like lessons (first stitch, practice rounds), service worker, Capacitor wrapper, ZH/JA strings, legal review before public launch.

## Gotchas
- Sandbox: Google Fonts blocked; abort `/fonts\./` in Playwright. Playwright Chromium is pre-installed (do not install another).
- Always test on the real sample photos (user is frustrated that earlier "tested" claims did not hold). Do not tune thresholds blindly:
  print `metrics.tries` (pitch, cells, s4 per lattice candidate), `hP`/`vP` peaks, and view `region()` output.
- Commit footer: Co-Authored-By line and Claude-Session as required by the harness.
