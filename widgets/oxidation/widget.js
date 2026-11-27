/* Thermal oxidation of silicon – Deal–Grove model. Topic: oxidation. */
(function () {
  const { C, M, fmt } = MFW;
  const OX = MFW_OX;
  const AMB = { dry: 'dry O₂', wet: 'wet (H₂O)' };

  const nm = um => um * 1000;
  const thk = um => (um < 1 ? `${fmt.sig(nm(um), 3)} nm` : `${fmt.sig(um, 3)} µm`);
  const tickT = h => (h < 1 ? `${Math.round(h * 60)} min` : `${h} h`);
  const tickX = um => (um < 1 ? `${Math.round(um * 1000)} nm` : `${um} µm`);
  const barX = um => (um < 1 ? `${+(um * 1000).toPrecision(2)} nm` : `${+um.toPrecision(2)} µm`);   // scale bar: 0.4 nm, 4 nm, 40 nm …

  MFW.widget('#app', {
    title: 'Thermal oxidation of silicon',
    alt: v => `Deal–Grove oxidation, ${AMB[v.amb]} at ${fmt.num(v.T, 0)} °C on (${v.ori}) silicon: after ${fmt.hours(v.t)} the oxide is ${thk(v.x)} thick, consuming ${thk(v.xsi)} of silicon.`,
    source: 'Deal–Grove model (B. E. Deal, A. S. Grove, J. Appl. Phys. 36 (1965) 3770) with the rate constants of J. D. Plummer, M. D. Deal, P. B. Griffin, <i>Silicon VLSI Technology</i> (2000), Table 6-2: dry O₂ at 1 atm, wet = H₂O steam (row “H₂O”, which agrees with Deal &amp; Grove’s 640-torr wet data within ≈ 15 %); (100) Si: linear-rate prefactor divided by 1.68. Dry oxidation uses the textbook convention (Plummer et al.) of a 25 nm starting offset – Deal &amp; Grove themselves adopted 23 nm – that absorbs the fast initial regime, so thicknesses below ~25 nm are not modelled and dry growth below ~950 °C is overestimated compared with measured furnace charts (e.g. EPFL CMI: ≈ 1.5× at 900 °C, more at lower temperature and short times). Oxide colour: normal-incidence thin-film interference (SiO₂ index: Malitson 1965; Si n, k: Green 2008), CIE 1931 observer, daylight; screen colours are approximate.',
    freeText: 'Explore – try to grow 100 nm of dense dry oxide and 1 µm of thick (field or masking) oxide. Which ambient and temperature would you choose, and how long does it take?',

    params: {
      amb: { value: 'dry', label: 'Ambient', options: { dry: 'Dry O₂ (1 atm)', wet: 'Wet – H₂O steam' } },
      ori: { value: '100', label: 'Wafer orientation', options: { 100: '(100)', 111: '(111)' } },
      T: { value: 1000, min: 800, max: 1200, step: 5, label: 'Temperature <i>T</i>', unit: '°C', digits: 0 },
      t: { value: 1, min: 1 / 60, max: 100, log: true, label: 'Oxidation time <i>t</i>', format: h => fmt.hours(h) },
      x0: { value: 0, min: 0, max: 0.5, step: 0.005, label: 'Starting oxide <i>x</i>_i', format: um => `${fmt.num(nm(um), 0)} nm` },
      target: { value: 0.1, min: 0.02, max: 5, log: true, label: 'Target thickness (for the time calculation)', format: um => thk(um) },
    },
    layers: { limits: false, target: false, compare: false },
    explore: { show: ['limits', 'target'] },

    derived(v) {
      const r = OX.rates(v.amb, v.T, v.ori);
      const xs = OX.startThickness(v.amb, v.x0), tau = OX.tauOf(r, xs);
      const x = OX.thickness(r, v.t, tau);
      const tTarget = OX.timeTo(r, v.target, tau);
      const other = OX.rates(v.amb === 'dry' ? 'wet' : 'dry', v.T, v.ori);
      const otherXs = OX.startThickness(v.amb === 'dry' ? 'wet' : 'dry', v.x0);
      return { ...r, xs, tau, x, xsi: OX.SI_CONSUMED * (x - v.x0), tTarget, other, otherTau: OX.tauOf(other, otherXs), rgb: OX.oxideRGB(nm(x)) };
    },

    tex: [
      { at: [0, 3.45], tex: 'x_{ox}^2 + A\\,x_{ox} = B\\,(t+\\tau)\\qquad B = {{B:sci2}}\\ \\mathrm{\\mu m^2/h},\\quad B/A = {{BA:sci2}}\\ \\mathrm{\\mu m/h}', size: 0.38 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- wafer colour
      const [r, g, b] = v.rgb, wc = `rgb(${r},${g},${b})`;
      const cx = -4.35, cy = 1.25, R = 1.25;
      const af = Math.asin(0.45 / R), wafer = [];                          // wafer outline with the primary flat at the bottom
      for (let i = 0; i <= 90; i++) { const a = -Math.PI / 2 + af + (2 * Math.PI - 2 * af) * i / 90; wafer.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      p.polygon(wafer, { fill: wc, stroke: C.greyB, width: 2 });
      p.text(`${thk(v.x)} SiO₂`, cx, cy, { size: 0.3, align: 'center', color: (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#111' : '#f4f4f4' });
      p.text('colour seen at normal incidence', cx, cy - R - 0.25, { size: 0.21, align: 'center', color: C.muted });

      // ---------------------------------------------------------- cross-section (auto zoom in 1–2–5 steps: the oxide
      // always fills 30–80 % of the box, instead of shrinking to a sliver at every decade)
      const spanT = w.nice('spanT', [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20], v.x / 0.8);   // full height of the drawing in µm
      const span = w.smooth('span', spanT, { log: true });              // glide between zoom levels instead of jumping
      const x0 = -6.6, x1 = -2.1, yTopBox = -0.55, yBotBox = -2.95, h = yTopBox - yBotBox;
      const ySurf = yBotBox + 0.55 * h;                                   // original Si surface
      const k = h / span;                                                 // scene units per µm
      const below = OX.SI_CONSUMED * v.x, above = v.x - below;
      p.clip(x0, yBotBox, x1, yTopBox, () => {
        p.material('si', x0, yBotBox, x1, ySurf - below * k);
        p.material('sio2', x0, ySurf - below * k, x1, ySurf + above * k);
      });
      p.box(x0, yBotBox, x1, yTopBox, { stroke: C.axis, width: 1.5 });
      p.line(x0, ySurf, x1, ySurf, { color: C.text, width: 2, dash: [0.1, 0.08] });
      p.place('original Si surface', [[x1 - 0.08, ySurf + 0.08, 'right', 'bottom'], [x1 - 0.08, ySurf - 0.08, 'right', 'top'],
        [x1 - 0.08, ySurf + above * k + 0.08, 'right', 'bottom'], [x1 - 0.08, ySurf - below * k - 0.08, 'right', 'top']],
        { size: 0.2, color: C.text, key: 'surf', within: [x0, yBotBox, x1, yTopBox] });
      if (above * k > 0.34) p.text('SiO₂', x0 + 0.12, ySurf + above * k / 2, { size: 0.24, color: C.text });
      if (below * k > 0.3) {
        const xd = x0 + 1.75;
        p.dim(xd, ySurf + above * k, xd, ySurf, '54 %', { offset: 0.12, align: 'left', size: 0.2 });
        p.dim(xd, ySurf, xd, ySurf - below * k, '46 %', { offset: 0.12, align: 'left', size: 0.2 });
      }
      p.text('Si', x0 + 0.12, yBotBox + 0.25, { size: 0.24, color: C.text });
      // scale bar
      const sb = spanT / 5;
      p.line(x1 - 0.25, yBotBox + 0.2, x1 - 0.25, yBotBox + 0.2 + sb * k, { color: C.white, width: 3 });
      const yb0 = yBotBox + 0.2, yb1 = yBotBox + 0.2 + sb * k;
      p.place(barX(sb), [[x1 - 0.35, (yb0 + yb1) / 2, 'right'], [x1 - 0.35, yb1 - 0.02, 'right', 'top'], [x1 - 0.35, yb0 + 0.02, 'right', 'bottom'], [x1 - 0.35, yb1 + 0.06, 'right', 'bottom']],
        { size: 0.2, color: C.text, key: 'sbar', within: [x0, yBotBox, x1, yTopBox] });
      p.text('cross-section (to scale)', (x0 + x1) / 2, yBotBox - 0.22, { size: 0.21, align: 'center', color: C.muted });

      // ---------------------------------------------------------- growth curve, log–log
      const ax = p.axes({ x: 0.55, y: -2.7, w: 6.0, h: 5.4, xr: [1 / 60, 100], yr: [0.001, 10], xlog: true, ylog: true, grid: true, size: 0.24,
        xticks: [1 / 60, 10 / 60, 1, 10, 100], xfmt: tickT, yticks: [0.001, 0.01, 0.1, 1, 10], yfmt: tickX,
        xlabel: 'oxidation time t  (log scale)', ylabel: 'oxide thickness  (log scale)', ylabelOffset: 1.2 }).draw();
      const DASH_LIN = [0.12, 0.09], DASH_PAR = [0.03, 0.07], DASH_TGT = [0.08, 0.08];
      p.layer('limits', () => {
        ax.plot(t => v.BA * (t + v.tau), { color: C.teal, width: 2.5, dash: DASH_LIN });
        ax.plot(t => Math.sqrt(v.B * (t + v.tau)), { color: C.purple, width: 2.5, dash: DASH_PAR });
      });
      p.layer('compare', () => ax.plot(t => OX.thickness(v.other, t, v.otherTau), { color: C.grey, width: 3 }));
      ax.plot(t => OX.thickness(v, t, v.tau), { color: C.yellow, width: 4.5 });
      p.layer('target', () => {
        ax.hline(v.target, { color: C.gold, dash: DASH_TGT });
        if (v.tTarget > 0 && v.tTarget <= 100) ax.dot(Math.max(v.tTarget, 1 / 60), v.target, { color: C.gold, r: 0.08 });
      });
      ax.dot(v.t, v.x, { r: 0.11 });
      // legend in the lower right corner: no oxide is that thin after hours, so no curve can pass there
      ax.legend([
        { label: `Deal–Grove, ${AMB[v.amb]}${v.amb === 'dry' && v.x0 < 0.025 ? ' (from 25 nm)' : ''}`, color: C.yellow, width: 4 },
        { label: 'linear (B/A)(t+τ)', color: C.teal, dash: DASH_LIN, alpha: p.vis('limits') },
        { label: 'parabolic √(B(t+τ))', color: C.purple, dash: DASH_PAR, alpha: p.vis('limits') },
        { label: `${v.amb === 'dry' ? 'wet' : 'dry'}, for comparison`, color: C.grey, textColor: C.greyA, alpha: p.vis('compare') },
        { label: `target ${thk(v.target)}`, color: C.gold, dash: DASH_TGT, alpha: p.vis('target') },
      ], { corner: 'br', size: 0.19 });
      if (p.vis('target') > 0.01 && v.tTarget > 0 && v.tTarget <= 100) {
        p.alpha(p.vis('target'), () => ax.place(`t = ${fmt.hours(v.tTarget)}`, ax.around(Math.max(v.tTarget, 1 / 60), v.target, 0.12).concat(ax.around(Math.max(v.tTarget, 1 / 60), v.target, 0.32), ax.around(Math.max(v.tTarget, 1 / 60), v.target, 0.6), [[ax.x + 0.12, ax.Y(v.target) + 0.12, 'left', 'bottom'], [ax.x + 0.12, ax.Y(v.target) - 0.12, 'left', 'top']]), { color: C.gold, size: 0.21, key: 'ttarget' }));
      }
    },

    readout: v => {
      const tt = v.tTarget;
      return MFW.chars([
        ['oxide thickness', 'x<sub>ox</sub>', thk(v.x), undefined, { hl: true }],
        ['Si consumed', '', thk(v.xsi), undefined, { f: '0.46·Δx' }],
        ['linear–parabolic constant', 'A', `${fmt.sig(v.A, 3)} µm`, undefined, { f: 'B/(B/A)' }],
        ['time offset for the starting oxide', 'τ', v.tau === 0 ? '0' : fmt.hours(v.tau)],
        ['linear term A·x vs x²', 'x<sub>ox</sub>/A', fmt.sig(v.x / v.A, 2), '', { note: v.x < 0.5 * v.A ? 'mostly linear (reaction-limited)' : v.x < 2 * v.A ? 'mixed' : 'mostly parabolic (diffusion-limited)' }],
        [`time to ${thk(v.target)}`, '', tt <= 0 ? 'already reached' : fmt.hours(tt)]]);
    },

    steps: [
      { name: 'Dry oxidation', caption: 'Si + O₂ → SiO₂ at the Si/SiO₂ interface', set: { amb: 'dry', ori: '100', T: 1000, t: 1, x0: 0 }, duration: 2,
        text: v => `One hour in dry O₂ at 1000 °C grows ${thk(v.x)} of oxide on a (100) wafer. Oxygen must diffuse <b>through</b> the existing oxide and reacts at the Si/SiO₂ interface, so the oxide grows into the silicon: 46 % of its thickness lies below the original surface.` },
      { name: 'Two rate limits', caption: 'Thin: reaction-limited · thick: diffusion-limited', show: ['limits'],
        text: 'For thin oxides the interface reaction limits growth: x ≈ (B/A)(t+τ) (teal). For thick oxides diffusion through the oxide limits growth: x ≈ √(B(t+τ)) (purple). Once t ≫ τ these become straight lines of slope 1 and ½ on the log–log axes. The Deal–Grove curve (yellow) follows the lower of the two; the two limits cross at x = A (at t + τ = A²/B), where the real curve is still only at 0.62 A.' },
      { name: 'Long oxidation', caption: 'The curve bends towards the parabolic limit', set: { t: 30 }, duration: 3,
        text: v => `After 30 h the oxide is ${thk(v.x)} – thirty times longer than before but only ${fmt.sig(v.x / OX.thickness(v, 1, v.tau), 2)}× thicker. Growth slows because every oxygen molecule has to cross an ever thicker oxide.` },
      { name: 'Wet oxidation', caption: 'H₂O: B is ~30× larger than for O₂ at 1000 °C', set: { amb: 'wet', t: 1 }, show: ['compare'], duration: 2,
        text: v => `In steam the oxidant is H₂O, which dissolves in SiO₂ at a far higher concentration than O₂. At 1000 °C the parabolic constant B is ${fmt.sig(v.B / OX.rates('dry', v.T, v.ori).B, 2)}× larger, so 1 h gives ${thk(v.x)} instead of ${thk(OX.thickness(v.other, 1, v.otherTau))} (grey). Wet oxide is used for thick field and masking oxides; dry oxide, which grows slower but has better electrical quality, for gate oxides.` },
      { name: 'Temperature', caption: v => `${fmt.num(v.T, 0)} °C: both constants follow Arrhenius laws`, set: { T: 1100 }, duration: 2.5,
        text: v => `Raising T by 100 °C increases B by ${fmt.sig(v.B / OX.rates(v.amb, 1000, v.ori).B, 2)}× and B/A by ${fmt.sig(v.BA / OX.rates(v.amb, 1000, v.ori).BA, 2)}× (activation energies ${OX.DG[v.amb].E1} eV and ${OX.DG[v.amb].E2} eV). Oxidation is one of the most temperature-sensitive steps in the process – a few degrees matter.` },
      { name: 'Wafer orientation', caption: '(111) oxidises faster – but only in the linear regime', set: { ori: '111', t: 0.25 }, duration: 2,
        text: v => `On (111) silicon the linear rate constant B/A is 1.68× larger than on (100) – usually attributed to the higher density of Si bonds available for the interface reaction. B, a property of diffusion through the oxide, does not depend on orientation – the difference fades for thick oxides. Here: ${thk(v.x)} on (111) vs ${thk(OX.thickness(OX.rates(v.amb, v.T, '100'), v.t, OX.tauOf(OX.rates(v.amb, v.T, '100'), v.xs)))} on (100).` },
      { name: 'Time to a target', caption: 'Invert the equation: t = (x² + A x)/B − τ', set: { ori: '100', T: 1100, amb: 'wet', target: 0.5, t: 1 }, show: ['target'], hide: ['compare'],
        text: v => `Process engineers usually need the opposite: how long to grow a given thickness? Solve the Deal–Grove equation for t: t = (x² + A·x)/B − τ. For ${thk(v.target)} of wet oxide at ${fmt.num(v.T, 0)} °C that is <b>${fmt.hours(v.tTarget)}</b>. Change the target and the temperature in <b>Explore</b> – this is exactly the calculation from the exercises.` },
    ],
  });
}());
