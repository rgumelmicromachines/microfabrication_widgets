/* Carriers in silicon and the abrupt pn junction: Fermi level, built-in voltage, depletion region, field, capacitance.
   Topic: fundamentals. */
(function () {
  const { C, M, fmt } = MFW;
  const S = MFW_SEMI;
  const conc = c => `${fmt.sci(c, 1)} cm⁻³`;
  const um = x => (x >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.sig(x * 1000, 3)} nm`);
  const volt = v => `${fmt.num(v, Math.abs(v) < 10 ? 2 : 1)} V`;
  const NICE = [0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20];

  MFW.widget('#app', {
    title: 'Carriers and the pn junction',
    alt: v => `Abrupt silicon pn junction, N_A = ${conc(v.NA)}, N_D = ${conc(v.ND)}, ${fmt.num(v.T, 0)} K, applied ${volt(v.V)}: built-in voltage ${volt(v.Vbi)}, depletion width ${um(v.W)}, maximum field ${fmt.sig(v.Emax / 1000, 3)} kV/cm.`,
    source: 'Intrinsic density n_i(T) after Misiakos &amp; Tsamakis (1993); band gap after Alex et al. (1996); ε_r = 11.7 (Dunlap &amp; Watters 1953). Full ionisation, Boltzmann statistics, abrupt junction in the depletion approximation (Sze &amp; Ng 2007, ch. 2). E_i is drawn at mid-gap. Breakdown: two published approximations (Sze &amp; Gibbons 1966 as given by Sze &amp; Ng; Baliga 2008) that differ by about 15 %.',
    freeText: 'Explore – change the doping on both sides, the applied voltage and the temperature. Watch where the depletion region grows and how the bands bend.',

    params: {
      NA: { value: 1e17, min: 1e14, max: 1e19, log: true, label: 'Acceptor doping <i>N</i>_A (p side)', format: conc },
      ND: { value: 1e16, min: 1e14, max: 1e19, log: true, label: 'Donor doping <i>N</i>_D (n side)', format: conc },
      V: { value: 0, min: -20, max: 0.6, step: 0.05, label: 'Applied voltage <i>V</i> (forward +, reverse −)', format: volt },
      T: { value: 300, min: 200, max: 500, step: 5, label: 'Temperature <i>T</i>', unit: 'K', digits: 0 },
    },
    layers: { field: true, levels: false },
    explore: { show: ['levels'] },

    derived: v => {
      const j = S.junction(v.NA, v.ND, v.V, v.T), cp = S.carriers(0, v.NA, v.T), cn = S.carriers(v.ND, 0, v.T);
      return { ...j, Eg: S.Eg(v.T), kT: S.kT(v.T), pp: cp.p, np: cp.n, nn: cn.n, pn: cn.p, EFp: cp.EFi, EFn: cn.EFi,
        Wtxt: j.W >= 1 ? `${fmt.sig(j.W, 3)}\\ \\mathrm{\\mu m}` : `${fmt.sig(j.W * 1000, 3)}\\ \\mathrm{nm}` };
    },

    tex: [
      { at: [0, 3.42], tex: 'V_{bi} = \\frac{kT}{q}\\ln\\frac{N_A N_D}{n_i^2} = {{Vbi:3}}\\ \\mathrm{V},\\qquad W = \\sqrt{\\frac{2\\varepsilon_s (V_{bi}-V)}{q}\\,\\frac{N_A+N_D}{N_A N_D}} = {{Wtxt}}', size: 0.32 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- band diagram (x to scale, energy to scale)
      const BX0 = -6.1, BX1 = -0.7, BY0 = -2.6, BY1 = 2.35;
      const span = w.smooth('span', w.nice('span', NICE, 1.3 * Math.max(v.xp, v.xn)), { log: true });
      const X = x => BX0 + (x + span) / (2 * span) * (BX1 - BX0);
      const Eip = v.EFp < 0 ? -v.EFp : 0;                          // E_i − E_F on the p side (eV, > 0)
      const Ecp = Eip + v.Eg / 2, Emin = Ecp - v.Vj - v.Eg;         // energies relative to the p-side Fermi level
      const ey = w.smooth('ey', (BY1 - BY0) / (v.Vj + v.Eg), { log: true });
      const Y = E => BY0 + (E - Emin) * ey;
      // band bending δ(x): 0 deep in the p side, V_bi − V deep in the n side, parabolic in each depletion part
      const Vp = v.Vj * v.xp / v.W, Vn = v.Vj - Vp;
      const bend = x => (x <= -v.xp ? 0 : x <= 0 ? Vp * ((x + v.xp) / v.xp) ** 2 : x < v.xn ? Vp + Vn * (1 - ((v.xn - x) / v.xn) ** 2) : v.Vj);
      const xs = M.linspace(-span, span, 241);
      p.box(X(-v.xp), BY0 - 0.05, X(v.xn), BY1 + 0.05, { fill: C.grid, fillAlpha: 0.6, stroke: null, noOcc: true });
      p.clip(BX0, BY0 - 0.1, BX1, BY1 + 0.1, () => {
        p.path(xs.map(x => [X(x), Y(Ecp - bend(x))]), { color: C.blue, width: 3 });
        p.path(xs.map(x => [X(x), Y(Ecp - v.Eg - bend(x))]), { color: C.red, width: 3 });
        p.layer('levels', () => p.path(xs.map(x => [X(x), Y(Ecp - v.Eg / 2 - bend(x))]), { color: C.muted, width: 1.5, dash: [0.06, 0.06] }));
        // Fermi level(s): one flat line in equilibrium; quasi-Fermi levels split by qV under bias (schematic in the depletion region)
        p.line(X(-span), Y(0), X(v.xn), Y(0), { color: C.yellow, width: 2.5, dash: Math.abs(v.V) > 1e-3 ? [0.1, 0.06] : null });
        p.line(X(-v.xp), Y(v.V), X(span), Y(v.V), { color: C.yellow, width: 2.5, dash: Math.abs(v.V) > 1e-3 ? [0.1, 0.06] : null });
      });
      // level names at the left edge, spread apart when the levels lie close together (short leader lines)
      const labs = [{ t: 'E_c', y: Y(Ecp), c: C.blue }, { t: Math.abs(v.V) > 1e-3 ? 'E_{Fp}' : 'E_F', y: Y(0), c: C.yellow },
        { t: 'E_v', y: Y(Ecp - v.Eg), c: C.red }];
      if (p.vis('levels') > 0.01) labs.push({ t: 'E_i', y: Y(Ecp - v.Eg / 2), c: C.muted, a: p.vis('levels') });
      labs.sort((a, b) => b.y - a.y);
      const gap = 0.26, ys = labs.map(l => l.y);
      for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1] - gap);
      const shift = labs.reduce((s2, l, i) => s2 + l.y - ys[i], 0) / labs.length;
      labs.forEach((l, i) => {
        const y = ys[i] + shift;
        p.alpha(l.a === undefined ? 1 : l.a, () => {
          if (Math.abs(y - l.y) > 0.03) p.line(BX0 - 0.3, y, BX0 - 0.02, l.y, { color: l.c, width: 1.2, noOcc: true });
          p.text(l.t, BX0 - 0.34, y, { size: 0.21, align: 'right', color: l.c });
        });
      });
      p.text(Math.abs(v.V) > 1e-3 ? 'E_{Fn}' : 'E_F', BX1 + 0.08, Y(v.V), { size: 0.21, color: C.yellow });
      p.text(`p side, N_A = ${fmt.sci(v.NA, 1)}`, BX0, BY1 + 0.32, { size: 0.19, color: C.red, bold: true });
      p.text(`n side, N_D = ${fmt.sci(v.ND, 1)}`, BX1, BY1 + 0.32, { size: 0.19, align: 'right', color: C.blue, bold: true });
      // band offset q(V_bi − V) at the right edge
      const yTop = Y(Ecp), yBot = Y(Ecp - v.Vj);
      if (yTop - yBot > 0.35) {
      p.line(X(0.25 * span), yTop, BX1, yTop, { color: C.greyB, width: 1.2, dash: [0.05, 0.05] });
      p.dim(BX1 - 0.25, yTop, BX1 - 0.25, yBot, '');
      p.place(`q(V_{bi} − V) = ${fmt.num(v.Vj, 2)} eV`, [0.5, 0.3, 0.7, 0.15, 0.85].map(f => [BX1 - 0.37, yBot + f * (yTop - yBot), 'right']),
        { size: 0.19, color: C.greyA, bg: false, key: 'vbi' });
      }
      // depletion width
      p.dim(X(-v.xp), BY0 - 0.3, X(v.xn), BY0 - 0.3, '');
      p.place(`W = ${um(v.W)}`, [[(X(-v.xp) + X(v.xn)) / 2, BY0 - 0.55, 'center'], [X(v.xn) + 0.1, BY0 - 0.3, 'left'], [X(-v.xp) - 0.1, BY0 - 0.3, 'right']], { size: 0.2, color: C.text, key: 'wdim' });
      p.text(`x: ±${um(span)}, to scale`, BX0, BY0 - 0.82, { size: 0.17, color: C.muted });
      const eb = 1 / w.nice('eb', [0.1, 0.2, 0.5, 1, 2, 5, 10], ey / 0.7);                                    // energy scale bar
      p.line(BX1 - 0.05, BY0 - 0.92, BX1 - 0.05, BY0 - 0.92 + eb * ey, { color: C.text, width: 3 });
      p.text(`${fmt.num(eb, eb < 1 ? 1 : 0)} eV`, BX1 - 0.15, BY0 - 0.92 + eb * ey / 2, { size: 0.17, align: 'right', color: C.text });

      // ---------------------------------------------------------- electric field in the depletion region
      const fmax = w.smooth('fmax', w.nice('fmax', [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000], v.Emax / 1000 * 1.15), { log: true });
      const ax = p.axes({ x: 1.0, y: 0.55, w: 5.6, h: 2.15, xr: [-span, span], yr: [0, fmax], grid: true, size: 0.19, nticks: 4,
        xlabel: 'position x (µm)', ylabel: '|E| (kV/cm)', ylabelOffset: 0.75 }).draw();
      p.layer('field', () => {
        p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
          ax.curve([-span, -v.xp, 0, v.xn, span], [0, 0, v.Emax / 1000, 0, 0], { color: C.purple, width: 3 });
        });
        ax.place(`E_{max} = ${fmt.sig(v.Emax / 1000, 3)} kV/cm`, ax.around(0, v.Emax / 1000, 0.15).concat(ax.around(0, v.Emax / 1000, 0.45), [[ax.x + ax.w - 0.1, ax.y + ax.h - 0.1, 'right', 'top'], [ax.x + 0.1, ax.y + ax.h - 0.1, 'left', 'top'], [ax.x + 0.1, ax.y + ax.h * 0.5, 'left'], [ax.x + ax.w - 0.1, ax.y + ax.h * 0.5, 'right']]), { color: C.purple, size: 0.19, key: 'emax' });
      });

      // ---------------------------------------------------------- intrinsic density vs temperature
      const bx = p.axes({ x: 1.0, y: -2.75, w: 5.6, h: 2.3, xr: [200, 500], yr: [1e4, 1e20], ylog: true, grid: true, size: 0.19, nticks: 4,
        yticks: [1e4, 1e8, 1e12, 1e16, 1e20], xlabel: 'temperature (K)', ylabel: 'cm⁻³ (log)', ylabelOffset: 0.75 }).draw();
      p.clip(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h, () => {
        bx.hline(v.NA, { color: C.red, dash: [0.08, 0.07] });
        bx.hline(v.ND, { color: C.blue, dash: [0.03, 0.06] });
        bx.plot(T => S.ni(T), { color: C.yellow, width: 3.5 });
      });
      bx.dot(v.T, v.ni, { r: 0.08 });
      bx.legend([{ label: 'n_i(T)', color: C.yellow, width: 3.5 }, { label: 'N_A', color: C.red, dash: [0.08, 0.07] }, { label: 'N_D', color: C.blue, dash: [0.03, 0.06] }],
        { corner: 'br', size: 0.16 });
      bx.place(`n_i = ${fmt.sci(v.ni, 2)}`, bx.around(v.T, v.ni, 0.15).concat(bx.around(v.T, v.ni, 0.4), bx.around(v.T, v.ni, 0.7), [[bx.x + 0.1, bx.y + bx.h * 0.45, 'left'], [bx.x + 0.1, bx.y + bx.h * 0.35, 'left']]), { color: C.yellow, size: 0.18, key: 'ni' });
    },

    readout: v => MFW.chars([
      ['intrinsic carrier density', 'n<sub>i</sub>', conc(v.ni)],
      ['p side: holes', 'p<sub>p</sub>', `${fmt.sci(v.pp, 1)} cm⁻³`],
      ['p side: electrons', 'n<sub>p</sub>', `${fmt.sci(v.np, 1)} cm⁻³`],
      ['n side: electrons', 'n<sub>n</sub>', `${fmt.sci(v.nn, 1)} cm⁻³`],
      ['n side: holes', 'p<sub>n</sub>', `${fmt.sci(v.pn, 1)} cm⁻³`],
      ['Fermi level, p side', 'E<sub>F</sub> − E<sub>i</sub>', `${fmt.num(v.EFp, 3)} eV`],
      ['Fermi level, n side', 'E<sub>F</sub> − E<sub>i</sub>', `${fmt.num(v.EFn, 3)} eV`],
      ['built-in voltage', 'V<sub>bi</sub>', volt(v.Vbi), undefined, { hl: true }],
      ['depletion width', 'W', um(v.W), undefined, { f: `x<sub>p</sub> + x<sub>n</sub> = ${um(v.xp)} + ${um(v.xn)}` }],
      ['maximum field', 'E<sub>max</sub>', `${fmt.sig(v.Emax / 1000, 3)} kV/cm`],
      ['junction capacitance', 'C<sub>j</sub>', `${fmt.sig(v.Cj * 1e9, 3)} nF/cm²`, undefined, { f: 'ε<sub>s</sub>/W' }],
      ['avalanche breakdown, one-sided', 'V<sub>B</sub>', `≈ ${fmt.sig(v.VB[0], 2)}–${fmt.sig(v.VB[1], 2)} V`, undefined, { f: `N<sub>B</sub> = ${fmt.sci(Math.min(v.NA, v.ND), 1)} cm⁻³` }],
      Math.max(v.NA, v.ND) > 1.4e18 && { warn: 'Doping above ~10¹⁸ cm⁻³: the Fermi level approaches the band edge; Boltzmann statistics and full ionisation become inaccurate.' },
      -v.V > v.VB[0] && { warn: 'The reverse voltage exceeds the estimated avalanche breakdown voltage: a real junction would break down and conduct.' },
      !v.valid && { warn: 'Forward bias close to V<sub>bi</sub>: the depletion approximation no longer holds (high injection).' }]),

    steps: [
      { name: 'Intrinsic silicon', caption: 'n_i ≈ 10¹⁰ cm⁻³ at room temperature – and very temperature-sensitive', set: { NA: 1e17, ND: 1e16, V: 0, T: 300 }, duration: 1,
        text: v => `Pure silicon has only n<sub>i</sub> = ${conc(v.ni)} free electrons (and as many holes) at ${fmt.num(v.T, 0)} K – out of 5×10²² atoms per cm³. The band gap is E<sub>g</sub> = ${fmt.num(v.Eg, 3)} eV. Because carriers are created thermally across the gap, n<sub>i</sub> grows roughly as exp(−E<sub>g</sub>/2kT): look at the lower plot. (Older textbooks quote 1.45×10¹⁰ cm⁻³; the measured value is 9.65×10⁹ cm⁻³, Altermatt et al. 2003.)` },
      { name: 'Doping moves the Fermi level', caption: 'E_F − E_i = kT·ln(n/n_i)', show: ['levels'], duration: 1,
        text: v => `Doping overrides the intrinsic carriers by many orders: on the p side ${conc(v.pp)} holes, on the n side ${conc(v.nn)} electrons, and the minority carriers drop to n<sub>i</sub>²/N. The Fermi level moves away from the intrinsic level E<sub>i</sub> by kT·ln(N/n<sub>i</sub>): ${fmt.num(-v.EFp, 2)} eV towards E<sub>v</sub> on the p side, ${fmt.num(v.EFn, 2)} eV towards E<sub>c</sub> on the n side.` },
      { name: 'The built-in voltage', caption: 'In equilibrium E_F is flat – so the bands bend', duration: 1,
        text: v => `Put the two sides together. Electrons diffuse to the p side, holes to the n side, and leave behind fixed ionised dopants: a dipole layer forms until the Fermi level is the same everywhere. The bands bend by qV<sub>bi</sub> = kT·ln(N<sub>A</sub>N<sub>D</sub>/n<sub>i</sub>²) = ${fmt.num(v.Vbi, 3)} eV – the sum of the two Fermi-level shifts.` },
      { name: 'Depletion region and field', caption: 'Charge ±qN in the depletion region, a triangular field', duration: 1,
        text: v => `Around the junction the mobile carriers are swept out; what remains is the space charge of the dopants. Charge neutrality N<sub>A</sub>x<sub>p</sub> = N<sub>D</sub>x<sub>n</sub> sets the split: x<sub>p</sub> = ${um(v.xp)}, x<sub>n</sub> = ${um(v.xn)}, W = ${um(v.W)}. Poisson's equation gives a triangular field peaking at the junction, E<sub>max</sub> = 2(V<sub>bi</sub> − V)/W = ${fmt.sig(v.Emax / 1000, 3)} kV/cm.` },
      { name: 'One-sided junction', caption: 'The depletion region lies in the lightly doped side', set: { NA: 1e19, ND: 1e15 }, duration: 2,
        text: v => `A p⁺n junction (N<sub>A</sub> ≫ N<sub>D</sub>), like a shallow diffused or implanted layer in a lightly doped wafer: practically the whole depletion region (${um(v.xn)} of ${um(v.W)}) lies on the lightly doped n side, and W ≈ √(2ε<sub>s</sub>(V<sub>bi</sub> − V)/(qN<sub>D</sub>)) depends only on the lower doping. That is why the substrate doping sets the diode capacitance and breakdown. (N<sub>A</sub> = 10¹⁹ is at the edge of the model: see the note in the readout.)` },
      { name: 'Reverse bias', caption: 'W ∝ √(V_{bi} − V), C ∝ 1/√(V_{bi} − V)', set: { NA: 1e18, ND: 1e15, V: -10 }, duration: 2,
        text: v => `A reverse voltage adds to the built-in voltage: at ${volt(v.V)} the depletion region widens to ${um(v.W)} and the capacitance per area drops to ${fmt.sig(v.Cj * 1e9, 3)} nF/cm² – the principle of the varactor diode and of C–V doping profiling. The field grows as well; at about ${fmt.sig(v.VB[0], 2)}–${fmt.sig(v.VB[1], 2)} V (for N<sub>D</sub> = 10¹⁵ cm⁻³) avalanche breakdown sets in.` },
      { name: 'Temperature', caption: 'Hotter → more n_i → smaller V_{bi}', set: { V: 0, T: 450 }, duration: 2,
        text: v => `At ${fmt.num(v.T, 0)} K n<sub>i</sub> has grown to ${conc(v.ni)} and V<sub>bi</sub> has dropped to ${volt(v.Vbi)}. If n<sub>i</sub> reached the doping, the material would turn intrinsic and the junction would disappear – the reason why silicon devices stop working at a few hundred °C, and why lightly doped regions fail first. Now switch to <b>Explore</b>.` },
    ],
  });
}());
