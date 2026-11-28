/* Negative resist: exposure without bleaching, cross-linking in the post-exposure bake, development and undercut.
   Topic: lithography. */
(function () {
  const { C, M, fmt } = MFW;
  const NG = MFW_NEG, LI = MFW_LITHO;
  const NX = 41, NZ = 32, LAMBDA = 0.365;
  const DOSES = M.linspace(0, 2, 17).map(q => 10 ** q);                      // 1 … 100 gel doses for the width curves
  const um = x => (Math.abs(x) >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.num(x * 1000, 0)} nm`);
  const gd = x => `${fmt.sig(x, 2)} × gel dose`;
  const pct = x => `${fmt.num(100 * x, 0)} %`;
  const STAGES = { exp: 'After the exposure', peb: 'After the post-exposure bake', dev: 'After development' };

  let kImg = null, img = null, kSet = null, set = null, kRun = null, run = null;
  function compute(v) {
    const ki = [v.hp, v.d].join('|');
    if (ki !== kImg) { img = LI.aerialImage({ mode: 'proximity', lambda: LAMBDA, hp: v.hp, xs: M.linspace(0, v.hp, NX), gap: 0, resist: v.d, collimation: 2 }); kImg = ki; }
    const o = { I: img, X: v.hp, d: v.d, kappa: v.kappa, delta: v.delta, nz: NZ };
    const ks = [ki, v.kappa, v.delta, v.tau].join('|');
    if (ks !== kSet) {
      set = DOSES.map(E => { const q = NG.measure(NG.process({ ...o, E }), v.tau); return { E, top: q.gone ? 0 : 2 * q.tip / v.hp, foot: q.gone ? 0 : 2 * q.foot / v.hp }; });
      kSet = ks;
    }
    const kr = ks + '|' + v.E;
    if (kr !== kRun) { run = NG.process({ ...o, E: v.E }); kRun = kr; }
    const q = NG.measure(run, v.tau);
    const zx = NG.depthX(v.E, v.kappa, v.delta);
    return { R: run, q, set, zx, reach: zx >= v.d, need: NG.doseFor(v.d, v.kappa || 1e-9, v.delta), bottom: Math.exp(-v.d / v.delta),
      under: q.under, gamma: q.gamma, lifted: q.lifted, gone: q.gone, open: q.open, lineTop: 2 * q.tip, lineFoot: 2 * q.foot, wTop: q.wTop };
  }
  const state = v => (v.gone ? 'nothing is cross-linked: the resist is gone' : v.lifted ? 'the lines have lost their footing' : !v.open ? 'the opening is not clear'
    : v.under > 0.02 ? `undercut ${um(v.under)}` : 'nearly vertical sidewalls');

  MFW.widget('#app', {
    title: 'Negative resist: cross-linking and undercut',
    alt: v => `Cross-section of a negative resist ${um(v.d)} thick with ${um(v.hp)} lines and spaces, ${STAGES[v.stage].toLowerCase()}. Dose ${gd(v.E)}, penetration depth ${um(v.delta)}, bake completeness ${pct(v.kappa)}: a large area would be cross-linked to a depth of ${um(v.zx)}; ${state(v)}.`,
    source: 'Exposure without bleaching (Beer–Lambert law) with the penetration depth of 1–2 µm given for the AZ nLOF 2000 series at the i-line; process sequence and trends after MicroChemicals GmbH, application notes “Processing of AZ negative resists” and “Post exposure bake”. Assumptions of this page: one sharp threshold (the gel dose) separates soluble from cross-linked resist, the developer does not attack cross-linked resist, and the completeness κ of the bake is a free parameter. Doses are given in gel doses and times in units of the time that clears an unexposed film, because no absolute values were found for a specific resist. The mask and the light arrows are schematic; the cross-section is to scale.',
    freeText: v => `Explore – ${state(v)}. Make the resist thicker and see which dose still cross-links it down to the substrate, then raise the dose until the lines grow into the spaces.`,

    params: {
      E: { value: 8, min: 1, max: 100, log: true, label: 'Exposure dose', format: gd },
      kappa: { value: 1, min: 0, max: 1, step: 0.05, label: 'Post-exposure bake: completeness of the cross-linking <i>κ</i>', format: pct },
      tau: { value: 1.5, min: 0.5, max: 4, step: 0.1, label: 'Development time (1 = unexposed film just cleared)', format: x => `${fmt.num(x, 1)} ×` },
      d: { value: 3, min: 1, max: 8, step: 0.5, label: 'Resist thickness <i>d</i>', format: um, group: 'Resist and pattern' },
      delta: { value: 1.5, min: 1, max: 2, step: 0.1, label: 'Penetration depth of the light <i>δ</i>', format: um, group: 'Resist and pattern' },
      hp: { value: 4, min: 2, max: 8, step: 0.5, label: 'Lines and spaces', format: um, group: 'Resist and pattern' },
      stage: { value: 'dev', label: 'Show the resist', options: STAGES },
    },

    derived: compute,

    tex: [
      { at: [0, 3.42], tex: 'E(z) = E\\,e^{-z/\\delta}, \\qquad \\text{cross-linked where } \\kappa E(z) \\ge E_{gel}, \\qquad z_x = \\delta\\,\\ln\\!\\frac{\\kappa E}{E_{gel}}', size: 0.31 },
    ],

    draw(p, v, w) {
      const R = v.R, q = v.q, d = v.d, hp = v.hp;
      // ---------------------------------------------------------- cross-section, to scale; the opening is in the middle
      const X0 = -6.6, X1 = -0.25, XC = (X0 + X1) / 2, TOP = 2.85, ySub = -1.75;
      const k = w.smooth('k', Math.min((X1 - X0) / (2 * hp), 2.35 / d), { log: true });           // scene units per µm
      const yRes = ySub + d * k, half = (X1 - X0) / 2 / k, sx = u => XC + u * k;                  // half = half width of the view in µm
      const fold = u => { const a = Math.abs(u) % (2 * hp); return a > hp ? 2 * hp - a : a; };   // distance from the centre of an opening
      const sw = (x, fill, label, a) => { p.box(x, TOP - 0.2, x + 0.22, TOP - 0.04, { fill: MFW.MAT.resist.fill, stroke: null }); if (fill) p.box(x, TOP - 0.2, x + 0.22, TOP - 0.04, { fill, fillAlpha: a, stroke: null }); p.text(label, x + 0.3, TOP - 0.12, { size: 0.18, color: C.text }); };
      sw(X0, null, 'not cross-linked, soluble'); sw(X0 + 2.75, C.yellow, 'exposed (acid formed)', 0.75); sw(X0 + 5.0, C.blue, 'cross-linked', 0.8);
      p.text(`${STAGES[v.stage].toLowerCase()} · resist to scale`, X0, TOP - 0.5, { size: 0.18, color: C.muted });

      const yM = yRes + 0.75;
      if (v.stage === 'exp') {
        p.clip(X0, yRes, X1, yM + 0.3, () => {
          p.material('glass', X0, yM + 0.1, X1, yM + 0.24, { stroke: null });
          for (let n = -6; n <= 6; n++) p.box(sx(2 * hp * n - hp / 2), yM, sx(2 * hp * n + hp / 2), yM + 0.1, { fill: MFW.MAT.chrome.fill, stroke: null });
          const n = Math.max(6, Math.round((X1 - X0) / 0.45));
          for (let i = 0; i < n; i++) { const u = -half + (i + 0.5) * 2 * half / n; if (fold(u) > hp / 2 + 0.12 * hp) p.arrow(sx(u), yM - 0.06, sx(u), yRes + 0.08, { color: C.purple, width: 1.8, head: 0.1 }); }
        });
        p.text('mask (schematic)', X1, yM + 0.42, { size: 0.17, align: 'right', color: C.muted });
      }
      p.material('si', X0, ySub - 0.45, X1, ySub, { stroke: null });
      p.clip(X0, ySub, X1, yRes + 0.02, () => {
        p.material('resist', X0, ySub, X1, yRes, { stroke: null });
        const rows = 16, dz = d / rows, cols = 64, du = 2 * half / cols;
        for (let a = 0; a < cols; a++) {
          const u = -half + (a + 0.5) * du, i = Math.round((hp - fold(u)) / R.hx);              // model column: 0 = centre of the exposed line
          for (let j = 0; j < rows; j++) {
            const n = Math.round((j + 0.5) * NZ / rows) * NX + i, e = R.e[n];
            const x = sx(u - du / 2), y = yRes - (j + 1) * dz * k;
            if (v.stage === 'exp' && e > 0.03) p.rect(x, y, du * k * 1.03, dz * k * 1.03, { fill: C.yellow, fillAlpha: 0.8 * e / (1 + e), stroke: null, noOcc: true });
          }
        }
        if (v.stage !== 'exp') {
          // cross-linked region: in every column down to the depth where κ·E·I(x)·exp(−z/δ) = 1
          const n = 240, top = [], bot = [];
          for (let a = 0; a <= n; a++) {
            const u = -half + 2 * half * a / n, xq = (hp - fold(u)) / R.hx, i = Math.min(NX - 2, Math.floor(xq)), fr = xq - i;
            const I = R.e[i] + (R.e[i + 1] - R.e[i]) * fr;                                       // surface dose in gel doses
            const z = v.kappa * I > 1 ? Math.min(d, v.delta * Math.log(v.kappa * I)) : 0;
            top.push([sx(u), yRes]); bot.push([sx(u), yRes - z * k]);
          }
          p.polygon(top.concat(bot.reverse()), { fill: C.blue, fillAlpha: 0.8, stroke: null, noOcc: true });
        }
        if (v.stage === 'dev') {
          // developed region of every opening in view: between the resist edges, row by row
          for (let n = -3; n <= 3; n++) {
            const c = 2 * hp * n, left = [], right = [];
            if (Math.abs(c) - hp > half) continue;
            for (let j = 0; j <= NZ; j++) { const hw = hp - q.e[j], y = yRes - j * R.hz * k; left.push([sx(c - hw), y]); right.push([sx(c + hw), y]); }
            p.polygon([[left[0][0], yRes + 0.05], ...left, [left[NZ][0], ySub - 0.05], [right[NZ][0], ySub - 0.05], ...right.reverse(), [right[0][0], yRes + 0.05]], { fill: C.bg, stroke: null, noOcc: true });
          }
        }
      });
      const good = !v.gone && !v.lifted && v.open;
      p.text(v.stage === 'dev' ? state(v) : v.stage === 'exp' ? `dose at the substrate: ${pct(v.bottom)} of the dose at the surface` : v.reach ? `cross-linked down to the substrate` : `cross-linked to a depth of ${um(v.zx)} of ${um(d)}`,
        X0, ySub - 0.72, { size: 0.2, bold: true, color: v.stage === 'exp' ? C.text : v.stage === 'peb' ? (v.reach ? C.green : C.gold) : !good ? C.red : C.green });

      // ---------------------------------------------------------- dose against depth in the middle of a line
      const key = (x, y, color, dash, label) => { p.line(x, y, x + 0.4, y, { color, width: 3, dash }); p.text(label, x + 0.5, y, { size: 0.17, color }); return x + 0.75 + p.measure(label, 0.17); };
      const a1 = p.axes({ x: 1.1, y: 0.7, w: 5.45, h: 1.7, xr: [0, 8], yr: [0.1, 100], ylog: true, grid: true, size: 0.18,
        xticks: [0, 2, 4, 6, 8], yticks: [0.1, 1, 10, 100], yfmt: y => String(y), xlabel: 'depth below the resist surface (µm)', ylabel: 'κ·E / gel dose', ylabelOffset: 0.72 }).draw();
      const zs = M.linspace(0, d, 33), keff = Math.max(v.kappa, 1e-6);
      p.clip(a1.x, a1.y, a1.x + a1.w, a1.y + a1.h, () => {
        a1.hline(1, { color: C.muted, width: 1.5 });
        a1.vline(d, { color: C.muted, width: 1.5 });
        a1.curve(zs, zs.map(z => Math.max(0.1, keff * v.E * Math.exp(-z / v.delta))), { color: C.blue, width: 4 });
      });
      p.text('in the middle of an exposed line', a1.x, a1.y + a1.h + 0.4, { size: 0.17, color: C.text, bold: true });
      key(a1.x, a1.y + a1.h + 0.15, C.blue, undefined, 'dose after the bake factor; dashed: gel dose and substrate');

      // ---------------------------------------------------------- line width against dose
      const a2 = p.axes({ x: 1.1, y: -2.45, w: 5.45, h: 1.8, xr: [1, 100], xlog: true, yr: [0, 2], grid: true, size: 0.18,
        xticks: [1, 3, 10, 30, 100], xfmt: x => String(x), yticks: [0, 0.5, 1, 1.5, 2], yfmt: y => fmt.num(y, 1), xlabel: 'exposure dose (gel doses)', ylabel: 'width / mask line', ylabelOffset: 0.72 }).draw();
      p.clip(a2.x, a2.y, a2.x + a2.w, a2.y + a2.h, () => {
        a2.hline(1, { color: C.muted, width: 1.5 });
        a2.vline(v.E, { color: C.muted, width: 1.5 });
        a2.curve(v.set.map(s => s.E), v.set.map(s => s.foot), { color: C.purple, width: 3, dash: [0.12, 0.08] });
        a2.curve(v.set.map(s => s.E), v.set.map(s => s.top), { color: C.green, width: 4 });
      });
      const kx = key(a2.x, a2.y + a2.h + 0.15, C.green, undefined, 'resist line at its widest');
      key(kx, a2.y + a2.h + 0.15, C.purple, [0.12, 0.08], 'at the substrate');
    },

    readout: v => MFW.chars([
      ['profile after development', '', v.gone ? 'no resist' : v.lifted ? 'lines lifted' : !v.open ? 'not open' : um(v.under), undefined, { hl: true, note: v.gone || v.lifted || !v.open ? '' : `undercut, ${fmt.num(v.gamma, 0)}° from the vertical` }],
      ['depth of cross-linking under a large area', 'z_x', um(v.zx), undefined, { f: 'δ·ln(κE/E_gel)', note: v.reach ? 'reaches the substrate' : `resist is ${um(v.d)} thick` }],
      ['dose that cross-links down to the substrate', '', gd(v.need), undefined, { f: 'e^(d/δ)/κ' }],
      ['dose at the substrate', '', pct(v.bottom), undefined, { f: 'e^(−d/δ)', note: 'of the surface dose' }],
      ['resist line, widest / at the substrate', '', v.gone ? '–' : `${fmt.sig(v.lineTop, 3)} / ${fmt.sig(v.lineFoot, 3)} µm`, undefined, { note: `mask: ${um(v.hp)}` }],
      ['opening at its narrowest', '', v.gone ? '–' : um(Math.max(0, v.wTop))]]),

    steps: [
      { name: 'Exposure', caption: 'The exposed areas will stay; the light fades with depth', set: { E: 8, kappa: 1, tau: 1.5, d: 3, delta: 1.5, hp: 4, stage: 'exp' }, duration: 1.5,
        text: v => `In a negative resist the exposed areas stay and the unexposed areas are developed away. The exposure forms an acid in the resist. Unlike a positive resist, this resist does not bleach: it absorbs as strongly at the end of the exposure as at the start, so the dose falls off exponentially with depth. With a penetration depth of ${um(v.delta)}, the bottom of this ${um(v.d)} film gets ${pct(v.bottom)} of the dose at the surface.` },
      { name: 'Post-exposure bake', caption: 'The bake cross-links the resin where acid was formed', from: { stage: 'dev', kappa: 1 }, set: { kappa: 0 }, duration: 2.5,
        ask: { q: 'After the exposure the wafer is baked at 110–125 °C for one to two minutes, and the developed lines look as shown. What comes out of the developer if this bake is left out?',
          options: ['The same lines: the exposure alone hardens the resist', 'Nothing: the exposed resist dissolves about as fast as the unexposed', 'The lines, but with vertical sidewalls'], correct: 1 },
        text: v => `The exposure only forms the acid. The cross-linking of the resin, which makes it insoluble, happens in the post-exposure bake; without it the exposed resist dissolves at about the same rate as the unexposed (MicroChemicals). A cooler or shorter bake cross-links less. This page describes the bake by one number, κ, and here κ = ${pct(v.kappa)}: ${state(v)}.` },
      { name: 'Thick films', caption: v => `Cross-linking reaches ${um(v.zx)} into a ${um(v.d)} film`, set: { E: 8, kappa: 1, tau: 2, d: 5, delta: 1.5, hp: 4, stage: 'dev' }, duration: 1,
        task: 'This film is 5 µm thick, and the dose that worked for 3 µm no longer cross-links it down to the substrate: the lines stand on soluble resist and are washed away. Increase the <b>Exposure dose</b> until the lines stay.',
        goal: v => !v.lifted && !v.gone && v.open, solution: { E: 32 },
        text: v => `Because the resist does not bleach, every additional penetration depth of thickness needs e ≈ 2.7 times the dose: z_x = δ·ln(κE/E_gel). For ${um(v.d)} the dose has to exceed ${gd(v.need)}; it is ${gd(v.E)} now. Very thick films of such a resist cannot be exposed down to the substrate at all, and that is used on purpose: the soluble resist near the substrate gives a strongly undercut profile for lift-off (MicroChemicals).` },
      { name: 'Undercut', caption: 'The cross-linked region narrows with depth', set: { E: 8, kappa: 1, tau: 1.5, d: 3, delta: 1.5, hp: 4, stage: 'peb' }, duration: 1.5,
        text: v => `At the edge of a line the light intensity falls off sideways, and with depth it falls off everywhere. The boundary of the cross-linked region therefore moves towards the middle of the line as it goes down (blue in the figure), and the developed line is wider at the top than at the substrate: an undercut of ${um(v.under)} here. No second exposure and no particular development time are needed for it, as they are with an image reversal resist.` },
      { name: 'Development time', caption: 'Cross-linked resist does not dissolve: longer development changes little', from: { stage: 'dev', tau: 1.5, E: 8, d: 3 }, set: { tau: 3 }, duration: 2.5,
        ask: { q: 'These lines were developed for 1.5 times the time that clears the unexposed film. What happens to the undercut if the development runs twice as long?',
          options: ['It grows steadily, as with an image reversal resist', 'It stays almost the same: the cross-linked resist does not dissolve', 'The lines are washed away'], correct: 1 },
        text: v => `Once the soluble resist is gone the profile is fixed by the cross-linked region, so the development time is not critical: the undercut is still ${um(v.under)}. In this model the cross-linked resist does not dissolve at all. A real resist that is weakly cross-linked, after a low dose or a cool bake, erodes slowly, so the result is less sharp than shown. An image reversal resist behaves differently, there the undercut keeps growing with development time.` },
      { name: 'Too much light', caption: v => `The line is ${fmt.sig(v.lineTop / v.hp, 2)} times as wide as on the mask`, from: { hp: 2, d: 3, E: 8, tau: 1.5, stage: 'dev' }, set: { E: 100 }, duration: 2.5,
        ask: { q: 'Lines and spaces are now 2 µm. The dose is raised from 8 to 100 gel doses. What happens to the spaces between the lines?',
          options: ['Nothing, extra dose cannot do harm in a negative resist', 'They become narrower: stray light cross-links the edges of the dark areas', 'They become wider'], correct: 1 },
        text: v => `Diffraction puts a little light into the areas that the mask keeps dark. At a high dose that small share is enough to reach the gel dose, so the lines grow into the spaces: the line is now ${um(v.lineTop)} wide instead of ${um(v.hp)}, and the opening is ${um(Math.max(0, v.wTop))} at its narrowest. With more dose still, narrow openings can no longer be cleared (MicroChemicals). Scattering and reflection from the substrate add to this and are not modelled.` },
      { name: 'After the lithography', caption: 'Cross-linked resist is stable and hard to remove', set: { E: 8, kappa: 1, tau: 1.5, d: 3, delta: 1.5, hp: 4, stage: 'dev' }, duration: 1.5,
        text: 'Cross-linking has two consequences beyond the profile. The lines do not soften and round when they are heated, for example during the evaporation of a metal, which keeps the undercut intact for lift-off; the temperature should still stay below about 140–150 °C, because the cross-linking goes on and the resist becomes very hard to lift. For the same reason the resist is harder to strip than a positive one: solvents such as NMP or DMSO are used hot, at 60–80 °C, or special strippers for highly cross-linked films (MicroChemicals).' },
      { name: 'Your turn', caption: 'Find a profile for lift-off', duration: 1,
        text: 'Switch to <b>Explore</b>: for a 4 µm film with 3 µm lines and spaces, find the dose that just cross-links down to the substrate, then see how the undercut and the line width change when the penetration depth is 1 µm instead of 2 µm.' },
    ],
  });
}());
