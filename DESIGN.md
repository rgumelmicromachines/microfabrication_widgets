---
name: Microfabrication Interactive
description: Interactive process-physics lessons laid out like a page of a component datasheet.
colors:
  ground: "#ffffff"
  surface: "#ffffff"
  surface-2: "#f3f5f7"
  hairline: "#d3d9df"
  rule-strong: "#9aa4ae"
  ink: "#14181d"
  ink-2: "#343c45"
  muted: "#5a646f"
  oxide-blue: "#1d3f73"
  oxide-blue-soft: "rgba(29, 63, 115, 0.08)"
  link: "#1d4a8c"
  focus: "#2452b8"
  danger: "#b3261e"
  band: "#1d3f73"
  band-text: "#ffffff"
  band-muted: "#c5d2e6"
  band-line: "rgba(255, 255, 255, 0.34)"
  selection: "rgba(36, 82, 184, 0.18)"
  ground-dark: "#0d1116"
  surface-dark: "#12171e"
  surface-2-dark: "#19202a"
  hairline-dark: "#29313c"
  rule-strong-dark: "#4a5562"
  ink-dark: "#e6e9ed"
  ink-2-dark: "#bcc4cd"
  muted-dark: "#8e98a4"
  oxide-blue-dark: "#a8c3ee"
  oxide-blue-soft-dark: "rgba(168, 195, 238, 0.10)"
  link-dark: "#a8c3ee"
  focus-dark: "#8fb2f0"
  danger-dark: "#ff8a80"
  stage-dark: "#0b0e12"
  band-dark: "#142a4d"
  band-text-dark: "#eef2f7"
  band-muted-dark: "#aebcd2"
  band-line-dark: "rgba(255, 255, 255, 0.24)"
  selection-dark: "rgba(143, 178, 240, 0.28)"
typography:
  headline:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 36px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 92"
  title:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.25
    fontVariation: "'wdth' 92"
  title-module:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.2
    fontVariation: "'wdth' 88"
  lede:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Archivo, Segoe UI, system-ui, -apple-system, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum'"
  body-ui:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum'"
  label-condensed:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 650
    lineHeight: 1.25
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 82"
  figure-number:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
    fontVariation: "'wdth' 85"
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "28px"
  2xl: "48px"
  page-x: "clamp(16px, 3vw, 40px)"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  button-play:
    backgroundColor: "{colors.oxide-blue}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
    width: "96px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-ui}"
    padding: "8px 4px 7px"
  tab-selected:
    textColor: "{colors.ink}"
  header-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.band-text}"
    height: "48px"
  lesson-number:
    backgroundColor: "{colors.oxide-blue-soft}"
    textColor: "{colors.oxide-blue}"
    typography: "{typography.label-condensed}"
    rounded: "{rounded.none}"
    height: "24px"
    width: "40px"
  figure-plate:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.none}"
  characteristics-table:
    textColor: "{colors.ink-2}"
    typography: "{typography.body-ui}"
  slider-value:
    textColor: "{colors.oxide-blue}"
    width: "7.5em"
---

# Design System: Microfabrication Interactive

## Overview

**Creative North Star: "The Component Datasheet"**

Each lesson reads like a page of a component datasheet: a numbered figure plate, its characteristics table and the controls that drive it. The system is flat, square and ruled. Structure comes from hairlines and two-pixel ink rules, not from boxes, cards or shadows. One deep oxide blue carries the shell band, links, focus and selected values. Each module has one further hue, taken from the figure palette, that marks where a lesson belongs (see Module colours); every other hue on the page belongs to the figure's materials. The figure is the product and the page stays out of its way.

Density is that of a reference document: 17px body text, tabular figures everywhere numbers appear, condensed Archivo for numbers, labels and table heads. Navigation and controls stay ordinary web controls (buttons, tabs, a select, range sliders) dressed in the datasheet's type, rules and palette. Light theme is the default; a dark theme maps the same roles onto a blue-black ground.

Layout never moves while the reader works: caption lines, explanation boxes, step titles, value readouts and the characteristics table all reserve their height, so dragging a slider changes numbers, never positions.

**Key Characteristics:**
- Cool white ground, near-black ink, hairline rules, square corners everywhere.
- One accent (oxide blue) for band, links, focus, selection and live values.
- Archivo variable: normal width for prose, 82-92 % width for headings, numbers and labels.
- Numbered everything: module.page lesson numbers (4.2), "Fig. 4.2" captions, "Module 4" headings, "Step 3 / 7".
- Flat: no shadows, no pills, no gradients on the page chrome.

## Colors

A monochrome ink-on-white document with a single oxide-blue accent; the figure palettes supply all other colour.

### Primary
- **Oxide Blue** (oxide-blue; oxide-blue-dark in dark): the header band, the Play button, the selected tab underline, figure numbers, lesson and module numbers, slider values, highlighted readout values, emphasised terms in the explanation, the tour hold bar and range-slider accent.
- **Oxide Blue Wash** (oxide-blue-soft): background of the lesson-number tag, the current lesson in the menu and the current step in "All steps".
- **Link Blue** (link): body links, "All steps" and "Sources" summaries, pager titles, the feedback link.
- **Focus Blue** (focus): the 2px focus outline (offset 2px) on every control; inside the band the outline switches to band text.

### Neutral
- **Ground / Surface** (ground, surface): page and control background; identical in light, separated in dark.
- **Bench Grey** (surface-2): hover fill on menu rows and step rows, `kbd` background.
- **Hairline** (hairline): row dividers, section rules, the pager frame, the "Enlarge figure" border.
- **Strong Rule** (rule-strong): control borders, the figure-plate border, module separators, the footer rule, thumbnail borders.
- **Ink** (ink): headings, body text, the 2px top rule of article sections, characteristics table and contents heading.
- **Ink 2** (ink-2): paragraph text inside sections, the lede, parameter labels.
- **Muted** (muted): step counter, chip numbers, speed label, lock hints, notes, footer.
- **Danger** (danger): warning values in the characteristics table only.

### Band
- **Band / Band Text / Band Muted / Band Line**: the sticky 48px header. Band Line is the 1px border of band controls and the fill of the lesson number inside the lesson button.

### Figure palettes (canvas, defined in assets/mfw.js)
The canvas does not read CSS. It draws through palette roles `C.*` (LIGHT and DARK: bg, text, white = strongest foreground, muted, axis, grid, and blue/teal/green/yellow/gold/red/maroon/purple/grey families with A-E steps) and material roles `MFW.MAT.*` (si, sio2, si3n4, poly, metal, gold, resist, chrome, ndoped, pdoped, glass, each with fill, stroke and label). The light palette is tuned so every line colour holds at least 3:1 against the white stage; the dark palette uses the same roles on the blue-black stage. Materials keep the same identity on every page: Si grey, SiO₂ blue, resist violet, n blue, p red.

### Named Rules
**The Roles-Only Rule.** No literal colour anywhere in page CSS or figure code: CSS uses the custom properties, canvases use `C.*` and `MFW.MAT.*`. A literal colour breaks the other theme.

**The One Accent Rule.** Oxide blue is the only chrome hue. Any other hue on screen belongs to a material or a plotted quantity in the figure.

## Typography

**Display Font:** none (headings use the text family)
**Body Font:** Archivo variable, self-hosted (weight 100-900, width 62-125 %, OFL), with Segoe UI, system-ui, Roboto, Helvetica Neue, Arial
**Label/Mono Font:** Archivo condensed (82-88 % width) for labels; `ui-monospace, Cascadia Mono, Consolas` only for `code` and `kbd`

**Character:** One grotesque used at two widths: normal width for reading, narrowed width for anything that is a number, a label or a heading, like the condensed heads of a datasheet. Tabular figures are on for the whole body.

### Hierarchy
- **Headline** (700, clamp(26px, 2.5vw, 36px), 1.15, width 92 %, -0.012em): the page H1, on lessons and on the overview. Balanced wrapping.
- **Title** (700, 21px, 1.25, width 92 %): section heads in the article below the figure. Contents heading 22px width 90 %; module titles 20px width 88 %; lesson tiles 18.5px width 92 %.
- **Lede** (400, 18px, 1.5; 16.5px on phones): one paragraph under the H1, max 72ch.
- **Body** (400, 17px, 1.55; 16px at 640px and below): paragraphs max 75ch, pretty wrapping. The explanation beside the figure is 16.5px.
- **UI text** (15-15.5px): controls, tables, parameter labels, references, footer. Captions 16px (15px on phones).
- **Label** (650, 13.5-15px, width 80-85 %): lesson and module numbers, step counter, step-list numbers, table heads, lock badges. Sentence case, never uppercase.
- **Figure number** (700, width 85 %, oxide blue): "Fig. 4.2" opening each caption.

### Named Rules
**The Narrow Numbers Rule.** Numbers that index or measure (4.2, Step 3 / 7, Module 4, slider values) are set condensed and semibold, with tabular figures, so columns align and nothing shifts as values change.

**The Sentence Case Rule.** Labels are sentence case. No uppercase tracked kickers or eyebrows above headings.

## Layout

- **Page:** max width 1680px, centred, horizontal padding clamp(16px, 3vw, 40px), 22px top, 56px bottom. Page head max 80ch.
- **Lesson, 1180px and wider:** two columns, figure left (fluid) and panel right (clamp(350px, 30vw, 600px); a panel 500px or wider sets the sliders in two columns), gap 18px 28px. The left column holds the figure plate and, under it, the characteristics table (a datasheet plate with its table); the right column holds the tour or the sliders. The left column is pinned 66px from the top while the panel scrolls, but only when it fits the viewport. Its width is capped by viewport height, (100svh - 170px) x aspect, so the whole plate fits on a 1280x720 projector.
- **Lesson, below 1180px with at least 560px of height:** one column; the figure sticks under the band (top 48px) at 42svh height with a hairline under it, and the panel scrolls beneath it.
- **Article below the figure:** auto-fit columns of at least 460px, column gap 48px; sections are separated by their 2px ink top rule, not by boxes. A section can span the full width.
- **Pager:** two halves between hairlines, the right half divided by a vertical hairline; stacks to one column at 640px.
- **Overview:** a factual H1 and one sentence (no hero), then "Contents" with a "14 lessons in 7 modules" count over a 2px ink rule, then one row per module: module heading in a 150-220px left column, a grid of lesson tiles (auto-fill, min 280px, gap 22px 26px) on the right; the heading goes above the grid at 720px and below.
- **Breakpoints:** 1180px (two-column lesson), 1100px (band drops the "Interactive" subtitle), 720px (module rows stack), 640px (phone: smaller body, crumb hidden, wordmark replaced by the µ mark, pager stacks), height 560px (sticky figure on narrow screens).
- **Spacing rhythm:** 4 / 8 / 12 / 16 / 28 / 48px, with 18-22px for page head and module padding.

## Elevation & Depth

Flat. No box shadows on page chrome. Depth is expressed by rules (1px hairline, 1px strong rule, 2px ink rule), by the Bench Grey hover fill and by the sticky band and sticky figure. The only overlays are the lesson menu (surface with a 1px strong-rule border, no shadow) and the full-screen figure (fixed, covering the page on the ground colour).

### Named Rules
**The Rule-Not-Box Rule.** Sections, tables and the pager are delimited by horizontal rules. Do not wrap content in shadowed or filled cards.

## Shapes

Square corners everywhere (radius 0): buttons, selects, tabs, tags, menu, figure plate, thumbnails. Borders are 1px; the selected tab uses a 3px bottom bar; section heads, the contents heading and the characteristics table use a 2px ink top rule. Icons are 24-unit line drawings with a 1.8 stroke and round caps (sun, moon, chevrons, play, pause, enlarge, close, lock), sized 1em.

## Components

### Buttons
- **Shape:** square (0px), 1px strong-rule border, surface fill, 15px text, 6px 12px padding.
- **Hover / Active:** border darkens to ink in 0.15s ease-out; press scales to 0.97 (removed under reduced motion).
- **Play:** filled oxide blue with ground-coloured text, semibold, minimum 96px, play/pause icon; hover mixes 12 % ink into the blue.
- **Back / Next:** standard buttons with chevron icons; disabled at 40 % opacity with a hairline border.
- **Enlarge figure:** quiet button under the plate (hairline border, ink-2 text, 14px, condensed), icon plus visible label at every width, including phones; becomes "Close" in full-screen view.
- **Theme toggle:** 34px square in the band, band-line border, sun/moon icon.

### Tabs
- Two equal tabs ("Guided tour", "Explore") over a strong rule; semibold condensed muted text; selected tab ink with a 3px oxide-blue bottom bar.

### Inputs / Fields
- **Range sliders:** native range input, full width, 22px tall, accent oxide blue. The label sits left and the live value right-aligned in oxide blue, semibold, in a fixed 7.5em x 1.4em box so the value never reflows the row.
- **Locked slider:** at 45 % opacity with a "set by the tour" lock badge; one lock hint above the sliders explains it.
- **Select:** same square border as buttons (speed 0.5x-2x).
- **Checkbox:** native, 17px, accent oxide blue.

### Navigation
- **Header band:** sticky, 48px, oxide-blue band. Wordmark (700, width 88 %) plus muted "Interactive"; the home link carries an aria-label. On lesson pages the lesson button shows the number tag and the current title ("4.2 Ion implantation") with a chevron.
- **Lesson menu:** square popover (min 290px, max min(92vw, 380px)), grouped by module with a number-and-title group head ("4 Doping"); rows show the number tag and title; current lesson in Oxide Blue Wash, semibold; ends with "Contents – all lessons". Opens with a 0.14s fade-and-drop; arrow keys move, Escape closes.
- **Pager:** "Previous · 4.1 Doping" / "Next · ..." in muted condensed small text over the link-blue title.
- **Footer:** strong rule above, muted 15px note and the "Suggest a topic or report an error" link.

### Figure plate (signature)
The canvas sits in a square-cornered plate with a 1px strong-rule border on the stage colour, sized to its aspect ratio (16:9 by default). Below it, never on it, a caption line starts with "Fig. m.p" in oxide blue; the caption line is always reserved (min 1.45em) and fades over 0.2s when it changes. Full-screen view fixes the plate and caption on the ground colour and adds Back / Next beside the caption. Labels inside the figure are placed by the engine's sticky placement helpers and audited for overlaps and movement. A figure that needs an on-plate switch uses the stage bar: small square buttons in a top corner on a translucent surface, the pressed one outlined in oxide blue.

### Tour panel (signature)
Order, top to bottom: tabs; stepper (Back | "Step n / N" over the step name, clamped to two lines with two lines always reserved | Next); Play and speed; a 2px hold bar that fills linearly while a step is held for reading; the explanation (16.5px, reserved height, emphasised terms in oxide blue); the collapsible "All steps (N)" list with numbered rows (done steps' numbers in oxide blue, current row in Oxide Blue Wash); the characteristics table; the lock hint; the sliders; "Sources & model notes". In Explore the sliders are the task: they follow the short intro directly and the characteristics table moves below them. In the tour the table keeps its place above the sliders and reserves only the height the current step needs over the free sliders' extremes.

### Characteristics table (signature)
Built by `MFW.chars(rows)`: columns Parameter · Symbol · Value · Unit under a condensed muted head row; "Characteristics" head (700, condensed) over a 2px ink rule; rows divided by hairlines and closed by a 1px ink rule. Formulas or conditions sit small and muted under the parameter, comments after the unit; one key value per table in oxide blue bold, warnings in danger as full-width rows. Values right-aligned with tabular figures. Under the figure the table is at most 780px wide; on narrow screens it sits in the panel. In the tour its height is reserved for the current step over the free sliders' extremes and options, so it never moves the sliders below it; in Explore it sits below the sliders.

### Lesson tiles (overview)
A 16:9 miniature of the lesson's real figure (light and dark versions, swapped by theme) in a strong-rule frame, then number and title, then one sentence in ink-2. Hover darkens the frame to ink and underlines the title.

## Navigation

Under the header band sits the course map: one row with the nine modules (number in the module colour, the current one underlined in it) and, on a lesson page, a second row with the lessons of that module (the current one filled with the module colour). Both rows scroll sideways on a phone and bring the current item into view. The band keeps the lesson menu and stays sticky; the course map scrolls away with the page.

A lesson opens in its tour, the tab “Challenges”; “Explore” is the second tab.

## Page order

A lesson reads top to bottom as: title and one-paragraph lede, the figure with its panel, then one column of folding sections (equations, exercises, limitations, references; closed at first, top rule in the module colour), then the links to the previous and next lesson. The process game puts the game first and its work order in the first folding section, open by default (`data-fold="open"` on a card).

## Module colours

Added 2026-11-28 at the owner's request, to give the pages more colour without touching the figures. One hue per module (`--m-base`, `--m-substrate`, `--m-litho`, `--m-doping`, `--m-films`, `--m-etch`, `--m-metal`, `--m-char`, `--m-game` in `assets/mfw.css`, light and dark values from the figure palette, each at least 4.5:1 on its ground). `data-module` on `<body>` (lesson pages) or on a module section (contents page) sets `--mod`.

It is used for: the 4 px stripe under the header band, the lesson-number chip, the bar beside the page title, the top rule of the cards, the figure number, the step dots and the selected tab of a tour, the bar beside a module and under its thumbnails on the contents page, progress bars, and the badges. Text set on a module colour uses `--on-mod`.

It is not used for body text, links, sliders, buttons or anything inside a figure.

## Progress panel

Points, ranks and badges are a layer the reader can switch off. A new badge, a finished tour and a new rank are announced by a pop-up in the lower right corner (the one element with a shadow, because it floats over the page) and by a short synthesised chime; a point gives a soft tick and a flash of the header chip. Sound can be switched off in the progress panel. Where the reader has to act, a filled tag in the module colour says so (“Your turn”, “Your input”) together with what the step is worth; never use a coloured side stripe for this. Badges are round medallions filled with the colour of their family (a module, the process game, or oxide blue for the general ones) and carry a mark of letters or digits; a badge not yet earned is a dashed outline. No emoji, no glyph icons.

## Do's and Don'ts

### Do:
- **Do** colour through roles only: CSS custom properties on the page, `C.*` and `MFW.MAT.*` on the canvas.
- **Do** reserve the height of anything whose text changes (caption, step title, explanation, readout, slider value) so the layout stays still while a slider moves.
- **Do** number lessons module.page and caption every figure "Fig. m.p".
- **Do** separate content with rules: 1px hairlines between rows, a 2px ink rule over each section and table.
- **Do** use condensed Archivo with tabular figures for numbers, labels and table heads.
- **Do** keep controls standard and square, with a visible 2px focus outline.
- **Do** use the real figure for every overview miniature, never a drawn illustration.

### Don't:
- **Don't** round corners, use pills or add shadows to page chrome.
- **Don't** add uppercase kickers, eyebrows or a marketing hero; the overview opens with a factual title.
- **Don't** introduce a second chrome accent beyond the module colours; other hues belong to the figure. Module colours never carry body text, links or controls.
- **Don't** round corners – with two exceptions that are round by nature: the numbered step dots of a tour and the badges of the progress panel.
- **Don't** put the caption or panel controls on top of the drawing; they go below the plate or in the panel. The only on-plate controls are the small corner stage-bar toggles a figure may need.
- **Don't** use glyph or emoji icons; use the line-icon set.

## Open items

Recorded as not yet done in the build:
- The characteristics table is still two columns (Parameter | Value). The intended form is four columns, Parameter · Symbol · Value · Unit, with a conditions line above the table; neither exists yet.
- The feedback link opens a Google Form (no account needed, built by `tools/feedback-form.gs`); on lesson pages the "Lesson" question is pre-filled with the lesson number and title.
- The site name and the µ mark shown on phones are open decisions and should not be treated as fixed identity.
