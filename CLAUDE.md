# Microfabrication Interactive – notes for Claude (and humans)

Interactive teaching simulations for microfabrication / semiconductor process technology. Static site, no build step:
`assets/mfw.js` (engine, namespace `MFW`), `assets/mfw.css`, one folder per page in `widgets/<topic>/`
(`model.js` physics, `widget.js` figure, `index.html` texts). Structure and engine API: see `README.md`.

## Content rules

- **English** on all pages, plain and precise; the audience is students.
- **Course-neutral.** The site is shared between institutions: no course codes, lecture numbers, slide references or
  names of a particular course or funding project on any page, in code comments or commit messages.
- **Every fact verified.** Each constant in `model.js` carries its source in a comment; each page lists references.
  Cite the original literature (textbooks, papers, datasheets), never lecture slides. If a value cannot be traced to
  a source, do not use it – say so instead of guessing.
- Every page states its model limitations ("Model & limitations" card). Schematic parts of a figure are labelled as
  schematic; to-scale parts as to scale.
- Lecture slides used for cross-checking live in `source_prednasky/` locally. They are copyrighted and **must never be
  committed** (the folder is gitignored – keep it that way, also for any other course material).

## Visual quality bar (non-negotiable)

- **No overlaps** – labels must not collide with each other, with lines or with the plotted data, in any tour step,
  any slider state, both themes, at desktop and phone width.
- **No flicker or jumping** while a slider moves. Use `p.place` / `ax.place` / `ax.labelCurve` / `ax.legend` for
  data-dependent labels (sticky candidates) and `w.smooth(key, target)` for changing ranges and zooms – never
  hard-coded positions that a slider can push into something else.
- Colours only through palette roles (`C.*`, `MFW.MAT.*`), never literal colours – otherwise dark/light mode breaks.

## Before saying a change is done

1. `node tests/verify.js` – all physics checks pass (add checks for any new physics).
2. In the browser (served by `python tools/serve.py`, then the page's console):
   - load `../../tests/overlap-audit.js`, run `MFWAudit.run({ random: 40 })` in **both** themes
     (`MFW.setTheme('light'|'dark')`) – expect no issues;
   - load `../../tests/stability.js`, run `await MFWStability.run(20)` – expect 0 px movement.
   - Animated pages: freeze time for the audit, e.g. spin coating `window.MFW_SPIN_TP = <seconds>` at several times.
3. Look at it: screenshots of a few states (Playwright or the preview browser), also at ~375 px width.
4. `python tools/cache-bust.py` after editing any `.js`/`.css` (stamps `?v=<hash>` into the pages).
5. Delete temporary screenshot folders (`.playwright-mcp/` is gitignored, but keep the tree clean).

## Working together

- Two people (and their Claude sessions) work on this repo: use a branch per change and a pull request to `main`;
  `git pull` before starting. Keep one page's changes in one PR where possible – `assets/mfw.js` / `mfw.css` are
  shared by every page, so engine changes deserve a note in the PR and a quick audit of all pages.
- Line endings are LF (`.gitattributes`); Windows warnings about CRLF are harmless.
- The site is not published yet (no GitHub Pages) – don't enable publishing without agreement.
