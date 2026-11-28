/* Two-step dopant diffusion: predeposition (erfc) and drive-in (≈ Gaussian), junction depth and sheet resistance.
   Topic: doping. */
(function () {
  const { C, M, fmt } = MFW;
  const DF = MFW_DIFF;
  const NAME = { B: 'boron', P: 'phosphorus' };
  const NICE = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20];
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const mins = m => (m < 60 ? `${fmt.sig(m, 3)} min` : `${fmt.sig(m / 60, 3)} h`);
  const conc = c => `${fmt.sci(c, 1)} cm⁻³`;

  let memoKey = null, memo = null;
  function compute(v) {
    const key = [v.dop, v.NB, v.T1, v.t1, v.csMode, v.Cs, v.T2, v.t2].join('|');
    if (key === memoKey) return memo;
    const D1 = DF.D(v.dop, v.T1), D2 = DF.D(v.dop, v.T2);
    const Dt1 = D1 * v.t1 * 60 * 1e8, Dt2 = D2 * v.t2 * 60 * 1e8;        // µm²
    const Cs = v.csMode === 'sol' ? DF.solubility(v.dop, v.T1) : v.Cs;
    const Q = DF.predepDose(Cs, Dt1);
    const prof1 = x => DF.predep(x, Cs, Dt1), prof2 = x => DF.driveIn(x, Cs, Dt1, Dt2);
    const xj1 = DF.crossing(prof1, v.NB, 2 * Math.sqrt(Dt1) * 6 + 0.01);
    const xj2 = DF.crossing(prof2, v.NB, 2 * Math.sqrt(Dt1 + Dt2) * 6 + 0.01);
    const need = Math.max(xj2 * 1.45, 0.2);
    const iN = NICE.findIndex(n => n >= need), xmax = iN < 0 ? 20 : NICE[iN];
    const xs = M.linspace(0, NICE[Math.min(iN < 0 ? NICE.length - 1 : iN + 1, NICE.length - 1)], 361);   // one step beyond: the held range is covered
    const carrier = v.dop === 'B' ? 'p' : 'n';
    memo = { D1, D2, Dt1, Dt2, Cs, Q, xj1, xj2, xmax, need, xs, c1: xs.map(prof1), c2: xs.map(prof2), cg: Dt2 > 0 ? xs.map(x => DF.gaussian(x, Q, Dt2)) : null,
      Cs2: prof2(0), Rs1: DF.sheetResistance(prof1, v.NB, xj1, carrier), Rs2: DF.sheetResistance(prof2, v.NB, xj2, carrier),
      ni1: DF.ni(v.T1), ratio: Dt2 / Dt1 };
    memoKey = key;
    return memo;
  }

  MFW.widget('#app', {
    title: 'Two-step diffusion: predeposition and drive-in',
    alt: v => `${NAME[v.dop]} diffused into silicon with background ${conc(v.NB)}: predeposition ${mins(v.t1)} at ${v.T1} °C, drive-in ${mins(v.t2)} at ${v.T2} °C. Dose ${fmt.sci(v.Q, 2)} cm⁻², junction depth ${um(v.xj2)}, sheet resistance ${fmt.sig(v.Rs2, 3)} ohm per square.`,
    source: 'Fick\'s second law with concentration-independent intrinsic diffusivities (sum of charge states, Plummer, Deal &amp; Griffin, <i>Silicon VLSI Technology</i> (2000), Table 7-5). Predeposition: constant surface concentration = maximum solid solubility (digitised from the same book, after F. A. Trumbore 1960; ±15 %, and the electrically active P limit is much lower). Drive-in: exact solution for the erfc predeposit with a sealed surface (method of images), compared with the Gaussian approximation. Mobility: Caughey–Thomas fit of Arora, Hauser &amp; Roulston (1982) at 300 K, full ionisation. Real high-concentration B, P and As profiles deviate (concentration-dependent diffusion, P kink-and-tail, clustering) – see the notes below the widget.',
    freeText: v => `Explore – design a junction. Tip: aim for x<sub>j</sub> ≈ 1 µm and R<sub>s</sub> ≈ 100 Ω/□ for ${NAME[v.dop]} into ${conc(v.NB)}.`,

    params: {
      dop: { value: 'B', label: 'Dopant', options: { B: 'Boron (p-type) into n-type Si', P: 'Phosphorus (n-type) into p-type Si' } },
      NB: { value: 1e15, min: 1e14, max: 1e18, log: true, label: 'Substrate doping <i>N</i>_B', format: c => conc(c) },
      T1: { value: 950, min: 900, max: 1100, step: 5, label: 'Predeposition temperature <i>T</i>_1', unit: '°C', digits: 0 },
      t1: { value: 30, min: 5, max: 120, step: 1, label: 'Predeposition time <i>t</i>_1', format: mins },
      csMode: { value: 'sol', label: 'Surface concentration during predeposition', options: { sol: 'Solid solubility at T₁', custom: 'Custom value' } },
      Cs: { value: 1e19, min: 1e17, max: 1e21, log: true, label: 'Custom surface concentration <i>C</i>_s', format: c => conc(c), when: v => v.csMode === 'custom' },
      T2: { value: 1100, min: 950, max: 1200, step: 5, label: 'Drive-in temperature <i>T</i>_2', unit: '°C', digits: 0 },
      t2: { value: 0, min: 0, max: 480, step: 1, label: 'Drive-in time <i>t</i>_2', format: mins },
    },
    layers: { junction: false, gauss: false, pre: false },
    explore: { show: ['junction', 'pre'] },

    derived: v => compute(v),

    tex: [
      { at: [-3.55, 3.45], tex: '\\text{predep: } C = C_s\\,\\mathrm{erfc}\\,\\frac{x}{2\\sqrt{D_1 t_1}}', size: 0.36 },
      { at: [3.55, 3.45], tex: '\\text{drive-in: } C \\approx \\frac{Q}{\\sqrt{\\pi D_2 t_2}}\\,e^{-x^2/4D_2t_2}', size: 0.36 },
    ],

    draw(p, v, w) {
      const pType = v.dop === 'B';
      const dopCol = pType ? C.red : C.blue, subMat = pType ? 'ndoped' : 'pdoped', difMat = pType ? 'pdoped' : 'ndoped';

      // ---------------------------------------------------------- cross-section through a mask window (to scale)
      const xmaxT = w.nice('xmax', NICE, v.need);                                              // no flip-flop at a step boundary
      const xmax = w.smooth('xmax', xmaxT, { log: true });                                     // depth range glides, never jumps
      const X0 = -6.7, X1 = -1.7, Ytop = 1.9, Ybot = -2.7, k = (Ytop - Ybot) / xmax;           // units per µm
      const wL = -5.0, wR = -3.4;                                                             // window edges
      p.material('si', X0, Ybot, X1, Ytop);
      p.material(subMat, X0, Ybot, X1, Ytop, { stroke: null });
      const xj = v.xj2 * k, lat = 0.8 * xj, pts = [];
      if (v.xj2 > 0) {
        pts.push([wL - lat, Ytop]);
        for (let i = 0; i <= 16; i++) { const a = Math.PI / 2 * i / 16; pts.push([wL - lat * Math.cos(a), Ytop - xj * Math.sin(a)]); }
        for (let i = 16; i >= 0; i--) { const a = Math.PI / 2 * i / 16; pts.push([wR + lat * Math.cos(a), Ytop - xj * Math.sin(a)]); }
        p.clip(X0, Ybot, X1, Ytop, () => p.materialPoly(difMat, pts, { stroke: dopCol, width: 2.5 }));
      }
      // mask oxide (drawn on top of the surface)
      p.material('sio2', X0, Ytop, wL, Ytop + 0.28);
      p.material('sio2', wR, Ytop, X1, Ytop + 0.28);
      p.text('SiO₂ mask', (X0 + wL) / 2, Ytop + 0.14, { size: 0.2, align: 'center', color: C.text });
      p.arrow((wL + wR) / 2, Ytop + 0.75, (wL + wR) / 2, Ytop + 0.1, { color: dopCol, width: 3 });
      p.text(v.dop, (wL + wR) / 2 + 0.15, Ytop + 0.6, { size: 0.26, color: dopCol });
      p.layer('junction', () => {
        if (v.xj2 > 0) {
          p.text(pType ? 'p⁺' : 'n⁺', (wL + wR) / 2, Ytop - Math.min(xj / 2, 0.5), { size: 0.3, align: 'center', color: C.white });
          // x_j is measured under the window, where the junction is flat: inside the diffused region there is always
          // room for the dimension and its label, whatever the lateral spread
          const xd = wR - 0.3, yd = Math.max(Ytop - xj, Ybot + 0.05);
          p.dim(xd, Ytop, xd, yd, '');
          p.text('x_j', xd + 0.1, Math.max(Ytop - 0.4, (Ytop + yd) / 2), { size: 0.24, color: C.white });   // near the surface: does not move with the zoom
          if (lat > 0.25 && Ytop - xj - 0.3 > Ybot + 0.5) p.text('lateral spread ≈ 0.8 x_j', X0 + 0.1, Ytop - xj - 0.25, { size: 0.19, color: C.text, bg: true });
        }
        p.text(pType ? 'n-type substrate' : 'p-type substrate', X1 - 0.1, Ybot + 0.25, { size: 0.22, align: 'right', color: C.text });
      });
      // depth scale bar
      const sb = xmaxT / 4;                                                                   // label for the target range
      p.line(X0 - 0.15, Ytop, X0 - 0.15, Ytop - sb * k, { color: C.text, width: 3 });
      p.text(um(sb), X0 - 0.22, Ytop - sb * k / 2, { size: 0.19, align: 'right', color: C.text, rotate: 90 });
      p.text('depth and lateral spread to scale, window width schematic', (X0 + X1) / 2, Ybot - 0.25, { size: 0.21, align: 'center', color: C.muted });

      // ---------------------------------------------------------- profile plot
      const ax = p.axes({ x: 0.15, y: -2.7, w: 6.5, h: 5.4, xr: [0, xmax], yr: [1e14, 1e22], ylog: true, grid: true, size: 0.24,
        xlabel: 'depth x (µm)', ylabel: 'concentration (cm⁻³, log scale)', ylabelOffset: 1.05 }).draw();
      const DASH_PRE = [0.1, 0.08], DASH_G = [0.03, 0.07], DASH_NB = [0.08, 0.08];
      p.clip(ax.x, ax.y - 0.05, ax.x + ax.w, ax.y + ax.h + 0.05, () => {
        p.layer('junction', () => ax.hline(v.NB, { color: C.muted, dash: DASH_NB }));
        p.layer('pre', () => { if (v.t2 > 0) ax.curve(v.xs, v.c1, { color: dopCol, width: 2.5, dash: DASH_PRE }); });
        p.layer('gauss', () => { if (v.cg) ax.curve(v.xs, v.cg, { color: C.purple, width: 2.5, dash: DASH_G }); });
        ax.curve(v.xs, v.c2, { color: C.yellow, width: 4.5 });
        p.layer('junction', () => {
          if (v.xj2 > 0 && v.xj2 < xmax) {
            ax.vline(v.xj2, { color: C.yellow, to: v.NB });
            ax.dot(v.xj2, v.NB, { r: 0.09 });
          }
        });
      });
      // legend top right: deeper than ~0.8 x_j every profile is far below 10¹⁹ cm⁻³, so no curve passes there
      ax.legend([
        { label: v.t2 > 0 ? 'after drive-in' : 'after predeposition', color: C.yellow, width: 4 },
        { label: 'after predeposition', color: dopCol, dash: DASH_PRE, alpha: v.t2 > 0 ? p.vis('pre') : 0 },
        { label: 'Gaussian approximation', color: C.purple, dash: DASH_G, alpha: v.cg ? p.vis('gauss') : 0 },
        { label: `substrate N_B = ${fmt.sci(v.NB, 1)}`, color: C.muted, textColor: C.greyA, dash: DASH_NB, alpha: p.vis('junction') },
      ], { corner: 'tr', size: 0.19 });
      p.layer('junction', () => {
        if (v.xj2 > 0 && v.xj2 < xmax) ax.place(`x_j = ${um(v.xj2)}`, ax.around(v.xj2, v.NB, 0.14), { color: C.yellow, size: 0.23, key: 'xj' });
      });
    },

    readout: v => MFW.chars([
      ['diffusivity at T₁', 'D(T₁)', `${fmt.sci(v.D1, 2)} cm²/s`],
      ['diffusivity at T₂', 'D(T₂)', `${fmt.sci(v.D2, 2)} cm²/s`],
      ['diffusion length, predeposition', '√(D₁t₁)', um(Math.sqrt(v.Dt1))],
      ['diffusion length, drive-in', '√(D₂t₂)', v.Dt2 > 0 ? um(Math.sqrt(v.Dt2)) : '–'],
      ['surface concentration, predeposition', 'C<sub>s</sub>', conc(v.Cs)],
      ['dose', 'Q', `${fmt.sci(v.Q, 2)} cm⁻²`],
      ['surface concentration after drive-in', '', conc(v.Cs2)],
      ['junction depth', 'x<sub>j</sub>', um(v.xj2), undefined, { hl: true }],
      ['sheet resistance', 'R<sub>s</sub>', `${fmt.sig(v.Rs2, 3)} Ω/□`],
      v.Cs > v.ni1 && { warn: `C<sub>s</sub> &gt; n<sub>i</sub>(T₁) = ${fmt.sci(v.ni1, 1)} cm⁻³: real diffusion is faster and concentration-dependent.` }]),

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Predeposition', caption: 'Constant surface concentration → erfc profile', set: { dop: 'B', NB: 1e15, T1: 950, t1: 30, csMode: 'sol', t2: 0, T2: 1100 }, duration: 1.5,
        text: v => `The wafer sits in a dopant source (e.g. BBr₃, POCl₃ or a solid source) at ${v.T1} °C. The surface is held at the solid solubility, C<sub>s</sub> ≈ ${conc(v.Cs)}, and dopant diffuses in with D = ${fmt.sci(v.D1, 1)} cm²/s. The solution of Fick's law is an erfc profile with diffusion length √(Dt) = ${um(Math.sqrt(v.Dt1))}.` },
      { name: 'Junction depth', caption: 'The junction lies where C(x) = N_B', show: ['junction'],
        text: v => `The diffused ${NAME[v.dop]} compensates the substrate doping N<sub>B</sub>. Where C(x) = N<sub>B</sub> the net doping changes sign: that depth is the <b>junction depth</b> x<sub>j</sub> = 2√(Dt)·erfc⁻¹(N<sub>B</sub>/C<sub>s</sub>) = ${um(v.xj2)}. Under the mask edge the dopant also spreads sideways (about 0.8 x<sub>j</sub>).` },
      { name: 'Drive-in', caption: 'No more supply: the fixed dose spreads deeper', from: { t2: 0 }, set: { t2: 60 }, show: ['pre'], duration: 3,
        ask: { q: 'Next the source is removed, the surface is sealed by an oxide and the wafer is heated again: 60 min at 1100 °C. No dopant enters or leaves. What happens to the profile?',
          options: ['Nothing – without a source there is no diffusion', 'The junction moves deeper, the surface concentration stays at the solid solubility', 'The junction moves deeper and the surface concentration drops'], correct: 2 },
        text: v => `With the source removed and the surface sealed, the wafer is heated again, here ${mins(v.t2)} at ${v.T2} °C. The dopant keeps diffusing, but the dose Q = ${fmt.sci(v.Q, 2)} cm⁻² stays constant, so the profile flattens: the surface concentration drops to ${conc(v.Cs2)} and the junction moves to ${um(v.xj2)}. The dashed curve is the profile after predeposition.` },
      { name: 'Gaussian approximation', caption: 'Gaussian is good once D₂t₂ ≫ D₁t₁', set: { T2: 1100, t2: 60 }, show: ['gauss'], duration: 1,
        task: 'Hand calculations treat the predeposited dose as a thin sheet at the surface, which gives a Gaussian (dotted). After this drive-in it lies on the exact profile (yellow). Lower the <b>drive-in temperature T<sub>2</sub></b> until the two curves separate: until the drive-in diffusion length √(D₂t₂) in the readout is less than twice the predeposition one, √(D₁t₁).',
        goal: v => v.Dt2 > 0 && v.Dt2 < 4 * v.Dt1, solution: { T2: 960 },
        text: v => {
          const arg = v.Q / (v.NB * Math.sqrt(Math.PI * v.Dt2 * 1e-8)), xg = v.Dt2 > 0 && arg > 1 ? Math.sqrt(4 * v.Dt2 * Math.log(arg)) : 0;
          return `The Gaussian assumes that the whole dose starts at the surface. Here D₂t₂/D₁t₁ = ${fmt.sig(v.ratio, 2)}, so the approximation ${v.ratio > 10 ? 'is already very good' : 'is visibly off'}: it puts the junction at ${um(xg)}, the exact solution for the real erfc starting profile (yellow) at ${um(v.xj2)}. The dopant was already spread over √(D₁t₁) = ${um(Math.sqrt(v.Dt1))} before the drive-in began; the Gaussian formula is safe only once D₂t₂ ≫ D₁t₁.`;
        } },
      { name: 'Temperature', caption: 'D is thermally activated: +50 °C ≈ 3× faster', from: { T2: 1100, t2: 60 }, set: { T2: 1150, t2: 60 }, duration: 2.5,
        ask: { q: 'Back to 60 min at 1100 °C (1373 K). The drive-in temperature is now raised by 50 °C, to 1423 K. By what factor does the diffusivity D grow?',
          options: ['About 1.04× – like the absolute temperature', 'About 1.5×', 'About 3×'], correct: 2 },
        text: v => `With an effective activation energy of ${fmt.num(8.617333e-5 * Math.log(DF.D(v.dop, 1150) / DF.D(v.dop, 1100)) / (1 / 1373.15 - 1 / 1423.15), 1)} eV the diffusivity is extremely temperature-sensitive: at ${v.T2} °C D is ${fmt.sig(v.D2 / DF.D(v.dop, 1100), 2)}× its value at 1100 °C and the junction is at ${um(v.xj2)}. Every later high-temperature step (oxidation, annealing) moves junctions as well – the <i>thermal budget</i> must be planned for the whole process.` },
      { name: 'Sheet resistance', caption: 'R_s – what the four-point probe measures', set: { T2: 1100, t2: 60 }, duration: 2,
        task: 'Design a junction: back at 1100 °C, lengthen the <b>drive-in time t<sub>2</sub></b> until the junction depth x<sub>j</sub> is 2 µm.',
        goal: v => Math.abs(v.xj2 - 2) <= 0.1, solution: { t2: 130 },
        text: v => `The junction is at ${um(v.xj2)}. The diffused layer above it is a resistor. Its sheet resistance R<sub>s</sub> = 1 / (q ∫ μ(C)·(C − N<sub>B</sub>) dx) = <b>${fmt.sig(v.Rs2, 3)} Ω/□</b> is measured with a four-point probe; together with x<sub>j</sub> (from angle-lapping or SIMS) it characterises the diffusion. Now switch to <b>Explore</b>, change the dopant or substrate doping and design your own junction.` },
    ],
  });
}());
