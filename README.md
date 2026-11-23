# Microfabrication Interactive

Interactive simulations for teaching microfabrication and semiconductor process technology: each page combines a guided tour, a free Explore mode, key equations, exercises with answers, the model's limitations and references for every number used.
Live: https://rgumelmicromachines.github.io/microfabrication_widgets/ (GitHub Pages, branch `main`).

Static site: plain HTML, CSS and JavaScript, no build step. Works from any static web host (e.g. GitHub Pages or a university web server) and also when opened straight from disk.

## Structure

```
index.html                    hub (links to all pages)
assets/mfw.js                 widget engine: drawing, plots, tour/explore modes, themes, KaTeX loader
assets/mfw.css                page + widget styles, light/dark theme tokens
widgets/<topic>/index.html    page: widget + key equations, exercises, model limitations, references
widgets/<topic>/model.js      physics only (pure functions, every constant with its source) – also runs in Node
widgets/<topic>/widget.js     the figure, parameters, readout and guided-tour steps
tests/verify.js               physics regression checks against textbook values and closed-form results
tests/overlap-audit.js        browser: finds overlapping labels/lines/formulas over all tour steps and random slider states
tests/stability.js            browser: drags every slider, reports any layout movement and the slowest frame
tests/contact-sheet.js        browser: renders many states on one canvas for visual review
```

Pages, grouped into modules: Fundamentals (`semiconductor`, `vacuum`), Substrate (`segregation`), Lithography (`spincoating`, `lithography`), Doping (`diffusion`, `implant`), Thin films (`oxidation`, `cvd`, `pvd`, `stress`), Etching (`etching`, `dryetch`), Characterization (`fourpoint`). The modules and their pages are listed once, in `MODULES` in `assets/mfw.js`; the lesson menu, the numbering (e.g. 4.2), the previous/next links and the grouping of the tiles on the overview page are all built from it – to add a page, add it there and add a tile to `index.html`.

## Run locally

```
python tools/serve.py
```

then open http://localhost:8765. (`python -m http.server 8765` works too, but sends no cache headers, so browsers – Firefox in particular – may keep showing an old version after an edit.) Run the physics checks with `node tests/verify.js` (all must pass before publishing).

After editing any `.js` or `.css` file run `python tools/cache-bust.py`: it stamps every script and stylesheet link in the pages with a content hash (`?v=…`), so visitors' browsers always load the current version.

## Adding a page

1. Copy a folder in `widgets/`, rename it.
2. Put the physics in `model.js` (no drawing code, cite every constant) and add checks to `tests/verify.js`.
3. Describe the figure in `widget.js` with `MFW.widget('#app', { params, derived, draw, readout, steps, ... })`.
   - `params`: number → slider (`log: true` for a log slider), `options` → select, boolean → checkbox; `when: v => …` shows a control conditionally.
   - `steps`: the guided tour. Parameters a step `set`s are locked while the tour is active; everything else stays under the student's control. `text`/`caption` may be functions of the live values.
   - Use palette roles (`C.yellow`, `C.text`, `MFW.MAT.sio2` …), never literal colours – that is what makes light/dark mode work.
   - Labels whose position depends on the data: use `p.place(text, candidates)` / `ax.place`, `ax.labelCurve`, or `ax.legend` – they
     avoid everything already drawn and keep their position while it stays free (no hopping while a slider moves).
     Auto-zoom and changing axis ranges: `w.smooth('key', target, { log: true })` in `draw(p, v, w)` glides instead of jumping.
4. Before publishing, in the browser console of the page:
   load `../../tests/overlap-audit.js` and run `MFWAudit.run()` (expect no issues), then `../../tests/stability.js` and `MFWStability.run()` (0 px movement).
5. Add a tile to `index.html`.

## Contributing

Read `CLAUDE.md` first: content rules (English, course-neutral, every number sourced), the visual quality bar (no overlaps, no flicker) and the checks to run before a change counts as done. Claude Code picks the file up automatically, so the same rules apply to AI-assisted work. Work on a branch and open a pull request to `main`.

Course lecture slides used for cross-checking are kept locally in `source_prednasky/` and are never committed.

## Notes

- The text font (Archivo, SIL Open Font License, `assets/fonts/`) is self-hosted; KaTeX still comes from jsDelivr. For a server under GDPR you may prefer to self-host KaTeX too (`MFW.config.katexBase`).
- The contents page shows miniatures of each lesson's figure (`assets/thumbs/`, see the README there for how they were made); regenerate them when a figure changes visibly.
- Theme and playback speed are remembered in `localStorage` (per browser only); nothing is sent anywhere.
