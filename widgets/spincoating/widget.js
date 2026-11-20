/* Spin coating of photoresist: an animated coating run (dispense → spread → spin-up → spin-off → stop)
   and the spin curve t = k·p²/√w. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const S = MFW_SPIN;
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const rpmS = r => `${fmt.num(r, 0)} rpm`;
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------ the coating recipe (process time in s)
  // dispense at rest, spread at 500 rpm, ramp to the final speed, spin 30 s, stop, show the result
  const T = { disp: 2.5, spread0: 3, spread1: 6.5, spin0: 7.5, spin1: 37.5, stop: 39.5, end: 44 };
  const SPREAD = 500, ACCEL = 4;                         // the animation runs 4× faster than the real process
  const VIS_RPM = 3000;                                  // drawn rotation: rpm/3000 rev/s = 50× slower than real at 4000 rpm
  function rpmAt(tp, rpm) {
    const pts = [[0, 0], [T.disp, 0], [T.spread0, SPREAD], [T.spread1, SPREAD], [T.spin0, rpm], [T.spin1, rpm], [T.stop, 0], [T.end, 0]];
    for (let i = 1; i < pts.length; i++) if (tp <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + (yb - ya) * (tp - a) / (b - a); }
    return 0;
  }
  /** ∫ rpm dt from 0 to tp (rpm·s), exact for the piecewise-linear profile. */
  function rpmIntegral(tp, rpm) {
    const pts = [[0, 0], [T.disp, 0], [T.spread0, SPREAD], [T.spread1, SPREAD], [T.spin0, rpm], [T.spin1, rpm], [T.stop, 0], [T.end, 0]];
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const [a, ya] = pts[i - 1], [b, yb] = pts[i];
      if (tp <= a) break;
      const e = Math.min(tp, b), ye = ya + (yb - ya) * (e - a) / (b - a);
      s += (ya + ye) / 2 * (e - a);
    }
    return s;
  }
  const STAGES = [
    [T.disp, '1  Dispense – resist is dropped on the resting wafer'],
    [T.spread1, '2  Spread at 500 rpm – the puddle covers the wafer'],
    [T.spin0, '3  Spin-up to the final speed'],
    [T.spin1, '4  Spin-off – excess resist flies off, solvent evaporates'],
    [Infinity, '5  Stop – a dry film and an edge bead remain'],
  ];
  const stageOf = tp => STAGES.find(s => tp < s[0])[1];
  // film thinning during the spin (schematic): Emslie–Bonner–Peck-like 1/√(1 + t/τ) with τ ∝ 1/ω²
  // (1 = liquid film after spreading, 0 = dry film; the second factor lets the film reach its final value at the end of the spin)
  const thinning = (tp, rpm) => {
    if (tp < T.spread1) return 1;
    const tau = 1.2 * (4000 / rpm) ** 2, s = tp - T.spread1;
    const u = Math.min(1, s / (T.spin1 - T.spread1));
    return (1 - u) ** 0.15 / Math.sqrt(1 + s / tau);
  };
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ------------------------------------------------------------ process clock (restarts when a parameter changes)
  let clock0 = nowMs();
  const restart = () => { clock0 = nowMs(); };
  const processTime = () => {
    if (typeof window !== 'undefined' && typeof window.MFW_SPIN_TP === 'number') return window.MFW_SPIN_TP;   // dev: freeze the clock
    return still ? T.end - 0.01 : (((nowMs() - clock0) / 1000) * ACCEL) % T.end;
  };

  MFW.widget('#app', {
    title: 'Spin coating of photoresist',
    loop: !still,
    alt: v => `Spin coating at ${rpmS(v.rpm)} with ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)}: final resist thickness ${um(v.t)} (${um(v.tBaked)} after soft bake).`,
    source: 'Final thickness from the empirical spin curve t = k·p²/√w (t in Å, k = spinner constant 80–100, p = solids content in %, w = rpm/1000), the typical 3000–6000 rpm for 15–30 s and 1–2 µm, the ~25 % thinning in the soft bake and the edge bead of up to 20–30× the film thickness as quoted in microfabrication course notes (e.g. Wake Forest University, NAN 242, “Photolithography”). The units of t are not printed with the rule; Å is the only choice consistent with the typical values. Spin-speed exponent ½: DTU Nanolab, Litho Tool Package – Spin coating. The animation is schematic: the recipe (dispense, spread at 500 rpm, 30 s spin) is a typical one, the rotation is slowed down 50×, and the thinning during the spin only illustrates the shape of the Emslie–Bonner–Peck solution (fast at first, then slower), not its numbers.',
    freeText: v => `Explore – the coating run restarts whenever you change a parameter. With ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)}, a 1.5 µm film needs about ${rpmS(Math.round(S.speedFor(1.5, v.p, v.k) / 10) * 10)}.`,
    onInput: () => restart(),

    params: {
      rpm: { value: 4000, min: 1000, max: 8000, step: 50, label: 'Final spin speed', format: rpmS },
      p: { value: 20, min: 10, max: 35, step: 0.5, label: 'Solids content of the resist <i>p</i>', unit: '%', digits: 1 },
      k: { value: 90, min: 80, max: 100, step: 1, label: 'Spinner constant <i>k</i>', digits: 0 },
    },
    layers: { window: false, bake: false, bead: false, band: false },
    explore: { show: ['window', 'bake', 'bead', 'band'] },

    derived: v => S.state(v),

    tex: [
      { at: [3.85, 3.42], tex: 't = k\\,\\dfrac{p^2}{\\sqrt{w}} = {{k:0}}\\cdot\\dfrac{{{p:1}}^2}{\\sqrt{{{w:2}}}} = {{tA:0}}\\ \\text{Å} = {{t:2}}\\ \\mu\\mathrm{m}', size: 0.31 },
    ],

    draw(p, v, w) {
      const tp = processTime(), rpmNow = rpmAt(tp, v.rpm);
      // ======================================================== animated coater (oblique view, schematic)
      const cx = -3.5, cy = -0.55, Rx = 2.75, Ry = 0.8, Lx0 = -7.0, Lx1 = 0.0;
      const ang = 2 * Math.PI * (still ? 0.15 : rpmIntegral(tp, v.rpm) / VIS_RPM / ACCEL);
      const P = (u, q, h = 0) => [cx + u * Rx, cy + q * Ry + h];        // wafer plane (u, q in units of the radius) → scene
      const ell = (r, h, n = 72) => M.linspace(0, 2 * Math.PI, n).map(a => P(r * Math.cos(a), r * Math.sin(a), h));
      // stage title and clock
      p.text(stageOf(tp), Lx0 + 0.1, 2.75, { size: 0.23, color: C.text, bold: true });
      p.text(`process time ${fmt.num(tp, 1)} s · ${rpmS(Math.round(rpmNow / 10) * 10)}`, Lx0 + 0.1, 2.4, { size: 0.21, color: C.yellow });
      // chuck, shaft and motor
      p.box(cx - 0.55, cy - 1.55, cx + 0.55, cy - 0.12, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.ellipse(cx, cy - 1.55, 0.55, 0.16, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.box(cx - 0.16, cy - 2.35, cx + 0.16, cy - 1.6, { fill: C.grey, stroke: null });
      p.box(cx - 0.8, cy - 3.0, cx + 0.8, cy - 2.35, { fill: C.greyD, stroke: C.greyB, width: 1.5, radius: 0.08 });
      p.text('motor', cx, cy - 2.68, { size: 0.2, align: 'center', color: C.greyA });
      p.text('vacuum chuck', cx + 0.7, cy - 1.0, { size: 0.2, color: C.muted });
      // wafer: side band and top surface
      p.polygon(ell(1, 0).filter((_, i) => i <= 36).concat(ell(1, -0.1).filter((_, i) => i <= 36).reverse()), { fill: MAT.si.stroke, stroke: null });
      p.polygon(ell(1, -0.1).slice(36).concat(ell(1, 0).slice(36).reverse()), { fill: MAT.si.stroke, stroke: null });
      p.polygon(ell(1, 0), { fill: MAT.si.fill, stroke: MAT.si.stroke, width: 1.5 });
      // resist: radius and (exaggerated) height of the liquid film
      const vol = M.clamp(tp / T.disp, 0, 1);
      const spreadU = M.clamp((tp - T.disp) / (T.spread1 - T.disp - 1), 0, 1);
      const rr = tp < T.disp ? 0.3 * Math.sqrt(vol) : 0.3 + 0.67 * (1 - (1 - spreadU) ** 2);
      const f = thinning(tp, v.rpm);                                           // 1 → 0 during the spin
      const hFinal = 0.03 + 0.05 * M.clamp(v.t / 4, 0, 1);                    // drawn thickness of the dry film
      const hLiquid = tp < T.disp ? 0.05 + 0.3 * vol : tp < T.spread1 ? 0.35 - 0.2 * spreadU : 0.15;
      const h = tp < T.spread1 ? hLiquid : hFinal + (0.15 - hFinal) * f;
      if (vol > 0) {
        const top = ell(rr, h), base = ell(rr, 0);
        p.polygon(base.filter((_, i) => i <= 36).concat(top.filter((_, i) => i <= 36).reverse()), { fill: MAT.resist.stroke, stroke: null });
        p.polygon(top, { fill: MAT.resist.fill, stroke: MAT.resist.stroke, width: 1.5 });
        // edge bead: a raised rim that builds up during the spin-off
        const bead = M.clamp((tp - T.spin0) / 6, 0, 1);
        if (bead > 0 && rr > 0.9) p.path(ell(0.985, h + 0.04 * bead), { color: MAT.resist.stroke, width: 2 + 3 * bead, closed: true, noOcc: true });
      }
      // rotation marks on the wafer: radial streaks in the film and the primary flat
      for (let i = 0; i < 6; i++) {
        const a = ang + i * Math.PI / 3, a2 = a + 0.4;
        p.line(...P(0.25 * Math.cos(a), 0.25 * Math.sin(a), h + 0.002), ...P(0.88 * Math.cos(a2), 0.88 * Math.sin(a2), h + 0.002),
          { color: C.white, width: 1.5, alpha: 0.35, noOcc: true });
      }
      // dispense nozzle and falling drops
      const nTip = 1.85;
      p.box(cx - 0.12, nTip, cx + 0.12, 2.55, { fill: C.grey, stroke: C.greyB, width: 1.5 });
      p.text('resist nozzle', cx + 0.25, 2.3, { size: 0.2, color: C.muted });
      if (tp < T.disp) {
        for (let j = 0; j < 5; j++) {
          const ph = ((tp * 2.2 + j / 5) % 1), y = nTip - ph * (nTip - cy - h);
          p.circle(cx, y, 0.07, { fill: MAT.resist.stroke, stroke: null });
        }
      }
      // resist flung off the edge: droplets leave tangentially, faster at higher speed (schematic), with short motion trails
      if (!still && tp > T.spread0 && tp < T.stop) {
        const dt = 0.025, life = 0.8;
        for (let k = Math.floor((tp - life) / dt); k <= Math.floor(tp / dt); k++) {
          const born = k * dt, age = tp - born;
          if (born < T.spread0 || age < 0 || age > life) continue;
          const f0 = thinning(born, v.rpm), rate = born < T.spread1 ? 0.12 : 0.1 + 0.9 * f0 * f0;
          if (hash(k) > rate) continue;
          const phi = 2 * Math.PI * hash(k + 0.5), sp = 0.6 + 2.6 * rpmAt(born, v.rpm) / 8000;
          const at = a => { const u = Math.cos(phi) + a * sp * (-Math.sin(phi) + 0.35 * Math.cos(phi)), q = Math.sin(phi) + a * sp * (Math.cos(phi) + 0.35 * Math.sin(phi)); return P(u, q, h - 0.6 * a * a); };
          const [X, Y] = at(age), [X0, Y0] = at(Math.max(0, age - 0.06));
          if (X < Lx0 || X > Lx1 + 0.5) continue;
          const al = 1 - age / life;
          p.line(X0, Y0, X, Y, { color: MAT.resist.stroke, width: 2.5, alpha: 0.6 * al, noOcc: true });
          p.circle(X, Y, 0.045, { fill: MAT.resist.stroke, stroke: null, alpha: al });
        }
      }
      // film-thickness gauge (under the stage title)
      const gx = Lx0 + 0.1, gy = 1.62, gw = 2.3;
      const frac = tp < T.disp ? vol : tp < T.spread1 ? 1 : hFinal / 0.15 + (1 - hFinal / 0.15) * f;
      const gLabel = tp >= T.spin1 ? `film: dry, ${um(v.t)}` : tp >= T.spread1 ? 'film: liquid, thinning…' : tp >= T.disp ? 'film: liquid, spreading' : 'film: puddle';
      p.text(gLabel, gx, gy + 0.3, { size: 0.2, color: tp >= T.spin1 ? C.yellow : C.text, bold: tp >= T.spin1 });
      p.box(gx, gy - 0.08, gx + gw, gy + 0.08, { fill: C.grid, stroke: null });
      p.box(gx, gy - 0.08, gx + gw * M.clamp(frac, 0, 1), gy + 0.08, { fill: MAT.resist.stroke, stroke: null });
      p.text(still ? 'schematic, not to scale' : 'schematic, not to scale · rotation 50× slower', Lx0 + 0.15, -3.75, { size: 0.18, color: C.muted });
      p.layer('bead', () => {
        if (tp >= T.spin0 + 3) p.place('edge bead: up to 20–30 × t', [[cx + Rx - 0.2, cy + Ry + 0.35, 'right', 'bottom'], [cx + Rx, cy - Ry - 0.3, 'right', 'top']], { size: 0.19, color: C.text, key: 'bead' });
      });

      // ======================================================== recipe: spin speed vs process time
      const a1 = p.axes({ x: 1.0, y: 0.55, w: 5.7, h: 1.95, xr: [0, T.end], yr: [0, 9000], grid: true, size: 0.19, nticks: 5,
        yticks: [0, 4000, 8000], yfmt: y => (y ? `${y / 1000}k` : '0'), xlabel: '', ylabel: 'rpm', ylabelOffset: 0.6 }).draw();
      p.text('process time (s)', a1.x + a1.w, a1.y - 0.42, { size: 0.19, align: 'right', color: C.muted });
      a1.plot(x => rpmAt(x, v.rpm), { color: C.blue, width: 3, samples: 300 });
      a1.vline(tp, { color: C.yellow, width: 2, dash: null });
      a1.dot(tp, rpmNow, { r: 0.08 });
      p.text('spin recipe', a1.x + 0.1, a1.y + a1.h + 0.18, { size: 0.2, color: C.greyA });

      // ======================================================== spin curve t(rpm)
      const ymax = w.smooth('ymax', [2, 3, 4, 5, 6, 8, 10, 12, 15].find(y => y >= S.thickness(1000, v.p, 100) * 1.05) || 15, { log: true });
      const ax = p.axes({ x: 1.0, y: -2.9, w: 5.7, h: 2.55, xr: [1000, 8000], yr: [0, ymax], grid: true, size: 0.19, nticks: 7,
        xfmt: x => String(Math.round(x)), xlabel: 'final spin speed (rpm)', ylabel: 'thickness t (µm)', ylabelOffset: 0.7 }).draw();
      p.layer('window', () => {
        p.rect(ax.X(3000), ax.y, ax.X(6000) - ax.X(3000), ax.h, { fill: C.blue, fillAlpha: 0.08, stroke: null, noOcc: true });
        p.rect(ax.x, ax.Y(1), ax.w, ax.Y(Math.min(2, ymax)) - ax.Y(1), { fill: C.green, fillAlpha: 0.1, stroke: null, noOcc: true });
      });
      p.layer('band', () => {
        const xs = M.linspace(1000, 8000, 120);
        p.polygon(xs.map(x => [ax.X(x), ax.Y(S.thickness(x, v.p, 100))]).concat(xs.slice().reverse().map(x => [ax.X(x), ax.Y(S.thickness(x, v.p, 80))])),
          { fill: C.yellow, fillAlpha: 0.15, stroke: null, noOcc: true });
      });
      p.layer('bake', () => ax.plot(x => S.BAKE * S.thickness(x, v.p, v.k), { color: C.gold, width: 2.5, dash: [0.1, 0.07] }));
      ax.plot(x => S.thickness(x, v.p, v.k), { color: C.yellow, width: 4 });
      ax.dot(v.rpm, v.t, { r: 0.1 });
      ax.legend([
        { label: `spin curve, p = ${fmt.num(v.p, 1)} %, k = ${fmt.num(v.k, 0)}`, color: C.yellow, width: 4 },
        { label: 'k = 80 … 100', color: C.yellow, width: 9, alpha: 0.35 * p.vis('band') },
        { label: 'after soft bake (≈ −25 %)', color: C.gold, dash: [0.1, 0.07], alpha: p.vis('bake') },
        { label: 'typical 3000–6000 rpm, 1–2 µm', color: C.green, width: 9, alpha: 0.5 * p.vis('window') },
      ], { corner: 'tr', size: 0.17 });
    },

    readout: v => `<table>
      <tr><td>final thickness t = k·p²/√w</td><td><b class="hl">${um(v.t)}</b> (${fmt.num(v.tA, 0)} Å)</td></tr>
      <tr><td>range for k = 80 … 100</td><td>${um(v.tLo)} … ${um(v.tHi)}</td></tr>
      <tr><td>after soft bake (≈ −25 %)</td><td>${um(v.tBaked)}</td></tr>
      <tr><td>at double the speed</td><td>${um(v.t / Math.SQRT2)} (÷ √2)</td></tr>
      <tr><td>edge bead, up to</td><td>${um(v.bead[0])} … ${um(v.bead[1])}</td></tr></table>`,

    steps: [
      { name: 'A coating run', caption: 'Dispense, spread, spin up, spin off, stop', set: { rpm: 4000, p: 20, k: 90 }, duration: 0.5, enter: () => restart(), hold: 12,
        text: v => `Watch one run of the spin coater. A puddle of resist is dropped on the wafer, which is held by a vacuum chuck. A short spin at about 500 rpm spreads it over the whole wafer, then the chuck accelerates to the final speed – here ${rpmS(v.rpm)} – for 15–30 s. Most of the resist flies off into the bowl; what stays dries into a film of ${um(v.t)}.` },
      { name: 'Thinning during the spin', caption: 'Fast at first, then the solvent evaporation takes over', enter: () => restart(), hold: 12,
        text: 'At the start of the high-speed spin the liquid layer is thick and thins quickly – centrifugal flow throws the excess off the edge. As it gets thinner the flow slows down, and evaporation of the solvent raises the viscosity until the film no longer moves. Most of the thinning happens in the first seconds of the high-speed spin; later the film mainly dries.' },
      { name: 'Faster spin, thinner film', caption: 't ∝ 1/√w: twice the speed gives √2 thinner, not half', set: { rpm: 8000 }, duration: 1, enter: () => restart(),
        text: v => `The empirical spin curve is t = k·p²/√w with w = rpm/1000. Doubling the speed from 4000 to 8000 rpm thins the film only by √2, to ${um(v.t)}. Spin speed is the <b>fine</b> adjustment of thickness.` },
      { name: 'Solids content', caption: 'p² – the resist formulation is the coarse knob', set: { rpm: 4000, p: 30 }, duration: 1, enter: () => restart(),
        text: v => `The solids content p (and with it the viscosity) enters squared: 30 % instead of 20 % gives (30/20)² = 2.25× thicker film, ${um(v.t)}. That is why resists are sold in several viscosities – you choose the resist for the thickness range and fine-tune with the spin speed.` },
      { name: 'Spinner constant', caption: 'k = 80 … 100: every spinner and resist needs its own spin curve', set: { p: 20, k: 90 }, show: ['band', 'window'], duration: 1,
        text: v => `The constant k lumps together everything the formula leaves out – spin time, acceleration, solvent, exhaust, temperature. Its typical range 80–100 alone moves the thickness between ${um(v.tLo)} and ${um(v.tHi)} (shaded band). In a real lab you measure a spin curve for each resist on your spinner and read the speed from it.` },
      { name: 'Soft bake', caption: 'The soft bake drives off solvent: up to ~25 % thinner', show: ['bake'],
        text: v => `Before exposure a short soft bake on a hot plate or in an oven drives the remaining solvent out and densifies the resist. The film shrinks by up to about 25 %: ${um(v.t)} becomes about ${um(v.tBaked)} (dashed).` },
      { name: 'Edge bead', caption: 'At the wafer edge the resist piles up: up to 20–30 × thicker', show: ['bead'], enter: () => restart(),
        text: v => `Resist piles up at the wafer edge into a ridge, the edge bead – up to 20–30 times thicker than the film (${um(v.bead[0])} … ${um(v.bead[1])} here). It would keep the mask away from the resist in contact printing, so it is dissolved with a solvent jet (edge bead removal) right after coating. Now switch to <b>Explore</b> and change the speed – the run starts again.` },
    ],
  });
}());
