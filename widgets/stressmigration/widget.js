/* Stress migration (stress-induced voiding): McPherson–Dunn creep model – the voiding rate has a maximum at an
   intermediate temperature. Topic: interconnects. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const SM = MFW_SM;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const T0MS = nowMs();
  const degC = T => `${fmt.num(T, 0)} °C`;
  const times = x => (x >= 1000 || x < 0.01 ? `${fmt.sci(x, 1)} ×` : `${fmt.sig(x, 3)} ×`);
  const PRESET = SM.PRESETS;
  const par = v => (v.metal === 'custom' ? { T0: v.T0, N: v.N, Ea: v.Ea } : PRESET[v.metal]);
  const TMIN = 25, TMAX = 400;

  MFW.widget('#app', {
    title: 'Stress migration: voids without any current',
    loop: true,                                                             // the vacancies move all the time
    alt: v => `Stress migration with stress-free temperature ${degC(v.p.T0)}, creep exponent ${v.p.N} and activation energy ${v.p.Ea} eV: the voiding rate peaks at ${degC(v.Tp)}; at ${degC(v.T)} it is ${fmt.sig(100 * v.relTest, 2)} % of the maximum, at ${degC(v.Tuse)} ${fmt.sig(100 * v.relUse, 2)} %.`,
    source: 'Creep model of J. W. McPherson and C. F. Dunn (<i>J. Vac. Sci. Technol. B</i> 5 (1987) 1321): voiding rate R ∝ (T₀ − T)<sup>N</sup>·exp(−E<sub>a</sub>/kT). Parameters: copper – via on a wide damascene lead, N = 3.2, E<sub>a</sub> = 0.74 eV, T₀ ≈ 270 °C (E. T. Ogawa et al., IRPS 2002); Al–Si(1 %) – N = 2.33, E<sub>a</sub> = 0.58 eV, T₀ = 232 °C (McPherson &amp; Dunn, as quoted by Ogawa et al.). Rates and times to failure are shown relative to their extreme value; the model gives no absolute lifetime. The picture of the line is schematic.',
    freeText: v => `Explore – move the storage temperature and watch one factor fall while the other rises. The rate peaks at ${degC(v.Tp)}; a bake at ${degC(v.T)} runs ${times(v.AF)} as fast as use at ${degC(v.Tuse)}.`,

    params: {
      metal: { value: 'cu', label: 'Metallisation', options: { ...Object.fromEntries(Object.entries(PRESET).map(([k, m]) => [k, m.name])), custom: 'Custom parameters' } },
      T: { value: 150, min: TMIN, max: TMAX, step: 1, label: 'Storage (test) temperature <i>T</i>', format: degC },
      Tuse: { value: 105, min: TMIN, max: 150, step: 1, label: 'Use temperature <i>T</i>_use', format: degC },
      T0: { value: 270, min: 200, max: 450, step: 5, label: 'Stress-free temperature <i>T</i>₀', format: degC, when: v => v.metal === 'custom' },
      N: { value: 3.2, min: 1, max: 5, step: 0.1, label: 'Creep exponent <i>N</i>', digits: 1, when: v => v.metal === 'custom' },
      Ea: { value: 0.74, min: 0.3, max: 1.4, step: 0.01, label: 'Activation energy <i>E</i>_a', unit: 'eV', digits: 2, when: v => v.metal === 'custom' },
    },
    layers: { terms: false, use: false },
    explore: { show: ['terms', 'use'] },

    derived: v => {
      const p = par(v), e = SM.evaluate({ ...p, Tuse: v.Tuse, Ttest: v.T });
      return { ...e, p, T0v: p.T0, Nv: p.N, Eav: p.Ea, above: v.T >= p.T0 };
    },

    tex: [
      { at: [3.75, 3.42], tex: 'R(T) \\propto (T_0 - T)^{N}\\,e^{-E_a/kT}', size: 0.3 },
    ],

    draw(p, v) {
      const tAnim = (nowMs() - T0MS) / 1000, P = v.p;
      // ---------------------------------------------------------- the line in its dielectric (schematic)
      const x0 = -6.5, x1 = -1.2, ySi = 1.0, yD0 = 1.3, yM0 = 1.75, yM1 = 2.35, yD1 = 2.8;
      p.text('metal line enclosed in its dielectric (schematic)', -6.85, 3.5, { size: 0.2, color: C.muted });
      p.material('si', x0, ySi, x1, yD0, { stroke: null });
      p.material('sio2', x0, yD0, x1, yD1, { stroke: null });
      const metal = P.mat === 'gold' ? MAT.gold : MAT.metal;
      p.box(x0, yM0, x1, yM1, { fill: metal.fill, stroke: null });
      // grain boundaries (fixed pattern) and a wedge void at one of them; its size follows the voiding rate
      const gbs = [-5.6, -4.75, -3.7, -2.9, -1.95];
      gbs.forEach((x, i) => p.line(x, yM0, x + 0.12 * (hash(i + 0.4) - 0.5), yM1, { color: metal.stroke, width: 1, noOcc: true }));
      const rel = v.above ? 0 : v.relTest, xv = gbs[2], vw = 0.12 + 0.5 * rel, vh = (yM1 - yM0) * (0.15 + 0.8 * rel);
      if (!v.above) p.polygon([[xv - vw / 2, yM1 + 0.01], [xv + vw / 2, yM1 + 0.01], [xv, yM1 - vh]], { fill: C.bg, stroke: null, noOcc: true });
      // tensile stress: arrows pulling the metal apart, length ∝ (T₀ − T)
      const sRel = v.above ? 0 : (P.T0 - v.T) / (P.T0 - TMIN), al = 0.25 + 0.9 * sRel, ya = (yM0 + yM1) / 2;
      if (!v.above) {
        p.arrow(x0 + 0.2 + al, ya, x0 + 0.2, ya, { color: C.red, width: 2.5, head: 0.15 });
        p.arrow(x1 - 0.2 - al, ya, x1 - 0.2, ya, { color: C.red, width: 2.5, head: 0.15 });
      }
      // vacancies drifting along the line towards the void; number and speed follow the diffusion term
      const dRel = SM.diffusionTerm(v.T, P.Ea) / SM.diffusionTerm(TMAX, P.Ea), nV = v.above ? 0 : 6 + Math.round(10 * Math.sqrt(dRel)), sp = 0.03 + 0.5 * Math.sqrt(dRel);
      for (let i = 0; i < nV; i++) {
        const side = i % 2 ? 1 : -1, u = (tAnim * sp + hash(i + 0.31)) % 1;
        const x = xv + side * (1.9 * (1 - u) + 0.1), y = yM0 + 0.08 + (yM1 - yM0 - 0.16) * (hash(i + 0.83) * (1 - u) + 0.85 * u);
        p.circle(x, y, 0.04, { stroke: C.text, width: 1.2, alpha: 0.35 + 0.65 * u, noOcc: true });
      }
      p.text('SiO₂', x0 + 0.1, yD1 - 0.2, { size: 0.18, color: C.text });
      p.text('Si', x0 + 0.1, (ySi + yD0) / 2, { size: 0.18, color: C.text });
      p.text(v.above ? `above T_0 = ${degC(P.T0)} the line is under compression: no voiding` : `${degC(v.T)}: tensile stress ∝ T_0 − T = ${fmt.num(P.T0 - v.T, 0)} K, void growth ${fmt.sig(100 * v.relTest, 2)} % of the maximum`,
        -6.85, 0.62, { size: 0.19, color: C.text, bold: true });
      p.circle(-6.75, 3.12, 0.04, { stroke: C.text, width: 1.2 });
      p.text('vacancy', -6.63, 3.12, { size: 0.17, color: C.muted });
      p.line(-5.6, 3.12, -5.3, 3.12, { color: C.red, width: 2.5 });
      p.text('tensile stress', -5.22, 3.12, { size: 0.17, color: C.muted });

      // ---------------------------------------------------------- time to failure relative to its minimum (log)
      const Ts = M.linspace(TMIN, Math.min(TMAX, P.T0 - 0.5), 240);
      const al2 = p.axes({ x: -5.85, y: -2.7, w: 4.9, h: 2.6, xr: [TMIN, TMAX], yr: [1, 1e6], ylog: true, grid: true, size: 0.19,
        xticks: [50, 100, 150, 200, 250, 300, 350, 400], yticks: [1, 100, 1e4, 1e6], yfmt: y => (y === 1 ? '1×' : y === 100 ? '100×' : y === 1e4 ? '10⁴×' : '10⁶×'),
        xlabel: 'storage temperature (°C)', ylabel: 'time to failure / shortest', ylabelOffset: 0.75 }).draw();
      p.clip(al2.x, al2.y, al2.x + al2.w, al2.y + al2.h, () => {
        al2.curve(Ts, Ts.map(T => 1 / v.rel(T)), { color: C.yellow, width: 3.5 });
        al2.vline(P.T0, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
      });
      if (!v.above && 1 / v.relTest <= 1e6) al2.dot(v.T, 1 / v.relTest, { r: 0.09, color: C.yellow });
      p.layer('use', () => { if (1 / v.relUse <= 1e6) al2.dot(v.Tuse, 1 / v.relUse, { r: 0.08, color: C.teal }); });

      // ---------------------------------------------------------- voiding rate and its two factors
      const ax = p.axes({ x: 1.2, y: -2.7, w: 5.3, h: 5.0, xr: [TMIN, TMAX], yr: [0, 1.1], grid: true, size: 0.21,
        xticks: [50, 100, 150, 200, 250, 300, 350, 400], yticks: [0, 0.25, 0.5, 0.75, 1],
        xlabel: 'storage temperature (°C)', ylabel: 'relative to the maximum', ylabelOffset: 0.75 }).draw();
      const sMax = SM.stressTerm(TMIN, P.T0, P.N), dMax = SM.diffusionTerm(Math.min(TMAX, P.T0), P.Ea);
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        p.layer('terms', () => {
          ax.curve(Ts, Ts.map(T => SM.stressTerm(T, P.T0, P.N) / sMax), { color: C.red, width: 2.5, dash: [0.1, 0.07] });
          ax.curve(Ts, Ts.map(T => SM.diffusionTerm(T, P.Ea) / dMax), { color: C.blue, width: 2.5, dash: [0.03, 0.06] });
        });
        ax.vline(P.T0, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
        ax.curve(Ts, Ts.map(v.rel), { color: C.yellow, width: 4 });
      });
      ax.dot(v.Tp, 1, { r: 0.07, color: C.text });
      if (!v.above) ax.dot(v.T, v.relTest, { r: 0.1, color: C.yellow });
      p.layer('use', () => ax.dot(v.Tuse, v.relUse, { r: 0.085, color: C.teal }));
      // legend row above the plot
      const ly = ax.y + ax.h + 0.2;
      p.line(ax.x, ly, ax.x + 0.3, ly, { color: C.yellow, width: 4 });
      p.text('voiding rate', ax.x + 0.38, ly, { size: 0.18, color: C.text });
      p.alpha(p.vis('terms'), () => {
        p.line(ax.x + 1.75, ly, ax.x + 2.05, ly, { color: C.red, width: 2.5, dash: [0.1, 0.07] });
        p.text('stress (T_0 − T)^N', ax.x + 2.13, ly, { size: 0.18, color: C.text });
        p.line(ax.x + 3.75, ly, ax.x + 4.05, ly, { color: C.blue, width: 2.5, dash: [0.03, 0.06] });
        p.text('diffusion', ax.x + 4.13, ly, { size: 0.18, color: C.text });
      });
      ax.place(`maximum at ${degC(v.Tp)}`, [[ax.X(v.Tp), ax.Y(1) + 0.2, 'center'], [ax.X(v.Tp) + 0.15, ax.Y(1) + 0.2, 'left'], [ax.X(v.Tp) - 0.15, ax.Y(1) + 0.2, 'right']], { color: C.text, size: 0.19, key: 'peak', inside: false });
    },

    readout: v => MFW.chars([
      ['model parameters', '', `T<sub>0</sub> = ${degC(v.p.T0)}, N = ${v.p.N}, E<sub>a</sub> = ${v.p.Ea} eV`, ''],
      ['temperature of the fastest voiding', 'T<sub>max</sub>', degC(v.Tp), undefined, { hl: true, f: 'N/(T<sub>0</sub> − T) = E<sub>a</sub>/kT²' }],
      ['voiding rate at the storage temperature', '', v.above ? 'none (above T<sub>0</sub>)' : `${fmt.sig(100 * v.relTest, 3)} %`, v.above ? '' : undefined, { note: v.above ? '' : 'of the maximum' }],
      ['voiding rate at the use temperature', '', `${fmt.sig(100 * v.relUse, 3)} %`, undefined, { note: 'of the maximum' }],
      ['acceleration of the storage test', 'AF', v.above ? '–' : times(v.AF), v.above ? '' : undefined, { f: 'R(T)/R(T<sub>use</sub>)' }],
      ['apparent activation energy at T', 'E<sub>eff</sub>', v.above ? '–' : `${fmt.num(v.eTest, 2)} eV`, v.above ? '' : undefined, { f: 'E<sub>a</sub> − N·k·T²/(T<sub>0</sub> − T)' }],
      ['apparent activation energy in use', '', `${fmt.num(v.eUse, 2)} eV`],
      !v.above && v.AF < 1 && { warn: 'This storage temperature is too high: the stress has relaxed so far that the test runs slower than the product in use.' }]),

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Voids without any current', caption: 'A line that only sits in a warm oven can still break', set: { metal: 'cu', T: 150, Tuse: 105 }, duration: 1,
        text: v => `No current flows here, yet a void grows. The metal was enclosed in its dielectric at high temperature; on cooling it wants to shrink far more than the silicon and glass around it and cannot. Below the stress-free temperature T<sub>0</sub> ≈ ${degC(v.p.T0)} the line is therefore under <b>tensile stress</b>, the larger the colder it gets. The stress drives vacancies to grain boundaries and interfaces, where they collect into voids – in copper typically under a via that sits on a wide lead, which supplies many vacancies.` },
      { name: 'Two opposing factors', caption: 'Stress falls with temperature, diffusion rises', show: ['terms'], duration: 1,
        text: v => `The voiding rate is the product of two factors. The driving force, the stress, is proportional to T<sub>0</sub> − T and enters as a power, (T<sub>0</sub> − T)<sup>N</sup> with N = ${v.p.N} (red): it is largest when the chip is cold. The vacancies, however, must diffuse, and diffusion follows exp(−E<sub>a</sub>/kT) with E<sub>a</sub> = ${v.p.Ea} eV (blue): it is fastest when the chip is hot.` },
      { name: 'The worst temperature', caption: v => (Math.abs(v.T - v.Tp) <= 5 ? `Fastest voiding at ${degC(v.Tp)}` : 'Between cold and T_0 the voiding is fastest'), set: { T: 150 }, duration: 1,
        task: 'Move the <b>Storage (test) temperature <i>T</i></b> to the temperature at which the void grows fastest – the top of the yellow curve.',
        goal: v => Math.abs(v.T - v.Tp) <= 5, solution: { T: 190 },
        text: v => `In between, the rate has a maximum, where N/(T<sub>0</sub> − T) = E<sub>a</sub>/kT²: here at ${degC(v.Tp)}. The lower plot shows the same thing as a time to failure – a bathtub with its shortest life at this temperature. This is unusual: for almost every other failure mechanism hotter simply means faster.` },
      { name: 'Hotter is slower', caption: v => (v.above ? `${degC(v.T)}: above T_0, no voiding` : `${degC(v.T)}: ${fmt.sig(100 * v.relTest, 2)} % of the maximum rate`), set: { T: 190 }, show: ['use'], duration: 1,
        task: 'An accelerated test is normally run as hot as possible. The teal point marks the product in use at 105 °C. Raise the <b>Storage (test) temperature <i>T</i></b> until the test runs <i>slower</i> than the product in use – the acceleration AF in the readout falls below 1.',
        goal: v => v.T > v.Tp && v.AF < 1, solution: { T: 250 },
        text: v => (v.above
          ? `At ${degC(v.T)} the line is above its stress-free temperature T<sub>0</sub> = ${degC(v.p.T0)}: the tensile stress is gone and no void grows at all. Already somewhat below T<sub>0</sub> the stress has relaxed so far that a test runs slower than the product in use at ${degC(v.Tuse)}, and would pass a metallisation that fails in the field. A stress-migration bake has to be placed near the maximum, typically at 150–200 °C.`
          : `Raise the storage temperature to ${degC(v.T)} and the voiding <i>slows down</i>: the stress has almost relaxed. Such a test would even run ${v.AF < 1 ? 'slower' : 'hardly faster'} than the product in use at ${degC(v.Tuse)} (${times(v.AF)}), and would pass a metallisation that fails in the field. A stress-migration bake has to be placed near the maximum, typically at 150–200 °C.`) },
      { name: 'A slow test', caption: v => `The best bake is only ${times(v.AF)} faster than use`, from: { T: 250 }, set: { T: 190 }, duration: 2,
        ask: { q: 'The bake is moved back to the best temperature, 190 °C, where the voiding is fastest. The product runs at 105 °C. How much faster than the product does this test run?',
          options: ['About 6×', 'About 600×', 'About 60 000×'], correct: 0 },
        text: v => `Even at the best temperature the acceleration is modest: ${times(v.AF)} against use at ${degC(v.Tuse)}. The reason is the apparent activation energy, E<sub>eff</sub> = E<sub>a</sub> − N·k·T²/(T<sub>0</sub> − T): it is ${fmt.num(v.eUse, 2)} eV at ${degC(v.Tuse)} and falls to zero at the maximum. With so little acceleration the wafers are stored for one to two thousand hours and their resistance is read at intervals. Compare electromigration, where a hot test gains four orders of magnitude.` },
      { name: 'Aluminium lines', caption: v => `Al–Si: T_0 = ${degC(v.p.T0)}, maximum at ${degC(v.Tp)}`, set: { metal: 'alsi', T: 165 }, duration: 1,
        ask: { q: 'The model was first made for Al–Si lines. Their stress-free temperature is lower than for the copper structure, 232 °C instead of 270 °C, and N and E<sub>a</sub> are somewhat lower too. Where is the temperature of the fastest voiding, compared with 190 °C for copper?',
          options: ['Lower', 'The same – 190 °C', 'Higher'], correct: 0 },
        text: v => `The model was first made for narrow Al–Si lines, which notched and opened at grain boundaries during storage. With N = ${v.p.N}, E<sub>a</sub> = ${v.p.Ea} eV and T<sub>0</sub> = ${degC(v.p.T0)} the maximum lies at ${degC(v.Tp)}. Two remedies became standard: a little copper in the aluminium, which slows grain-boundary diffusion, and a refractory layer such as TiN or TiW under the aluminium, which keeps carrying the current when the aluminium above it has a void.` },
    ],
  });
}());
