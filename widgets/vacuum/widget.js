/* High-vacuum pump-down: conductance and effective speed, flow regimes, outgassing, mean free path, monolayer time.
   Topic: fundamentals. */
(function () {
  const { C, M, fmt } = MFW;
  const VA = MFW_VAC;
  const pa = p => `${fmt.sci(p, 1)} Pa`;
  const ls = s => `${fmt.sig(s, 3)} L/s`;
  const cm = x => (x >= 100000 ? `${fmt.sig(x / 100000, 2)} km` : x >= 100 ? `${fmt.sig(x / 100, 2)} m` : x >= 1 ? `${fmt.sig(x, 2)} cm` : x >= 0.1 ? `${fmt.sig(x * 10, 2)} mm` : `${fmt.sig(x * 1e4, 2)} µm`);
  const dur = s => (!isFinite(s) ? '–' : s < 60 ? `${fmt.sig(s, 2)} s` : s < 3600 ? `${fmt.sig(s / 60, 2)} min` : `${fmt.sig(s / 3600, 2)} h`);
  const TMAX = 3.6e5;
  const RNG = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const DOTS = Array.from({ length: 60 }, () => [RNG(), RNG()]);
  const RANGE_COL = () => [C.red, C.gold, C.green, C.blue, C.purple];

  let memoKey = null, memo = null;
  const curveOf = v => { const key = [v.V, v.S, v.d, v.l, v.mat].join('|'); if (key !== memoKey) { memo = VA.pumpDown(v, TMAX); memoKey = key; } return memo; };

  MFW.widget('#app', {
    title: 'Vacuum: pump-down, conductance and outgassing',
    alt: v => `A ${fmt.num(v.V, 0)} L chamber pumped by a ${ls(v.S)} pump through a ${fmt.sig(v.d, 2)} cm × ${fmt.sig(v.l, 2)} cm pipe: effective speed ${ls(v.SeffMol)} in molecular flow; after ${dur(v.tc)} the pressure is ${pa(v.p)} (${v.range}); ${fmt.sci(v.target, 0)} Pa is reached after ${dur(v.tTarget)}.`,
    source: 'Pipe conductance: Knudsen\'s formula for air (W. Umrath, <i>Fundamentals of Vacuum Technology</i>, Leybold 2016, eqs. 1.26–1.28) with Dushman\'s entrance correction (J. F. O\'Hanlon, <i>A User\'s Guide to Vacuum Technology</i>, 3rd ed., 2003, eq. 3.24); effective speed 1/S<sub>eff</sub> = 1/S + 1/C; pump-down V·dp/dt = −S<sub>eff</sub>·p + Q(t). Outgassing per area after 1 h of pumping, falling as 1/t (Leybold Table X; Pfeiffer Vacuum Know-how; baked steel: Chiggiato 2017) – indicative values, published data scatter by more than 10×. Mean free path and monolayer time of air (O\'Hanlon). The pump speed is taken as constant; the chamber is a cube; pumping starts at 1 Pa after 5 min of roughing.',
    freeText: v => `Explore – how long does it take to reach ${pa(v.target)}? Try a wider or shorter pipe, a bigger pump, a smaller chamber – and a baked chamber.`,

    params: {
      V: { value: 100, min: 10, max: 1000, log: true, label: 'Chamber volume <i>V</i>', format: x => `${fmt.sig(x, 3)} L` },
      mat: { value: 'ss', label: 'Chamber walls', options: { ss: 'Stainless steel, unbaked', al: 'Aluminium, unbaked', baked: 'Stainless steel, baked (150 °C, 24 h)' } },
      S: { value: 300, min: 10, max: 3000, log: true, label: 'Pump speed <i>S</i> (high-vacuum pump)', format: ls },
      d: { value: 10, min: 1, max: 20, log: true, label: 'Pipe diameter <i>d</i>', format: x => `${fmt.sig(x, 2)} cm` },
      l: { value: 30, min: 5, max: 200, log: true, label: 'Pipe length <i>l</i>', format: x => `${fmt.sig(x, 3)} cm` },
      tc: { value: 60, min: 1, max: TMAX, log: true, label: 'Time after the start of high-vacuum pumping', format: dur },
      target: { value: 1e-4, min: 1e-7, max: 1e-1, log: true, label: 'Target pressure', format: pa, group: 'Target' },
    },
    layers: { parts: false },
    explore: { show: ['parts'] },

    derived: v => {
      const curve = curveOf(v), p = VA.pAt(curve, v.tc), Cmol = VA.molecularConductance(v.d, v.l);
      const C = VA.conductance(v.d, v.l, p), Q = VA.gasLoad(v.mat, v.V, v.tc), Seff = VA.sEff(v.S, C);
      return { curve, p, C, Cmol, Seff, SeffMol: VA.sEff(v.S, Cmol), Q, lam: VA.lambda(p), Kn: VA.knudsen(p, v.d), regimeName: VA.regime(VA.knudsen(p, v.d)),
        range: VA.rangeName(p), tml: VA.monolayer(p), tTarget: VA.timeTo(curve, v.target), pEnd: curve[curve.length - 1].p, tau: v.V / VA.sEff(v.S, Cmol) };
    },

    tex: [
      { at: [0, 3.42], tex: 'V\\frac{dp}{dt} = -S_{eff}\\,p + Q(t),\\qquad \\frac{1}{S_{eff}} = \\frac{1}{S} + \\frac{1}{C},\\qquad S_{eff} = {{SeffMol:auto}}\\ \\mathrm{L/s}\\ (\\text{molecular flow})', size: 0.32 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- chamber – pipe – pump, to scale
      const side = Math.cbrt(v.V * 1000);                                     // cm
      const k = w.smooth('k', Math.min(4.0 / (side + v.l), 2.0 / side, 2.0 / v.d), { log: true });
      const x0 = -6.5, yc = 1.45, hs = side * k / 2, xc1 = x0 + side * k, xp1 = xc1 + v.l * k, hd = v.d * k / 2;
      p.box(x0, yc - hs, xc1, yc + hs, { fill: MFW.MAT.metal.fill, fillAlpha: 0.35, stroke: C.greyB, width: 2 });
      p.box(xc1, yc - hd, xp1, yc + hd, { fill: MFW.MAT.metal.fill, fillAlpha: 0.2, stroke: C.greyB, width: 2 });
      // flanges: one where the pipe leaves the chamber, a bolted pair between the pipe and the pump inlet
      const fw = 0.06, fh = hd + Math.min(0.15, Math.max(0.05, 0.35 * hd));
      const flange = xa => p.box(xa, yc - fh, xa + fw, yc + fh, { fill: C.greyB, stroke: C.greyA, width: 1 });
      flange(xc1); flange(xp1 - fw); flange(xp1);
      // high-vacuum pump (turbomolecular, schematic size): housing on the inlet flange, rotor and stator blade rows,
      // motor at the back, foreline to the backing pump at the bottom
      const xb0 = xp1 + fw, xb1 = xb0 + 0.62, ph = Math.max(0.42, fh + 0.04);
      p.box(xb0, yc - ph, xb1, yc + ph, { fill: C.greyD, stroke: C.greyB, width: 2 });
      for (let i = 0; i < 4; i++) {
        const xr = xb0 + 0.1 + i * 0.09, s = i % 2 ? -0.035 : 0.035;          // alternating blade angle: rotor, stator, …
        for (let y = yc - ph + 0.1; y <= yc + ph - 0.1 + 1e-9; y += 0.08) p.line(xr - s, y - 0.03, xr + s, y + 0.03, { color: C.greyA, width: 1.5, noOcc: true });
      }
      p.box(xb1 - 0.17, yc - 0.17, xb1 - 0.05, yc + 0.17, { fill: C.greyB, stroke: null });   // motor
      const xf = xb1 - 0.11;
      p.box(xf - 0.05, yc - ph - 0.16, xf + 0.05, yc - ph, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.arrow(xf, yc - ph - 0.12, xf, yc - ph - 0.42, { color: C.greyA, width: 1.5, head: 0.08 });
      const pcx = (xb0 + xb1) / 2;
      p.place(`pump ${ls(v.S)}`, [[xf + 0.12, yc - ph - 0.3, 'left'], [xf - 0.12, yc - ph - 0.3, 'right'], [xf + 0.12, yc - ph - 0.55, 'left']], { size: 0.18, color: C.text, key: 'pump' });
      // gas molecules: fewer dots at lower pressure (one per ~quarter decade above 10⁻¹⁰ Pa, schematic)
      const nd = Math.max(0, Math.min(DOTS.length, Math.round(4 * Math.log10(v.p / 1e-10))));
      p.clip(x0, yc - hs, xc1, yc + hs, () => DOTS.slice(0, nd).forEach(([a, b]) => p.circle(x0 + 0.08 + a * (side * k - 0.16), yc - hs + 0.08 + b * (2 * hs - 0.16), 0.03, { fill: C.blue, stroke: null })));
      p.place(`${fmt.sig(v.V, 3)} L chamber · chamber and pipe to scale`, [[x0, yc - hs - 0.2, 'left'], [x0, yc + hs + 0.2, 'left'], [x0, yc - hs - 0.45, 'left']], { size: 0.18, color: C.text, key: 'chamber' });
      p.place(`pipe ${fmt.sig(v.d, 2)} × ${fmt.sig(v.l, 3)} cm`, [[xc1 + 0.12, yc + ph + 0.2, 'left'], [xc1 + 0.12, yc + ph + 0.45, 'left']], { size: 0.17, color: C.muted, key: 'pipe' });   // above pipe and pump
      p.text(`${v.regimeName} flow in the pipe: Kn = λ/d = ${fmt.sci(v.Kn, 1)}`, x0, -0.15, { size: 0.19, color: C.text });
      p.text(`λ = ${cm(v.lam)},  monolayer in ${dur(v.tml)}`, x0, -0.5, { size: 0.19, color: C.text });

      // ---------------------------------------------------------- pressure scale with the ISO 3529-1 ranges and λ
      const bx0 = -6.5, bx1 = -1.25, by = -1.3, pHi = 1e5, pLo = 1e-11;
      const BX = q => bx0 + (Math.log10(pHi) - Math.log10(q)) / (Math.log10(pHi) - Math.log10(pLo)) * (bx1 - bx0);
      const cols = RANGE_COL(), abbr = ['low', 'medium', 'high', 'UHV', 'XHV'];
      VA.RANGES.forEach(([lo, hi], i) => {
        const a = BX(Math.min(hi, pHi)), b = BX(Math.max(lo, pLo));
        p.box(a, by - 0.14, b, by + 0.14, { fill: cols[i], fillAlpha: 0.35, stroke: null, noOcc: true });
        p.text(abbr[i], (a + b) / 2, by, { size: 0.15, align: 'center', color: C.text });
      });
      for (const q of [1e4, 1e1, 1e-2, 1e-5, 1e-8]) {
        p.line(BX(q), by - 0.13, BX(q), by - 0.22, { color: C.axis, width: 1.5 });
        p.text(q >= 1 ? `10^{${Math.round(Math.log10(q))}}` : `10^{${Math.round(Math.log10(q))}}`, BX(q), by - 0.36, { size: 0.15, align: 'center', color: C.muted });
      }
      p.text('Pa', bx1 + 0.08, by - 0.36, { size: 0.15, color: C.muted });
      const pm = Math.min(pHi, Math.max(pLo, v.p));
      p.polygon([[BX(pm), by + 0.15], [BX(pm) - 0.09, by + 0.3], [BX(pm) + 0.09, by + 0.3]], { fill: C.yellow, stroke: null });
      
      p.text(`now: ${pa(v.p)} – ${v.range}`, bx0, by - 0.72, { size: 0.18, color: C.yellow, bold: true });

      // ---------------------------------------------------------- pressure vs time
      const ax = p.axes({ x: 1.0, y: -2.75, w: 5.6, h: 5.4, xr: [1, TMAX], xlog: true, yr: [1e-8, 10], ylog: true, grid: true, size: 0.2,
        xticks: [1, 10, 60, 600, 3600, 36000, 360000], xfmt: t => (t < 60 ? `${t} s` : t < 3600 ? `${t / 60} min` : `${t / 3600} h`),
        yticks: [1e-8, 1e-6, 1e-4, 1e-2, 1], xlabel: 'time (log)', ylabel: 'pressure (Pa, log)', ylabelOffset: 0.8 }).draw();
      const ts = v.curve.filter(s => s.t >= 1);
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        ax.hline(v.target, { color: C.muted, dash: [0.08, 0.07] });
        p.layer('parts', () => {
          ax.plot(t => VA.P0 * Math.exp(-VA.sEff(v.S, v.Cmol) * t / v.V), { color: C.blue, width: 2.2, dash: [0.1, 0.07], samples: 200 });
          ax.curve(ts.map(s => s.t), ts.map(s => s.Q / s.Seff), { color: C.red, width: 2.2, dash: [0.03, 0.06] });
        });
        ax.vline(v.tc, { color: C.greyB, dash: null, width: 1.5, to: v.p });
        ax.curve(ts.map(s => s.t), ts.map(s => s.p), { color: C.yellow, width: 4 });
      });
      const inPlot = v.p >= 1.2e-8;
      if (inPlot) ax.dot(v.tc, v.p, { r: 0.09 });
      ax.legend([
        { label: 'pressure p(t)', color: C.yellow, width: 4 },
        { label: 'volume only: p₀·exp(−S_{eff} t/V)', color: C.blue, dash: [0.1, 0.07], alpha: p.vis('parts') },
        { label: 'outgassing limit Q(t)/S_{eff}', color: C.red, dash: [0.03, 0.06], alpha: p.vis('parts') },
      ], { at: [bx0, -2.2], size: 0.17 });
      ax.place('target', [0.12, 0.4].flatMap(d => [[ax.x + ax.w - 0.1, ax.Y(v.target) + d, 'right', 'bottom'], [ax.x + ax.w - 0.1, ax.Y(v.target) - d, 'right', 'top'], [ax.x + 0.15, ax.Y(v.target) + d, 'left', 'bottom'], [ax.x + 0.15, ax.Y(v.target) - d, 'left', 'top']]),
        { color: C.muted, size: 0.18, key: 'target' });
      if (isFinite(v.tTarget) && v.tTarget >= 1) {
        ax.dot(v.tTarget, v.target, { r: 0.07, color: C.muted });
        ax.place(`after ${dur(v.tTarget)}`, ax.around(v.tTarget, v.target, 0.15).concat(ax.around(v.tTarget, v.target, 0.45)), { color: C.muted, size: 0.18, key: 'ttarget' });
      }
      if (inPlot) ax.place(pa(v.p), ax.around(v.tc, v.p, 0.16).concat(ax.around(v.tc, v.p, 0.45), ax.around(v.tc, v.p, 0.8)), { color: C.yellow, size: 0.19, key: 'pnow' });
    },

    readout: v => MFW.chars([
      ['pipe conductance (molecular flow)', 'C', ls(v.Cmol), undefined, { f: '12.1·d³/(l + 4d/3)' }],
      ['effective pumping speed (molecular flow)', 'S<sub>eff</sub>', ls(v.SeffMol), undefined, { hl: true, note: `${fmt.num(100 * v.SeffMol / v.S, 0)} % of S` }],
      ['time constant', 'τ', dur(v.tau), undefined, { f: 'V/S<sub>eff</sub>' }],
      [`pressure after ${dur(v.tc)}`, 'p', pa(v.p), undefined, { note: v.range }],
      ['gas load from the walls', 'Q', `${fmt.sci(v.Q, 1)} Pa·L/s`, undefined, { f: `wall area ${fmt.sig(VA.area(v.V) / 1e4, 2)} m²` }],
      ['mean free path', 'λ', cm(v.lam)],
      ['Knudsen number', 'Kn', fmt.sci(v.Kn, 1), '', { f: 'λ/d', note: v.regimeName }],
      ['monolayer time (sticking 1)', '', dur(v.tml)],
      [`time to ${pa(v.target)}`, '', isFinite(v.tTarget) ? dur(v.tTarget) : 'not within 100 h'],
      ['pressure after 100 h', '', pa(v.pEnd)]]),

    steps: [
      { name: 'Pumping out the volume', caption: 'p = p₀·exp(−S_{eff}·t/V): seconds for the gas in the volume', set: { V: 100, mat: 'ss', S: 300, d: 10, l: 30, tc: 5, target: 1e-4 }, show: ['parts'], duration: 1.5,
        text: v => `After roughing to 1 Pa, a high-vacuum pump (here ${ls(v.S)}) takes over. The gas in the volume is removed exponentially with the time constant τ = V/S<sub>eff</sub> = ${dur(v.tau)} (blue dashed): after a few seconds the volume itself is empty. Gas molecules in the chamber are drawn schematically, fewer as the pressure falls.` },
      { name: 'The pipe limits the pump', caption: '1/S_{eff} = 1/S + 1/C – a narrow pipe wastes a big pump', set: { d: 3, l: 100 }, duration: 2,
        ask: { q: 'The pump is moved away from the chamber: the pipe between them is now 3 cm wide and 100 cm long instead of 10 cm × 30 cm. How much pumping speed is left at the chamber?',
          options: ['Almost as much as before: about 140 L/s', 'About 30 L/s', 'About 3 L/s'], correct: 2 },
        text: v => `The pump can only remove what the pipe lets through. In molecular flow a round pipe conducts C = 12.1·d³/(l + 4d/3) L/s (d, l in cm, air; ≈ 12.1·d³/l for a long pipe): a ${fmt.sig(v.d, 2)} cm × ${fmt.sig(v.l, 3)} cm pipe gives only ${ls(v.Cmol)}, so the ${ls(v.S)} pump acts as ${ls(v.SeffMol)} – ${fmt.sig(100 * v.SeffMol / v.S, 2)} % of its speed.` },
      { name: 'A wider pipe', caption: 'C ∝ d³: the diameter counts most', set: { d: 3, l: 100 }, duration: 1,
        task: 'Keep the pipe 100 cm long and make it wider: raise the <b>Pipe diameter <i>d</i></b> until at least half of the pump speed reaches the chamber (S<sub>eff</sub> of 150 L/s or more in the readout).',
        goal: v => v.SeffMol >= 150, solution: { d: 16 },
        text: v => `A ${fmt.sig(v.d, 2)} cm × ${fmt.sig(v.l, 3)} cm pipe conducts ${ls(v.Cmol)}, and the ${ls(v.S)} pump acts as ${ls(v.SeffMol)} (${fmt.num(100 * v.SeffMol / v.S, 0)} % of S). Conductance grows with d³ – pumps are mounted as close and as wide as possible.` },
      { name: 'Flow regimes', caption: 'Kn = λ/d: viscous flow at high pressure, molecular flow in high vacuum', set: { d: 10, l: 30, tc: 1 }, duration: 1.5,
        text: v => `At ${pa(v.p)} the mean free path is ${cm(v.lam)}, Kn = λ/d = ${fmt.sci(v.Kn, 1)}: ${v.regimeName} flow. At higher pressure the molecules collide mostly with each other and flow together (viscous, C ∝ d⁴·p); in high vacuum each molecule travels from wall to wall on its own (molecular flow, C independent of p). The pipe conductance then settles at its constant molecular value, far below the viscous one.` },
      { name: 'Outgassing takes over', caption: 'Below ~10⁻² Pa the walls, not the volume, set the pressure: p ≈ Q(t)/S_{eff}', set: { tc: 60 }, duration: 2,
        task: 'The gas in the volume is gone within seconds, yet after a minute the pressure is still far above the target of 10⁻⁴ Pa (dashed line). Move the <b>Time after the start of high-vacuum pumping</b> forward until the pressure has fallen to the target.',
        goal: v => v.p <= 1.1 * v.target && v.p >= 0.8 * v.target, solution: { tc: 30000 },
        text: v => (v.mat === 'baked'
          ? `With baked walls the gas load is only ${fmt.sci(v.Q, 1)} Pa·L/s, and ${pa(v.target)} is reached after ${dur(v.tTarget)}. Set <b>Chamber walls</b> back to unbaked stainless steel to see how adsorbed water slows the pump-down.`
          : `After the volume is gone, the pressure follows the gas released by the walls – mostly water adsorbed on the unbaked metal, Q ∝ 1/t (red dotted). After ${dur(v.tc)} the walls deliver ${fmt.sci(v.Q, 1)} Pa·L/s and the pressure is ${pa(v.p)}. Reaching ${pa(v.target)} takes ${isFinite(v.tTarget) ? dur(v.tTarget) : 'more than 100 h'}, although the time constant of the volume is only ${dur(v.tau)}: the time is now set by the walls, not by the pump.`) },
      { name: 'Baking the chamber', caption: 'Heating drives off the water: orders of magnitude lower gas load', from: { tc: 3600 }, set: { mat: 'baked', tc: 3600 }, duration: 1.5,
        ask: { q: 'The unbaked chamber needs about 8 h to reach 10⁻⁴ Pa. Now it is baked at 150 °C for a day, which drives the adsorbed water off the walls. How long does the same pump-down from 1 Pa to 10⁻⁴ Pa take afterwards?',
          options: ['About 4 h', 'About 1 h', 'A few seconds'], correct: 2 },
        text: v => `Baking the chamber at 150 °C for a day removes the adsorbed water; what is left is a small, nearly constant hydrogen outgassing from the steel. The same chamber now reaches ${pa(v.target)} after ${dur(v.tTarget)} and ${pa(v.pEnd)} after 100 h – the way to ultra-high vacuum. Outgassing data scatter widely between sources; the numbers here are indicative.` },
      { name: 'Why vacuum?', caption: 'Mean free path and monolayer time decide what a process needs', set: { mat: 'ss', tc: 36000 }, duration: 1.5,
        ask: { q: 'Back to the unbaked chamber after 10 h of pumping: about 8×10⁻⁵ Pa, well inside the high-vacuum range. If every gas molecule that hits a freshly cleaned surface sticks, how long does it take until the surface is covered by one monolayer?',
          options: ['About 3 seconds', 'About 3 hours', 'About 3 days'], correct: 0 },
        text: v => `At ${pa(v.p)} a molecule flies ${cm(v.lam)} between collisions – far more than the chamber, so evaporated atoms travel in straight lines (see the PVD lesson). But a clean surface is still covered by a monolayer of residual gas within ${dur(v.tml)} if every molecule sticks: surface-sensitive work needs ultra-high vacuum. Now switch to <b>Explore</b>.` },
    ],
  });
}());
