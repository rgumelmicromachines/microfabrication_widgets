/* Spin coating of photoresist: an animated coating run (dispense → spread → spin-up → spin-off → stop)
   and the spin curve t = k·p²/√w. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT, mix } = MFW;
  const S = MFW_SPIN;
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const rpmS = r => `${fmt.num(r, 0)} rpm`;
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------ the coating recipe (process time in s)
  // dispense at rest, spread at 500 rpm, ramp to the final speed, spin 30 s, slow down for edge bead removal (EBR),
  // solvent jet at the edge, spin dry, stop, show the result
  const T = { disp: 2.5, spread0: 3, spread1: 6.5, spin0: 7.5, spin1: 37.5, ebr0: 38.5, ebrOn: 39, ebrOff: 44, dry1: 46, stop: 47.5, end: 52 };
  const SPREAD = 500, EBR = 1000, ACCEL = 4;             // the animation runs 4× faster than the real process
  const VIS_RPM = 3000;                                  // drawn rotation: rpm/3000 rev/s = 50× slower than real at 4000 rpm
  const profile = rpm => [[0, 0], [T.disp, 0], [T.spread0, SPREAD], [T.spread1, SPREAD], [T.spin0, rpm], [T.spin1, rpm],
    [T.ebr0, EBR], [T.dry1, EBR], [T.stop, 0], [T.end, 0]];
  function rpmAt(tp, rpm) {
    const pts = profile(rpm);
    for (let i = 1; i < pts.length; i++) if (tp <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; return ya + (yb - ya) * (tp - a) / (b - a); }
    return 0;
  }
  /** ∫ rpm dt from 0 to tp (rpm·s), exact for the piecewise-linear profile. */
  function rpmIntegral(tp, rpm) {
    const pts = profile(rpm);
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
    [T.ebrOff, '5  Edge bead removal – a solvent jet at the wafer edge'],
    [T.stop, '6  Spin dry'],
    [Infinity, '7  Stop – dry film with a clean edge'],
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
  const ebrDone = tp => M.clamp((tp - T.ebrOn) / 2, 0, 1);       // fraction of the edge bead dissolved
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ------------------------------------------------------------ process clock (restarts when a parameter changes)
  let clock0 = nowMs();
  const restart = () => { clock0 = nowMs(); };
  const processTime = anim => {
    if (typeof window !== 'undefined' && typeof window.MFW_SPIN_TP === 'number') return window.MFW_SPIN_TP;   // dev: freeze the clock
    return anim ? (((nowMs() - clock0) / 1000) * ACCEL) % T.end : T.end - 0.01;
  };

  MFW.widget('#app', {
    title: 'Spin coating of photoresist',
    loop: true,                                                     // redraw every frame (cheap); the clock stops when animation is off
    alt: v => `Spin coating at ${rpmS(v.rpm)} with ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)}: final resist thickness ${um(v.t)} (${um(v.tBaked)} after soft bake).`,
    source: 'Final thickness from the empirical spin curve t = k·p²/√w (t in Å, k = spinner constant 80–100, p = solids content in %, w = rpm/1000), the typical 3000–6000 rpm for 15–30 s and 1–2 µm, the ~25 % thinning in the soft bake and the edge bead of up to 20–30× the film thickness as quoted in microfabrication course notes (e.g. Wake Forest University, NAN 242, “Photolithography”). The units of t are not printed with the rule; Å is the only choice consistent with the typical values. Spin-speed exponent ½: DTU Nanolab, Litho Tool Package – Spin coating. The animation is schematic: the recipe (dispense, spread at 500 rpm, 30 s spin, edge bead removal with a solvent jet at about 1000 rpm, spin dry) is a typical one, the rotation is slowed down 50×, and the thinning during the spin only illustrates the shape of the Emslie–Bonner–Peck solution (fast at first, then slower), not its numbers.',
    freeText: v => `Explore – the coating run restarts whenever you change a parameter. With ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)}, a 1.5 µm film needs about ${rpmS(Math.round(S.speedFor(1.5, v.p, v.k) / 10) * 10)}.`,
    onInput: () => restart(),

    params: {
      rpm: { value: 4000, min: 1000, max: 8000, step: 50, label: 'Final spin speed', format: rpmS },
      p: { value: 20, min: 10, max: 35, step: 0.5, label: 'Solids content of the resist <i>p</i>', unit: '%', digits: 1 },
      k: { value: 90, min: 80, max: 100, step: 1, label: 'Spinner constant <i>k</i>', digits: 0 },
      anim: { value: !still, label: 'Animate the coating run (off: show the finished film)' },
    },
    layers: { window: false, bake: false, bead: false, band: false },
    explore: { show: ['window', 'bake', 'bead', 'band'] },

    derived: v => S.state(v),

    tex: [
      { at: [3.85, 3.42], tex: 't = k\\,\\dfrac{p^2}{\\sqrt{w}} = {{k:0}}\\cdot\\dfrac{{{p:1}}^2}{\\sqrt{{{w:2}}}} = {{tA:0}}\\ \\text{Å} = {{t:2}}\\ \\mu\\mathrm{m}', size: 0.31 },
    ],

    draw(p, v, w) {
      const run = v.anim, tp = processTime(run), rpmNow = rpmAt(tp, v.rpm);
      // ======================================================== animated coater (oblique view, schematic)
      const cx = -3.5, cy = -0.55, Rx = 2.75, Ry = 0.8, Lx0 = -7.0, Lx1 = 0.0;
      const ang = 2 * Math.PI * (run ? rpmIntegral(tp, v.rpm) / VIS_RPM / ACCEL : 0.15);
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
      // wafer: side band (front half) and top surface
      const FRONT = a => a.slice(36);                                          // angles π … 2π: the half nearer to the viewer
      p.polygon(FRONT(ell(1, 0)).concat(FRONT(ell(1, -0.1)).reverse()), { fill: MAT.si.stroke, stroke: null });
      p.polygon(ell(1, 0), { fill: MAT.si.fill, stroke: MAT.si.stroke, width: 1.5 });
      // rotation marks on the wafer itself (visible where it is not yet covered)
      for (let i = 0; i < 6; i++) {
        const a = ang + i * Math.PI / 3, a2 = a + 0.4;
        p.line(...P(0.2 * Math.cos(a), 0.2 * Math.sin(a)), ...P(0.9 * Math.cos(a2), 0.9 * Math.sin(a2)), { color: MAT.si.stroke, width: 1.5, alpha: 0.5, noOcc: true });
      }
      // resist: a low dome while it is a puddle, a flat film once it covers the wafer (height exaggerated)
      const vol = M.clamp(tp / T.disp, 0, 1);
      const spreadU = M.clamp((tp - T.disp) / (T.spread1 - T.disp - 1), 0, 1);
      const ebr = ebrDone(tp);
      const rr = tp < T.disp ? 0.3 * Math.sqrt(vol) : (0.3 + 0.67 * (1 - (1 - spreadU) ** 2)) - 0.07 * ebr;   // EBR clears the outer rim
      const f = thinning(tp, v.rpm);                                           // 1 → 0 during the spin
      const hFinal = 0.025 + 0.04 * M.clamp(v.t / 4, 0, 1);                   // drawn thickness of the dry film
      const hStart = 0.06;
      const h = tp < T.disp ? 0.02 + 0.06 * vol : tp < T.spread1 ? 0.08 - (0.08 - hStart) * spreadU : hFinal + (hStart - hFinal) * f;
      const topScale = tp < T.spread1 ? 0.88 + 0.11 * spreadU : 0.995;           // slightly smaller top → rounded edge
      if (vol > 0) {
        const top = ell(rr * topScale, h), base = ell(rr, 0);
        p.polygon(FRONT(base).concat(FRONT(top).reverse()), { fill: mix(MAT.resist.fill, MAT.resist.stroke, 0.45), stroke: null });
        p.polygon(top, { fill: MAT.resist.fill, stroke: MAT.resist.stroke, width: 1.5 });
        // edge bead: a raised rim that builds up during the spin-off and is dissolved by the EBR jet
        const bead = M.clamp((tp - T.spin0) / 6, 0, 1) * (1 - ebr);
        if (bead > 0.01 && rr > 0.9) p.path(ell(rr * topScale - 0.012, h + 0.04 * bead), { color: MAT.resist.stroke, width: 2 + 3 * bead, closed: true, noOcc: true, alpha: Math.min(1, bead * 1.5) });
      }
      // rotation marks on the film, the same marks as on the wafer, clipped to the film radius
      const rIn = rr * topScale * 0.95;
      if (rIn > 0.22) for (let i = 0; i < 6; i++) {
        const a = ang + i * Math.PI / 3, a2 = a + 0.4 * Math.min(1, (rIn - 0.2) / 0.7);
        p.line(...P(0.2 * Math.cos(a), 0.2 * Math.sin(a), h), ...P(Math.min(0.9, rIn) * Math.cos(a2), Math.min(0.9, rIn) * Math.sin(a2), h),
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
      const fling = (born, phi, col0, life, sp, k) => {
        const age = tp - born;
        const at = a => { const u = Math.cos(phi) + a * sp * (-Math.sin(phi) + 0.35 * Math.cos(phi)), q = Math.sin(phi) + a * sp * (Math.cos(phi) + 0.35 * Math.sin(phi)); return P(u, q, h - 0.6 * a * a); };
        const [X, Y] = at(age), [X0, Y0] = at(Math.max(0, age - 0.06));
        if (X < Lx0 || X > Lx1 + 0.5) return;
        const al = 1 - age / life;
        p.line(X0, Y0, X, Y, { color: col0, width: 2.5, alpha: 0.6 * al, noOcc: true });
        p.circle(X, Y, 0.045, { fill: col0, stroke: null, alpha: al });
      };
      if (run && tp > T.spread0 && tp < T.spin1 + 0.9) {
        const dt = 0.025, life = 0.8;
        for (let k = Math.floor((tp - life) / dt); k <= Math.floor(tp / dt); k++) {
          const born = k * dt, age = tp - born;
          if (born < T.spread0 || born > T.spin1 || age < 0 || age > life) continue;
          const f0 = thinning(born, v.rpm), rate = born < T.spread1 ? 0.12 : 0.1 + 0.9 * f0 * f0;
          if (hash(k) > rate) continue;
          fling(born, 2 * Math.PI * hash(k + 0.5), MAT.resist.stroke, life, 0.6 + 2.6 * rpmAt(born, v.rpm) / 8000, k);
        }
      }
      // EBR: a second nozzle moves over the wafer edge and sprays solvent while the wafer turns slowly
      const nozIn = M.clamp((tp - T.spin1) / 1.0, 0, 1) * M.clamp((T.stop - tp) / 1.0, 0, 1);
      if (nozIn > 0) {
        const phE = -0.45, [Xe, Ye] = P(0.955 * Math.cos(phE), 0.955 * Math.sin(phE), h);
        const off = (1 - nozIn) * 1.6, nx = Xe + 0.05 + off, top = Ye + 0.55;
        p.line(nx, top, nx + 1.1, top + 0.55, { color: C.greyB, width: 5, noOcc: true });
        p.line(nx, top, nx - 0.05, top - 0.1, { color: C.greyB, width: 5, noOcc: true });
        p.text('EBR solvent', nx + 0.25, top + 0.62, { size: 0.19, color: C.blue });
        const spraying = tp > T.ebrOn && tp < T.ebrOff && nozIn > 0.99;
        if (spraying) {
          for (let j = 0; j < 4; j++) {
            const ph = (tp * 3 + j / 4) % 1;
            p.circle(nx - 0.05 - 0.05 * ph, top - 0.12 - ph * (top - 0.12 - Ye), 0.035, { fill: C.blue, stroke: null });
          }
          p.path(M.linspace(phE - 0.25, phE + 0.25, 12).map(a => P(0.955 * Math.cos(a), 0.955 * Math.sin(a), 0.005)), { color: C.blue, width: 4, alpha: 0.7, noOcc: true });
          if (run) {
            const dt = 0.04, life = 0.6;
            for (let k = Math.floor((tp - life) / dt); k <= Math.floor(tp / dt); k++) {
              const born = k * dt;
              if (born < T.ebrOn || tp - born > life || tp < born) continue;
              if (hash(k + 7.3) > 0.7) continue;
              fling(born, phE + 0.3 * (hash(k + 1.7) - 0.3), C.blue, life, 0.9, k);
            }
          }
        }
      }
      // film-thickness gauge (under the stage title)
      const gx = Lx0 + 0.1, gy = 1.62, gw = 2.3;
      const frac = tp < T.disp ? vol : tp < T.spread1 ? 1 : hFinal / 0.15 + (1 - hFinal / 0.15) * f;
      const gLabel = tp >= T.ebrOn + 2 ? `film: dry, ${um(v.t)}, clean edge` : tp >= T.ebrOn ? 'film: dry – EBR clears the edge' : tp >= T.spin1 ? `film: dry, ${um(v.t)}`
        : tp >= T.spread1 ? 'film: liquid, thinning…' : tp >= T.disp ? 'film: liquid, spreading' : 'film: puddle';
      p.text(gLabel, gx, gy + 0.3, { size: 0.2, color: tp >= T.spin1 ? C.yellow : C.text, bold: tp >= T.spin1 });
      p.box(gx, gy - 0.08, gx + gw, gy + 0.08, { fill: C.grid, stroke: null });
      p.box(gx, gy - 0.08, gx + gw * M.clamp(frac, 0, 1), gy + 0.08, { fill: MAT.resist.stroke, stroke: null });
      p.text(run ? 'schematic, not to scale · rotation 50× slower' : 'schematic, not to scale', Lx0 + 0.15, -3.75, { size: 0.18, color: C.muted });
      p.layer('bead', () => {
        if (tp >= T.ebrOn + 2) p.place('edge cleared by EBR', [[cx + Rx - 0.2, cy + Ry + 0.35, 'right', 'bottom'], [cx + Rx, cy - Ry - 0.3, 'right', 'top']], { size: 0.19, color: C.blue, key: 'bead' });
        else if (tp >= T.spin0 + 3) p.place('edge bead: up to 20–30 × t', [[cx + Rx - 0.2, cy + Ry + 0.35, 'right', 'bottom'], [cx + Rx, cy - Ry - 0.3, 'right', 'top']], { size: 0.19, color: C.text, key: 'bead' });
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
      { name: 'A coating run', caption: 'Dispense, spread, spin up, spin off, edge bead removal, stop', set: { rpm: 4000, p: 20, k: 90 }, duration: 0.5, enter: () => restart(), hold: 14,
        text: v => `Watch one run of the spin coater. A puddle of resist is dropped on the wafer, which is held by a vacuum chuck. A short spin at about 500 rpm spreads it over the whole wafer, then the chuck accelerates to the final speed – here ${rpmS(v.rpm)} – for 15–30 s. Most of the resist flies off into the bowl; what stays dries into a film of ${um(v.t)}. At the end the wafer slows down, a second nozzle rinses the edge with solvent (edge bead removal) and the wafer spins dry.` },
      { name: 'Thinning during the spin', caption: 'Fast at first, then the solvent evaporation takes over', enter: () => restart(), hold: 14,
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
        text: v => `Resist piles up at the wafer edge into a ridge, the edge bead – up to 20–30 times thicker than the film (${um(v.bead[0])} … ${um(v.bead[1])} here). It would keep the mask away from the resist in contact printing, so it is dissolved right after coating: the wafer turns slowly while a nozzle sprays solvent onto the outer few millimetres (EBR, watch the end of the run), then it spins dry. Now switch to <b>Explore</b> and change the speed – the run starts again.` },
    ],
  });
}());
