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
tests/flicker.js              browser: sweeps and wiggles every slider, reports labels, boxes or axes that jump back and forth
                              (labels that merely appear at a slider threshold are listed apart, in `result.thresholds`)
tests/tour-check.js           browser: checks an interactive tour – every task reachable by its own solution, every question well formed
tests/contact-sheet.js        browser: renders many states on one canvas for visual review
```

Pages, grouped into modules: Fundamentals (`semiconductor`, `vacuum`), Substrate (`segregation`), Lithography (`spincoating`, `softbake`, `lithography`), Doping (`diffusion`, `implant`), Thin films (`oxidation`, `cvd`, `pvd`, `stress`), Etching (`etching`, `dryetch`), Interconnects (`electromigration`, `stressmigration`), Characterization (`fourpoint`, `interference`). The modules and their pages are listed once, in `MODULES` in `assets/mfw.js`; the lesson menu, the numbering (e.g. 4.2), the previous/next links and the grouping of the tiles on the overview page are all built from it – to add a page, add it there and add a tile to `index.html`.

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
   - A lesson opens in **Explore**; the guided tour is the second tab (`startMode: 'tour'` in the config, or `#tour` at the end of the address, opens the tour directly).
   - `steps`: the guided tour. Parameters a step `set`s are locked while the tour is active; everything else stays under the student's control. `text`/`caption` may be functions of the live values.
   - Interactive tour (all pages): keep the first step a plain introduction, then mix predict and try steps. A step with `ask: { q, options, correct }` asks a question first and moves the figure only after the answer (`from` sets the state the question is about); a step with `goal: v => …`, `task` and `solution` lets the student work the sliders until the goal holds, with a “Show me” button. As soon as one step has `ask` or `goal`, the tour locks nothing, has no autoplay and is navigated by numbered dots.  In a try step the text must use live values, because the student's solution differs from yours. Run `MFWTour.run()` from `tests/tour-check.js` – expect an empty list.
   - Use palette roles (`C.yellow`, `C.text`, `MFW.MAT.sio2` …), never literal colours – that is what makes light/dark mode work.
   - Labels whose position depends on the data: use `p.place(text, candidates)` / `ax.place`, `ax.labelCurve`, or `ax.legend` – they
     avoid everything already drawn and keep their position while it stays free (no hopping while a slider moves).
     Auto-zoom and changing axis ranges: `w.smooth('key', target, { log: true })` in `draw(p, v, w)` glides instead of jumping.
4. Before publishing, in the browser console of the page:
   load `../../tests/overlap-audit.js` and run `MFWAudit.run()` (expect no issues), then `../../tests/stability.js` and `MFWStability.run()` (0 px movement), then `../../tests/flicker.js` and `MFWFlicker.run()` (no label or axis jumping back and forth).
   Use `w.nice(key, list, need)` for any auto-zoomed range or scale bar (it has hysteresis, and while a slider is dragged it only grows, with 2× headroom, then settles once – no sawtooth zooming) and `MFW.chars(rows)` for the characteristics table.
   Buttons on the figure (run, restart, pause): `widget.stageBar([{ icon, label, title, onClick }], { right: true })` – on a narrow screen the bar moves below the figure by itself; the overlap audit reports anything drawn under such a button.
5. Add a tile to `index.html`.

## Contributing

Read `CLAUDE.md` first: content rules (English, course-neutral, every number sourced), the visual quality bar (no overlaps, no flicker) and the checks to run before a change counts as done. Claude Code picks the file up automatically, so the same rules apply to AI-assisted work. Work on a branch and open a pull request to `main`.

Course lecture slides used for cross-checking are kept locally in `source_prednasky/` and are never committed.

## Notes

- The text font (Archivo, SIL Open Font License, `assets/fonts/`) is self-hosted; KaTeX still comes from jsDelivr. For a server under GDPR you may prefer to self-host KaTeX too (`MFW.config.katexBase`).
- The contents page shows miniatures of each lesson's figure (`assets/thumbs/`, see the README there for how they were made); regenerate them when a figure changes visibly.
- Theme and playback speed are remembered in `localStorage` (per browser only); nothing is sent anywhere.
