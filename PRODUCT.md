# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- University students of microfabrication / semiconductor process technology courses, at several institutions (the site is shared teaching material of a European project; no single course is named). They use it on their own laptops and phones to understand a process step before an exam or a cleanroom lab.
- Lecturers, who project a lesson in a lecture hall and drive the tour (the tab “Challenges”) or change parameters live in front of the class.
Both situations are equally important.

## Product Purpose
Interactive simulations that show the physics behind each microfabrication step (doping, oxidation, deposition, lithography, etching, characterization, and the fundamentals behind them). Each lesson pairs a to-scale figure that reacts to parameters with a guided tour, a free Explore mode, key equations, worked exercises with answers, the model's limitations and references. Success: a student can predict a process result (a junction depth, a film thickness, an etch profile) and explain why, and a lecturer can show it live without preparation.

## Positioning
Every number is traced to the original literature and every model states its limits; figures are drawn to scale where they claim to be, and labelled schematic where they are not. The figures, not the page around them, are the product.

## Operating Context
- Projected at 1280×720 or similar in lecture halls, often on washed-out projectors; used at desktop widths and on phones (≈390 px) by students.
- Lessons are grouped into modules that follow a process flow (Fundamentals, Substrate, Lithography, Doping, Thin films, Etching, Interconnects, Characterization, and a process game at the end), numbered module.page.
- Content is in English, course-neutral, with no slide references; lecture slides are used locally only for cross-checking.

## Capabilities and Constraints
- Static site: plain HTML/CSS/JS, no build step; one shared engine (`assets/mfw.js`, `assets/mfw.css`) draws every figure on a canvas; KaTeX for equations. Published with GitHub Pages from `main`.
- Figures must never have overlapping labels or flicker while a parameter moves (audited by `tests/overlap-audit.js` and `tests/stability.js`); colours only through palette roles so both themes work. Light theme is the default; a dark theme remains available.
- Feedback from students must work without a GitHub account: a Google/Microsoft form (link to be provided by the owner).
- Open decision: the site name ("Microfabrication Interactive") and the µ mark may change later; nothing about the name or mark is fixed.

## Evidence on Hand
- 21 lessons and one process game with source-verified models and 500 automated physics checks (`tests/verify.js`), as of 2026-11-28.
- No testimonials, usage numbers or institutional endorsements exist; none may be invented.

## Product Principles
1. The figure teaches; everything else supports it and stays out of its way.
2. Truth before polish: sourced numbers, stated limitations, honest "to scale" / "schematic" labels.
3. Works in the room and in the hand: legible on a projector and on a phone.
4. Course-neutral and shareable across institutions.

## Accessibility & Inclusion
WCAG 2.1 AA (the level EU public-sector web rules, EN 301 549, refer to): contrast, keyboard operation, text alternatives for figures, no meaning by colour alone, usable at 200 % zoom.
