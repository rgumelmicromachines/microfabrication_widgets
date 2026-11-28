/* Electromigration in interconnect lines: Black's equation, accelerated test → use conditions, lognormal failure
   statistics and the Blech length. Topic: interconnects. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const EM = MFW_EM;
  const YEAR = EM.HOURS_PER_YEAR;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const T0 = nowMs();
  const big = x => (x >= 1e5 ? fmt.sci(x, 1) : fmt.sig(x, 3));
  const timeS = h => (h < 1 ? `${fmt.sig(h * 60, 2)} min` : h < 1000 ? `${fmt.sig(h, 3)} h` : h < YEAR ? `${fmt.sig(h / 24, 3)} days` : `${big(h / YEAR)} years`);
  // time axes: round values in hours up to 100 h, then round values in years
  const TICKS = [[1, '1 h'], [100, '100 h'], [YEAR, '1 yr'], [100 * YEAR, '100 yr'], [1e4 * YEAR, '10⁴ yr'], [1e6 * YEAR, '10⁶ yr'], [1e8 * YEAR, '10⁸ yr']];
  const tickS = h => (TICKS.find(t => Math.abs(t[0] / h - 1) < 1e-6) || [0, ''])[1];
  const jS = j => `${fmt.sig(j, 2)} MA/cm²`;
  const degC = T => `${fmt.num(T, 0)} °C`;
  const F_Q = 0.001, LIFE = 10;                                             // quantile and target life shown on the page

  const widget = MFW.widget('#app', {
    title: 'Electromigration: from the stress test to the lifetime',
    loop: true,                                                             // the electrons move all the time
    alt: v => `Electromigration of a ${EM.METALS[v.metal].short} line: median life ${timeS(v.t50T)} in a test at ${jS(v.jT)} and ${degC(v.TT)} extrapolates with E_a = ${v.Ea} eV and n = ${v.n} to a median life of ${timeS(v.t50U)} at ${jS(v.jU)} and ${degC(v.TU)} (acceleration factor ${fmt.sci(v.AF, 1)}); 0.1 % of the lines fail within ${timeS(v.tFU)}.`,
    source: 'Black’s equation t₅₀ = A·j⁻ⁿ·exp(E_a/kT) (J. R. Black, <i>IEEE Trans. Electron Devices</i> ED-16 (1969) 338) with the activation energies he measured for aluminium films (0.48, 0.84 and 1.2 eV, n = 2); copper damascene lines: E_a ≈ 0.9 eV (C.-K. Hu et al., IRPS 2004), n ≈ 1.2 (Filippi et al., IRPS 2009). The measured median life of the test is an input – the prefactor A is never calculated. Lognormal failure times; the shape parameter σ is an assumption you set. Blech threshold (j·L)<sub>c</sub>: Al 1260 A/cm (after Blech 1976), Cu 3700 A/cm (K.-D. Lee et al., <i>Appl. Phys. Lett.</i> 79 (2001) 3236). The picture of the line is schematic.',
    freeText: v => `Explore – a test at ${jS(v.jT)} and ${degC(v.TT)} is ${fmt.sci(v.AF, 1)}× faster than use at ${jS(v.jU)} and ${degC(v.TU)}. Find the highest current density that still gives ${LIFE} years for 99.9 % of the lines, then shorten the line below the Blech length.`,

    params: {
      metal: { value: 'alLarge', label: 'Metallisation', options: Object.fromEntries(Object.entries(EM.METALS).map(([k, m]) => [k, `${m.name}: ${m.Ea} eV, n = ${m.n}`])) },
      jU: { value: 0.2, min: 0.02, max: 3, log: true, label: 'Use: current density <i>j</i>_use', format: jS },
      TU: { value: 125, min: 25, max: 175, step: 1, label: 'Use: temperature <i>T</i>_use', format: degC },
      L: { value: 100, min: 5, max: 1000, log: true, label: 'Line length <i>L</i>', format: x => `${fmt.sig(x, 2)} µm` },
      jT: { value: 2, min: 0.5, max: 5, step: 0.1, label: 'Test: current density <i>j</i>_test', format: jS, group: 'Accelerated test' },
      TT: { value: 250, min: 150, max: 400, step: 5, label: 'Test: temperature <i>T</i>_test', format: degC, group: 'Accelerated test' },
      t50T: { value: 100, min: 1, max: 10000, log: true, label: 'Test: measured median life <i>t</i>₅₀', format: timeS, group: 'Accelerated test' },
      sigma: { value: 0.5, min: 0.2, max: 1.2, step: 0.05, label: 'Lognormal shape parameter σ', digits: 2, group: 'Accelerated test' },
      life: { value: 0.6, min: 0, max: 1.5, step: 0.01, label: 'Time into the test, <i>t</i>/<i>t</i>₅₀', digits: 2, group: 'Accelerated test' },
    },
    layers: { use: false },
    explore: { show: ['use'] },

    derived: v => {
      const e = EM.evaluate({ ...v, F: F_Q, life: LIFE });
      return { ...e, failedNow: EM.failed(v.life * v.t50T, v.t50T, v.sigma) };
    },

    tex: [
      { at: [2.6, 3.4], tex: 't_{50} = A\\,j^{-n}\\,e^{E_a/kT},\\qquad E_a = {{Ea:2}}\\ \\mathrm{eV},\\quad n = {{n:1}}', size: 0.27 },
    ],

    draw(p, v) {
      const tAnim = (nowMs() - T0) / 1000, m = v.m, metal = MAT[m.mat];
      // ---------------------------------------------------------- the line under test (schematic)
      const xl = -6.3, xr = -1.2, y0 = 2.15, y1 = 2.6, yv = 1.55;
      p.text('line in the accelerated test (schematic, not to scale)', -6.85, 3.5, { size: 0.2, color: C.muted });
      const f = v.immortalT ? 0 : Math.min(1, v.life), open = !v.immortalT && v.life >= 1;
      // vias down to the lower level at both ends, then the line itself
      for (const x of [xl, xr - 0.45]) p.box(x, yv, x + 0.45, y0, { fill: metal.fill, stroke: null });
      p.box(xl - 0.5, yv - 0.3, xl + 0.9, yv, { fill: metal.fill, stroke: null });
      p.box(xr - 0.9, yv - 0.3, xr + 0.5, yv, { fill: metal.fill, stroke: null });
      p.box(xl, y0, xr, y1, { fill: metal.fill, stroke: null });
      // void at the cathode end (grows from the top surface), hillock at the anode end – same area
      const vw = 0.35 + 0.35 * f, vx = xl + 0.75, vd = (y1 - y0) * f;
      if (f > 0) {
        p.polygon([[vx - vw / 2, y1 + 0.02], [vx + vw / 2, y1 + 0.02], [vx + vw * 0.3, y1 - vd], [vx - vw * 0.3, y1 - vd]], { fill: C.bg, stroke: null, noOcc: true });
        const hx = xr - 0.95, hh = 0.28 * f, pts = [];
        for (let i = 0; i <= 20; i++) { const a = Math.PI * i / 20; pts.push([hx + 0.45 * Math.cos(a), y1 - 0.01 + hh * Math.sin(a)]); }
        p.polygon(pts, { fill: metal.fill, stroke: null, noOcc: true });
      }
      // electrons drift from the cathode (−) to the anode (+); their number and speed follow the test current density
      const nE = Math.round(6 + 4 * v.jT), sp = 0.12 + 0.1 * v.jT;
      for (let i = 0; i < nE; i++) {
        const u = (tAnim * sp + hash(i + 0.3)) % 1, x = xl + 0.1 + (xr - xl - 0.2) * u, y = y0 + 0.06 + (y1 - y0 - 0.12) * hash(i + 0.9);
        if (open && x > vx - vw * 0.3) continue;                            // open circuit: nothing flows past the void
        if (f > 0 && Math.abs(x - vx) < vw / 2 && y > y1 - vd - 0.03) continue;
        p.circle(x, y, 0.035, { fill: C.blue, stroke: null });
      }
      p.text('−', xl - 0.25, yv - 0.15, { size: 0.3, align: 'center', color: C.text });
      p.text('+', xr + 0.25, yv - 0.15, { size: 0.3, align: 'center', color: C.text });
      p.text('cathode', xl - 0.5, yv - 0.5, { size: 0.18, color: C.muted });
      p.text('anode', xr + 0.5, yv - 0.5, { size: 0.18, color: C.muted, align: 'right' });
      p.arrow(xl + 1.5, y1 + 0.25, xl + 3.1, y1 + 0.25, { color: C.blue, width: 2, head: 0.14 });
      p.text('electron wind', xl + 1.5, y1 + 0.47, { size: 0.18, color: C.blue });
      if (v.immortalT) {
        p.arrow(xl + 3.3, y0 - 0.2, xl + 1.7, y0 - 0.2, { color: C.teal, width: 2, head: 0.14 });
        p.text('back flow driven by the stress gradient', xl + 1.3, y0 - 0.42, { size: 0.18, color: C.teal });
      } else if (f > 0) {
        p.text('void', vx, y1 + 0.2, { size: 0.18, align: 'center', color: C.red });
        p.text('hillock', xr - 0.95, y1 + 0.47, { size: 0.18, align: 'center', color: C.text });
      }
      const status = v.immortalT ? `j·L = ${fmt.sig(v.jLT, 2)} A/cm is below the Blech threshold: no failure`
        : open ? 'the void has cut the median line: open circuit' : `t = ${timeS(v.life * v.t50T)}: ${fmt.num(100 * v.failedNow, v.failedNow < 0.1 ? 1 : 0)} % of the lines have failed`;
      p.text(status, -6.85, 0.75, { size: 0.2, color: open ? C.red : v.immortalT ? C.teal : C.text, bold: true });

      // ---------------------------------------------------------- lognormal failure distribution
      const cdf = p.axes({ x: -5.85, y: -2.7, w: 4.9, h: 2.75, xr: [0.1, 1e10], yr: [0, 100], xlog: true, grid: true, size: 0.19,
        xticks: TICKS.slice(0, 6).map(t => t[0]), xfmt: tickS, yticks: [0, 25, 50, 75, 100],
        xlabel: 'time (log scale)', ylabel: 'failed lines (%)', ylabelOffset: 0.6 }).draw();
      const ts = M.logspace(0.1, 1e10, 220);
      p.clip(cdf.x, cdf.y, cdf.x + cdf.w, cdf.y + cdf.h, () => {
        cdf.curve(ts, ts.map(t => 100 * EM.failed(t, v.t50T, v.sigma)), { color: C.yellow, width: 3.5 });
        p.layer('use', () => {
          cdf.vline(v.target, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
          cdf.curve(ts, ts.map(t => 100 * EM.failed(t, v.t50U, v.sigma)), { color: C.teal, width: 3.5 });
        });
      });
      const tNow = v.life * v.t50T;
      if (!v.immortalT && tNow >= 0.1) cdf.dot(tNow, 100 * v.failedNow, { r: 0.08, color: C.yellow });
      p.text('test', cdf.x + 0.1, cdf.y + cdf.h + 0.2, { size: 0.19, color: C.yellow, bold: true });
      p.alpha(p.vis('use'), () => {
        p.text('use', cdf.x + 0.75, cdf.y + cdf.h + 0.2, { size: 0.19, color: C.teal, bold: true });
        p.text(`dotted: ${LIFE} years`, cdf.x + cdf.w, cdf.y + cdf.h + 0.2, { size: 0.19, color: C.muted, align: 'right' });
      });

      // ---------------------------------------------------------- Arrhenius plot of the median life
      const ax = p.axes({ x: 1.35, y: -2.7, w: 5.15, h: 5.0, xr: [25, 400], yr: [1e-3, 1e14], ylog: true, grid: true, size: 0.21,
        xticks: [50, 100, 150, 200, 250, 300, 350, 400], yticks: TICKS.map(t => t[0]), yfmt: tickS,
        xlabel: 'temperature (°C)', ylabel: 'median life t₅₀ (log scale)', ylabelOffset: 1.05 }).draw();
      const life = (j, T) => EM.t50At(v.Ea, v.n, v.t50T, v.jT, v.TT, j, T);
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        ax.plot(T => life(v.jT, T), { color: C.yellow, width: 3.5 });
        p.layer('use', () => {
          ax.hline(v.target, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
          ax.plot(T => life(v.jU, T), { color: C.teal, width: 3.5 });
        });
      });
      ax.dot(v.TT, v.t50T, { r: 0.1, color: C.yellow });
      p.layer('use', () => { if (v.t50U > 1e-3 && v.t50U < 1e14) ax.dot(v.TU, v.t50U, { r: 0.1, color: C.teal }); });
      // legend row above the plot: the curves can reach every corner of it
      const ly = ax.y + ax.h + 0.2;
      p.line(ax.x, ly, ax.x + 0.3, ly, { color: C.yellow, width: 3.5 });
      p.text(`test, ${jS(v.jT)}`, ax.x + 0.38, ly, { size: 0.18, color: C.text });
      p.alpha(p.vis('use'), () => {
        p.line(ax.x + 2.6, ly, ax.x + 2.9, ly, { color: C.teal, width: 3.5 });
        p.text(`use, ${jS(v.jU)}`, ax.x + 2.98, ly, { size: 0.18, color: C.text });
      });
      ax.place('measured', ax.around(v.TT, v.t50T, 0.16).concat(ax.around(v.TT, v.t50T, 0.4), ax.around(v.TT, v.t50T, 0.75)), { color: C.yellow, size: 0.19, key: 'meas' });
      if (p.vis('use') > 0.01 && v.t50U > 1e-3 && v.t50U < 1e14) p.alpha(p.vis('use'), () => ax.place(timeS(v.t50U), ax.around(v.TU, v.t50U, 0.16).concat(ax.around(v.TU, v.t50U, 0.4), ax.around(v.TU, v.t50U, 0.75)), { color: C.teal, size: 0.19, key: 'uselife' }));
    },

    readout: v => MFW.chars([
      ['activation energy', 'E<sub>a</sub>', `${fmt.num(v.Ea, 2)} eV`],
      ['current exponent', 'n', fmt.num(v.n, 1), ''],
      ['acceleration from the current', '', `${fmt.sig(v.AFj, 3)} ×`, undefined, { f: '(j<sub>test</sub>/j<sub>use</sub>)<sup>n</sup>' }],
      ['acceleration from the temperature', '', `${big(v.AFT)} ×`, undefined, { f: 'exp[(E<sub>a</sub>/k)(1/T<sub>use</sub> − 1/T<sub>test</sub>)]' }],
      ['acceleration factor', 'AF', `${big(v.AF)} ×`],
      ['median life in use', 't<sub>50</sub>', timeS(v.t50U), undefined, { f: 'AF · t<sub>50</sub>(test)' }],
      ['0.1 % of the lines fail within', 't<sub>0.1 %</sub>', timeS(v.tFU), undefined, { hl: true, f: 't<sub>50</sub>·e<sup>−3.09σ</sup>', warn: !v.ok && !v.immortalU }],
      [`highest j for ${LIFE} years at 0.1 %`, 'j<sub>max</sub>', jS(v.jMax)],
      ['Blech product in use', 'j·L', `${fmt.sig(v.jLU, 3)} A/cm`, undefined, { note: `threshold ${v.m.jLc} A/cm` }],
      ['longest immortal line in use', 'L<sub>c</sub>', `${fmt.sig(v.LcU, 3)} µm`, undefined, { f: '(j·L)<sub>c</sub>/j<sub>use</sub>' }],
      v.immortalU && { text: 'In use this line is shorter than the Blech length: the back stress stops the transport and the lifetimes above do not apply – the line should not fail by electromigration at all.' },
      v.immortalT && !v.immortalU && { warn: 'The test line is below the Blech threshold at the test current: such a test would show no failures.' },
      !v.ok && !v.immortalU && { warn: `The 0.1 % life is shorter than ${LIFE} years: lower the current density (widen the line), lower the temperature or shorten the line.` }]),

    steps: [
      { name: 'The electron wind', caption: 'Electrons push metal atoms towards the anode: a void opens at the cathode', set: { metal: 'alLarge', jT: 2, TT: 250, t50T: 100, sigma: 0.5, life: 0.6, L: 100, jU: 0.2, TU: 125 }, duration: 3,
        text: v => `An interconnect carries an enormous current density – here ${jS(v.jT)}, some two thousand times that of a household cable (16 A in 1.5 mm² is about 10³ A/cm²); only the good heat sinking of a thin line on a silicon chip makes this possible. The electrons collide with the metal atoms and push them along, mainly along grain boundaries and surfaces where atoms move easily. Wherever more atoms leave than arrive a <b>void</b> grows – typically at the cathode end, where the supply is blocked – and the displaced metal piles up as <b>hillocks</b> near the anode.` },
      { name: 'Failure and its statistics', caption: 'Half of the lines have failed at the median life t₅₀', set: { life: 1 }, duration: 3,
        text: v => `When the void has cut the line, the circuit is open (in practice a line counts as failed when its resistance has risen by a set amount). Nominally identical lines do not fail together: their failure times follow a <b>lognormal</b> distribution with the median t₅₀ = ${timeS(v.t50T)} and a shape parameter σ = ${fmt.num(v.sigma, 2)} (curve on the left). A product cannot wait for the median – what matters is when the first lines fail.` },
      { name: 'Black’s equation', caption: 't₅₀ = A·j⁻ⁿ·exp(E_a/kT): hot and dense currents shorten the life', set: { life: 0.6 }, show: ['use'], duration: 2,
        text: v => `Black found that the median life falls with the square of the current density and rises exponentially with 1/T: the test at ${degC(v.TT)} was chosen hot and dense on purpose, so that it ends within ${timeS(v.t50T)}. The plot on the right carries the measured point (yellow) to other temperatures and to the lower current density of the product (teal). In use, at ${jS(v.jU)} and ${degC(v.TU)}, the same line has a median life of ${timeS(v.t50U)}.` },
      { name: 'The acceleration factor', caption: v => `AF = ${fmt.sci(v.AF, 1)}: ${fmt.sig(v.AFj, 3)}× from the current, ${big(v.AFT)}× from the temperature`, duration: 1,
        text: v => `The two conditions differ by the <b>acceleration factor</b> AF = (j<sub>test</sub>/j<sub>use</sub>)ⁿ · exp[(E<sub>a</sub>/k)(1/T<sub>use</sub> − 1/T<sub>test</sub>)] = ${fmt.sig(v.AFj, 3)} × ${big(v.AFT)} = ${big(v.AF)}. Most of it comes from the temperature. The distribution keeps its shape, so 0.1 % of the lines fail within t₅₀·e<sup>−3.09σ</sup> = ${timeS(v.tFU)} – ${v.ok ? 'longer' : 'shorter'} than the ${LIFE} years usually required.` },
      { name: 'Current density', caption: 'Twice the current density: a quarter of the life (n = 2)', set: { jU: 0.4 }, duration: 2.5,
        text: v => `Doubling the current density in use to ${jS(v.jU)} divides the life by 2ⁿ = ${fmt.sig(2 ** v.n, 2)}: the 0.1 % life drops to ${timeS(v.tFU)}. This is why design rules limit the current per unit of line width, and why power lines are made wide. For this line the limit for ${LIFE} years would be ${jS(v.jMax)}.` },
      { name: 'Microstructure', caption: 'Fine grains: more grain boundaries, lower E_a – a much shorter life in use', set: { metal: 'alFine', jU: 0.2 }, duration: 1,
        text: v => `Atoms move most easily along grain boundaries. In a fine-grained aluminium film Black measured E<sub>a</sub> = ${v.Ea} eV instead of 0.84 eV for large grains. If such a film gave the same test result, its life in use would be only ${timeS(v.t50U)}: with a small activation energy, cooling from the test temperature to ${degC(v.TU)} helps far less (${big(v.AFT)}× instead of ${big(EM.accel(0.84, 2, 1, v.TT, 1, v.TU))}×). Large grains, a glass cover and a few per cent of copper in the aluminium all slow the transport down.` },
      { name: 'Copper lines', caption: 'Cu damascene: transport along the capped top surface, n ≈ 1.2', set: { metal: 'cu' }, duration: 1,
        text: v => `Copper has a lower resistivity than aluminium and resists electromigration better. In damascene copper lines the fastest path is the interface with the dielectric cap, with E<sub>a</sub> ≈ ${v.Ea} eV. The current exponent is lower, n ≈ ${v.n}: voids nucleate easily, and the life is set by the time they need to <i>grow</i> across the line (n = 1), not by nucleation (n = 2). A lower n means less help from reducing the current: here only ${fmt.sig(v.AFj, 3)}×.` },
      { name: 'Short lines live forever', caption: v => `j·L = ${fmt.sig(v.jLU, 2)} A/cm in use – threshold ${v.m.jLc} A/cm`, set: { metal: 'alLarge', L: 20 }, duration: 2.5,
        text: v => `The atoms pushed towards the anode compress the metal there, and the stress gradient drives them back. In a short line this back flow balances the electron wind before any void can form. Blech found that this happens below a threshold of the product j·L. At ${jS(v.jU)} a line shorter than L<sub>c</sub> = ${fmt.sig(v.LcU, 3)} µm is “immortal” – this one, ${fmt.sig(v.L, 2)} µm long, ${v.immortalU ? 'qualifies' : 'does not qualify'}. Designers use this by breaking long lines with vias.` },
    ],
  });

  // ------------------------------------------------------------ "Run test" button on the stage
  if (widget && widget.stage && typeof document !== 'undefined') {
    const bar = document.createElement('div');
    bar.className = 'mfw-stagebar mfw-stagebar-right';
    const mk = (label, title, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); bar.appendChild(b); return b; };
    mk('▶ Run test', 'Stress the line until the median line fails', () => {
      if (widget.mode === 'tour') widget.setMode('explore');
      widget.set({ life: 0 });
      widget.animate({ life: 1.2 }, 7, 'linear');
    });
    widget.stage.appendChild(bar);
  }
}());
