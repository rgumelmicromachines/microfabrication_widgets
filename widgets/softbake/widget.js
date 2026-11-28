/* Soft bake of photoresist: residual solvent, loss of photoactive compound and film shrinkage on a hotplate or in a
   convection oven. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const SB = MFW_SB;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const T0 = nowMs();
  const timeS = s => (s < 90 ? `${fmt.num(s, 0)} s` : `${fmt.sig(s / 60, 2)} min`);
  const degC = T => `${fmt.num(T, 0)} °C`;
  const wt = w => `${fmt.num(w, 1)} wt%`;
  const pc = x => `${fmt.sig(100 * x, 2)} %`;
  const MODE = { hotplate: 'hotplate', oven: 'convection oven' };
  // residual solvent read from Fig. 2 of Gardiner et al. 1997 (±0.5 wt%): [minutes, wt%]
  const DATA = { 70: [[1, 22], [2, 20.5], [3, 20.4], [6, 20], [10, 19]], 90: [[1, 18.2], [1.5, 17.9], [2.5, 16.3], [4, 16.5], [7, 15.6]], 110: [[1, 13.2], [1.5, 12.5], [2.5, 11.7]] };
  const TS = M.logspace(5, 3600, 160), TEMPS = M.linspace(60, 130, 71);

  const widget = MFW.widget('#app', {
    title: 'Soft bake: drying the resist without damaging it',
    loop: true,                                                             // the solvent vapour moves all the time
    alt: v => `Soft bake of a 1.15 µm DNQ/novolak resist film, ${MODE[v.mode]} at ${degC(v.T)} for ${timeS(v.t)}: ${wt(v.w)} solvent left of 28 wt% after spin coating, film ${pc(1 - v.thick)} thinner, ${pc(v.pacLost)} of the photoactive compound decomposed.`,
    source: 'Residual solvent: empirical desorption law fitted by A. B. Gardiner et al. (<i>Proc. SPIE</i> 3049 (1997) 850) to their measurements of PGMEA in a 1.15 µm novolak/DNQ film on a vacuum hotplate at 70, 90 and 110 °C; outside this range the law is extrapolated. Photoactive compound: first-order decomposition with the parameters of Kodak 820 resist (C. A. Mack, R. T. Carback, Interface ’85; C. A. Mack, <i>Inside PROLITH</i>, 1997). Oven: the film is treated as cold during the warm-up time and at the bake temperature afterwards. Thickness from a mass balance with additive volumes. The picture is schematic except for the film thickness relative to the as-spun film.',
    freeText: v => `Explore – find a bake that removes the solvent that can be removed without losing photoactive compound. Now: ${wt(v.w)} solvent left, ${pc(v.pacLost)} of the photoactive compound gone. Press <b>▶ Run bake</b> to watch the film dry.`,

    params: {
      mode: { value: 'hotplate', label: 'Bake', options: { hotplate: 'Hotplate (vacuum contact)', oven: 'Convection oven' } },
      T: { value: 100, min: 60, max: 130, step: 1, label: 'Bake temperature <i>T</i>', format: degC },
      t: { value: 60, min: 5, max: 3600, log: true, label: 'Bake time <i>t</i>', format: timeS },
      warmup: { value: 300, min: 120, max: 600, step: 10, label: 'Oven: warm-up time of the wafer', format: timeS, when: v => v.mode === 'oven' },
    },
    layers: { data: false, pac: false },
    explore: { show: ['data', 'pac'] },

    derived: v => {
      const s = SB.state(v), dt = Math.max(1, 0.1 * s.tEff);
      return { ...s, rate: s.tEff > 0 ? (SB.solvent(v.T, Math.max(0, s.tEff - dt)) - SB.solvent(v.T, s.tEff + dt)) / (2 * dt) : 0 };
    },

    tex: [
      { at: [2.75, 3.42], tex: 'w(t) = w_0 - M_\\infty(T)\\left[1 - f\\!\\left(D\\,t/l^2\\right)\\right]', size: 0.26 },
    ],

    draw(p, v) {
      const tAnim = (nowMs() - T0) / 1000, oven = v.mode === 'oven', warming = oven && v.t < v.warmup;
      // ---------------------------------------------------------- the bake (schematic)
      const x0 = -5.9, x1 = -1.6, yP = 1.05, yW = 1.4, yR = 1.58, hR = 0.62;
      p.text(`${oven ? 'convection oven' : 'hotplate'} (schematic; film thickness relative to the as-spun film)`, -6.85, 3.5, { size: 0.19, color: C.muted });
      const heat = 0.2 + 0.6 * (v.T - 60) / 70;
      if (oven) {
        p.box(x0 - 0.9, yP - 0.1, x1 + 0.45, 3.2, { stroke: C.greyB, width: 2 });
        p.line(x0 - 0.2, yW, x1 + 0.2, yW, { color: C.greyB, width: 2 });                      // shelf
        for (let i = 0; i < 3; i++) {                                                        // hot air circulating
          const yy = 2.75 - 0.05 * i, xx = x0 + 0.3 + 1.5 * i + 0.25 * Math.sin(tAnim * 0.8 + i);
          p.arrow(xx, yy + 0.3, xx + 0.7, yy + 0.3, { color: C.red, width: 2, head: 0.12, alpha: heat, noOcc: true });
        }
        p.text(`air at ${degC(v.T)}`, x1 + 0.3, 3.0, { size: 0.18, color: C.red, align: 'right' });
      } else {
        p.box(x0 - 0.3, yP - 0.1, x1 + 0.3, yW, { fill: C.red, fillAlpha: heat, stroke: C.greyB, width: 1.5 });
        p.text(`hotplate at ${degC(v.T)}`, (x0 + x1) / 2, (yP - 0.1 + yW) / 2, { size: 0.19, color: C.text, align: 'center' });
      }
      p.box(x0, yW, x1, yR, { fill: MAT.si.fill, stroke: null });
      const top = yR + hR * v.thick;
      p.box(x0, yR, x1, top, { fill: MAT.resist.fill, stroke: null });
      p.line(x0, yR + hR, x1, yR + hR, { color: MAT.resist.stroke, width: 1.2, dash: [0.06, 0.06] });   // as-spun surface
      p.text('as spun', x0 - 0.08, yR + hR, { size: 0.17, color: C.muted, align: 'right' });
      p.text('Si', x0 - 0.08, (yW + yR) / 2, { size: 0.17, color: C.muted, align: 'right' });
      // solvent molecules in the film (number ∝ residual solvent) and leaving it (number ∝ evaporation rate)
      const nIn = Math.round(90 * v.w / SB.W0);
      for (let i = 0; i < nIn; i++) p.circle(x0 + 0.08 + (x1 - x0 - 0.16) * hash(i + 0.21), yR + 0.05 + (top - yR - 0.1) * hash(i + 0.57), 0.035, { fill: C.teal, stroke: null });
      const nOut = warming ? 0 : Math.min(30, Math.round(120 * v.rate));
      for (let i = 0; i < nOut; i++) {
        const u = (tAnim * 0.35 + hash(i + 0.13)) % 1, x = x0 + 0.2 + (x1 - x0 - 0.4) * hash(i + 0.77) + 0.12 * Math.sin(6 * u + i);
        p.circle(x, yR + hR + 0.12 + 0.75 * u, 0.035, { fill: C.teal, stroke: null, alpha: 1 - u });
      }
      p.dot(-6.75, 0.62, { r: 0.045, color: C.teal });
      p.text('solvent', -6.63, 0.62, { size: 0.18, color: C.text });
      p.text(warming ? `wafer still warming up (${timeS(v.warmup - v.t)} to go)` : `${timeS(v.tEff)} at ${degC(v.T)}: ${wt(v.w)} solvent left, film ${pc(1 - v.thick)} thinner`,
        -5.6, 0.62, { size: 0.19, color: C.text, bold: true });

      // ---------------------------------------------------------- result vs bake temperature at this bake time
      const at = p.axes({ x: -5.85, y: -2.7, w: 4.9, h: 2.55, xr: [60, 130], yr: [0, 30], grid: true, size: 0.19,
        xticks: [60, 70, 80, 90, 100, 110, 120, 130], yticks: [0, 10, 20, 30],
        xlabel: `bake temperature (°C), after ${timeS(v.t)}`, ylabel: 'solvent wt% · PAC %', ylabelOffset: 0.55 }).draw();
      const eff = oven ? Math.max(0, v.t - v.warmup) : v.t;
      p.clip(at.x, at.y, at.x + at.w, at.y + at.h, () => {
        for (const T of SB.T_FIT) at.vline(T, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
        at.curve(TEMPS, TEMPS.map(T => SB.solvent(T, eff)), { color: C.yellow, width: 3.5 });
        p.layer('pac', () => at.curve(TEMPS, TEMPS.map(T => 100 * (1 - SB.pacLeft(T, eff))), { color: C.red, width: 3 }));
      });
      at.dot(v.T, v.w, { r: 0.09, color: C.yellow });
      p.layer('pac', () => { if (100 * v.pacLost <= 30) at.dot(v.T, 100 * v.pacLost, { r: 0.08, color: C.red }); });
      p.text('measured 70–110 °C', at.X(90), at.y + at.h + 0.18, { size: 0.17, color: C.muted, align: 'center' });

      // ---------------------------------------------------------- result vs bake time at this temperature
      const ax = p.axes({ x: 1.2, y: -2.7, w: 5.3, h: 5.05, xr: [5, 3600], yr: [0, 30], xlog: true, grid: true, size: 0.21,
        xticks: [10, 60, 600, 3600], xfmt: s => (s < 60 ? `${s} s` : `${s / 60} min`), yticks: [0, 5, 10, 15, 20, 25, 30],
        xlabel: 'bake time (log scale)', ylabel: 'solvent (wt%) · photoactive compound lost (%)', ylabelOffset: 0.6 }).draw();
      const clock = t => (oven ? Math.max(0, t - v.warmup) : t);
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        p.layer('data', () => {
          for (const T of [70, 90, 110]) if (!oven && T !== v.T) ax.curve(TS, TS.map(t => SB.solvent(T, t)), { color: C.grey, width: 1.8 });
          if (!oven) for (const T of [70, 90, 110]) for (const [mn, w] of DATA[T]) p.circle(ax.X(mn * 60), ax.Y(w), 0.055, { fill: T === v.T ? C.yellow : C.grey, stroke: C.bg, width: 1 });
        });
        ax.hline(v.plateau, { color: C.yellow, dash: [0.03, 0.06], width: 1.5 });
        ax.curve(TS, TS.map(t => SB.solvent(v.T, clock(t))), { color: C.yellow, width: 4 });
        p.layer('pac', () => ax.curve(TS, TS.map(t => 100 * (1 - SB.pacLeft(v.T, clock(t)))), { color: C.red, width: 3 }));
        if (oven) ax.vline(v.warmup, { color: C.muted, dash: [0.08, 0.06], width: 1.5 });
      });
      ax.dot(v.t, v.w, { r: 0.1, color: C.yellow });
      p.layer('pac', () => { if (100 * v.pacLost <= 30) ax.dot(v.t, 100 * v.pacLost, { r: 0.085, color: C.red }); });
      // legend row above the plot
      const ly = ax.y + ax.h + 0.2;
      p.line(ax.x, ly, ax.x + 0.3, ly, { color: C.yellow, width: 4 });
      p.text('solvent', ax.x + 0.38, ly, { size: 0.18, color: C.text });
      p.alpha(p.vis('pac'), () => {
        p.line(ax.x + 1.3, ly, ax.x + 1.6, ly, { color: C.red, width: 3 });
        p.text('PAC lost', ax.x + 1.68, ly, { size: 0.18, color: C.text });
      });
      p.alpha(oven ? 0 : p.vis('data'), () => {
        p.circle(ax.x + 2.95, ly, 0.055, { fill: C.grey, stroke: null });
        p.text('measured, 70 / 90 / 110 °C', ax.x + 3.08, ly, { size: 0.18, color: C.text });
      });
    },

    readout: v => MFW.chars([
      ['solvent left in the film', 'w', wt(v.w), undefined, { hl: true, note: `of ${SB.W0} wt% after spin coating` }],
      ['lowest value reachable at this temperature', '', wt(v.plateau), undefined, { f: 'w<sub>0</sub> − M<sub>∞</sub>(T)' }],
      ['film thickness', '', `${fmt.num(100 * v.thick, 1)} %`, undefined, { note: 'of the as-spun film' }],
      ['photoactive compound decomposed', '1 − m′', pc(v.pacLost), undefined, { f: '1 − exp(−K<sub>T</sub>·t)' }],
      ['time at the bake temperature', '', timeS(v.tEff)],
      ['diffusion time of the fit', 'l²/D', timeS(v.tau)],
      !v.inRange && { warn: 'Outside 70–110 °C the solvent law is extrapolated beyond the measurements it was fitted to.' }]),

    steps: [
      { name: 'Fresh from the spinner', caption: 'A spun film is still more than a quarter solvent', set: { mode: 'hotplate', T: 100, t: 5 }, duration: 1,
        text: v => `Spin coating leaves a film that looks dry but is not: this 1.15 µm resist still holds about ${SB.W0} wt% of its casting solvent (PGMEA). Such a film is soft and sticky – it would stick to a contact mask, dissolve too fast in the developer even where it was not exposed (dark erosion), and release bubbles during exposure. The <b>soft bake</b> drives the solvent out.` },
      { name: 'One minute on the hotplate', caption: v => `${degC(v.T)}, ${timeS(v.t)}: ${wt(v.w)} left, film ${pc(1 - v.thick)} thinner`, set: { t: 60 }, duration: 4,
        text: v => `A hotplate with vacuum contact brings the wafer to temperature within a few seconds. After ${timeS(v.t)} at ${degC(v.T)} the solvent content has dropped to ${wt(v.w)}, most of it in the first half minute (the time axis is logarithmic). The film shrinks as the solvent leaves – here by about ${pc(1 - v.thick)}. Spin curves in datasheets give the thickness <i>after</i> this bake.` },
      // interactive tour from here on: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
      { name: 'The solvent that will not leave', caption: 'Ten times longer removes almost nothing more', from: { mode: 'hotplate', T: 100, t: 60 }, set: { mode: 'hotplate', T: 100, t: 600 }, duration: 4,
        ask: { q: 'After one minute at 100 °C the film still holds about 15.6 wt% solvent. The bake is continued to ten minutes. How much solvent is left then?',
          options: ['Almost none – ten times longer dries the film out', 'About half as much: 8 wt%', 'Nearly as much as before: about 14 wt%'], correct: 2 },
        text: v => `Baking ten times longer brings the film only to ${wt(v.w)}: the curve runs into a plateau (dotted). The drier the resin, the slower the solvent diffuses through it – by orders of magnitude – so the last part is practically locked in at this temperature. The result of a soft bake is therefore set mainly by the temperature.` },
      { name: 'Temperature sets the plateau', caption: v => `${degC(v.T)}: plateau at ${wt(v.plateau)}`, set: { mode: 'hotplate', T: 100, t: 60 }, show: ['data'], duration: 2.5,
        task: 'Back to a bake of one minute. At 100 °C no bake time brings the film below 13.7 wt% solvent. Raise the <b>Bake temperature <i>T</i></b> until the film dries to 13.5 wt% or less.',
        goal: v => v.w <= 13.5, solution: { T: 110 },
        text: v => `At ${degC(v.T)} the film dries to ${wt(v.w)} within ${timeS(v.tEff)}; at 70 °C the same time leaves ${wt(SB.solvent(70, v.tEff))}. The points are measurements on a hotplate at 70, 90 and 110 °C (Gardiner et al. 1997), the curves the empirical law fitted to them. A reproducible bake temperature matters more than anything else – a few degrees change the solvent content, and with it the development rate and the linewidth.` },
      { name: 'Too hot', caption: v => `${degC(v.T)}: ${pc(v.pacLost)} of the photoactive compound is destroyed`, from: { mode: 'hotplate', T: 100, t: 60 }, set: { mode: 'hotplate', T: 125, t: 90 }, show: ['pac'], duration: 2.5,
        ask: { q: 'Why not simply bake hotter? Heat also decomposes the photoactive compound of the resist. One minute at 100 °C destroys about 0.4 % of it. A bake of 90 s at 125 °C would leave only about 9 wt% solvent – how much of the photoactive compound does it destroy?',
          options: ['About the same: 0.4 %', 'A little more: about 1 %', 'Almost twenty times as much: about 7 %'], correct: 2 },
        text: v => `The photoactive compound of a DNQ resist decomposes when heated, at a rate that roughly triples every 10 °C (red curve, E<sub>a</sub> ≈ 30 kcal/mol). At ${degC(v.T)} already ${pc(v.pacLost)} is gone after ${timeS(v.t)}, against ${pc(1 - SB.pacLeft(100, 60))} for a minute at 100 °C. Less photoactive compound means less difference between exposed and unexposed resist: lower contrast.` },
      { name: 'The compromise', caption: v => `${degC(v.T)}, ${timeS(v.t)}: ${wt(v.w)} solvent left, ${pc(v.pacLost)} of the photoactive compound lost`, set: { mode: 'hotplate', T: 125, t: 90 }, duration: 1,
        task: 'This bake leaves 8.9 wt% solvent but costs 7.2 % of the photoactive compound. With <b>Bake temperature <i>T</i></b> and <b>Bake time <i>t</i></b> find a bake that leaves at most 13 wt% solvent and destroys at most 2.5 % of the photoactive compound (targets chosen for this exercise, not a specification).',
        goal: v => v.w <= 13 && v.pacLost <= 0.025, solution: { T: 113, t: 60 },
        text: v => `${degC(v.T)} for ${timeS(v.tEff)} leaves ${wt(v.w)} solvent and costs ${pc(v.pacLost)} of the photoactive compound. A hotter or longer bake destroys more of the compound; a cooler one leaves solvent that no bake time removes (the plateau at 100 °C is ${wt(SB.W0 - SB.desorbable(100))}).` },
      { name: 'Oven instead of hotplate', caption: 'Half an hour in an oven: the wafer first has to warm up', set: { mode: 'oven', T: 90, t: 1800, warmup: 300 }, duration: 2,
        text: v => `In a convection oven the heat arrives slowly through the air, and a cassette of wafers needs minutes to reach the set temperature (dashed line). Oven bakes are therefore long – typically around 90 °C for half an hour. The solvent ends at about the same level (${wt(v.w)}), but ${timeS(v.tEff)} at temperature cost ${pc(v.pacLost)} of the photoactive compound, and the warm-up differs from wafer to wafer. Hotplates – one wafer, about a minute, tightly controlled – have replaced ovens for this step.` },
    ],
  });

  // ------------------------------------------------------------ "Run bake" button on the stage
  if (widget && widget.stage && typeof document !== 'undefined') widget.stageBar([
    { icon: '▶', label: 'Run bake', title: 'Bake from the start to the set time', onClick: () => {
      if (widget.mode === 'tour') widget.setMode('explore');
      const t = Math.max(30, widget.values.t);
      widget.set({ t: 5 });
      widget.animate({ t }, 6, 'linear');
    } },
  ], { right: true });
}());
