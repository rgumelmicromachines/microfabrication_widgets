/* Spin coating of photoresist: film thickness vs spin speed and solids content. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const S = MFW_SPIN;
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const rpmS = r => `${fmt.num(r, 0)} rpm`;
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const YMAX = [2, 3, 4, 5, 6, 8, 10, 12, 15];
  const SPAN = [1, 2, 5, 10, 20];

  MFW.widget('#app', {
    title: 'Spin coating of photoresist',
    loop: !still,                                                    // the wafer turns
    alt: v => `Spin coating at ${rpmS(v.rpm)} with ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)}: resist thickness ${um(v.t)} (${um(v.tBaked)} after soft bake).`,
    source: 'Empirical spin curve t = k·p²/√w (t in Å, k = spinner constant 80–100, p = solids content in %, w = rpm/1000), the typical 3000–6000 rpm and 1–2 µm, the ~25 % thinning in the soft bake and the edge bead of up to 20–30× the film thickness as quoted in microfabrication course notes (e.g. Wake Forest University, NAN 242, “Photolithography”). The units of t are not printed with the rule; Å is the only choice consistent with the typical values. The spin-speed exponent ½ is the usual value for low- and medium-viscosity resists (DTU Nanolab, Litho Tool Package – Spin coating). Absolute thickness needs a measured spin curve for each resist and spinner.',
    freeText: v => `Explore – find the spin speed for a 1.5 µm film with your resist. With ${fmt.num(v.p, 0)} % solids and k = ${fmt.num(v.k, 0)} it is about ${rpmS(Math.round(S.speedFor(1.5, v.p, v.k) / 10) * 10)}.`,

    params: {
      rpm: { value: 4000, min: 1000, max: 8000, step: 50, label: 'Spin speed', format: rpmS },
      p: { value: 20, min: 10, max: 35, step: 0.5, label: 'Solids content of the resist <i>p</i>', unit: '%', digits: 1 },
      k: { value: 90, min: 80, max: 100, step: 1, label: 'Spinner constant <i>k</i>', digits: 0 },
    },
    layers: { window: false, bake: false, bead: false, band: false },
    explore: { show: ['window', 'bake', 'bead', 'band'] },

    derived: v => S.state(v),

    tex: [
      { at: [0, 3.42], tex: 't = k\\,\\dfrac{p^2}{\\sqrt{w}} = {{k:0}}\\cdot\\dfrac{{{p:1}}^2}{\\sqrt{{{w:2}}}} = {{tA:0}}\\ \\text{Å} = {{t:2}}\\ \\mu\\mathrm{m}', size: 0.33 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- top view: the spinning wafer (animation slowed down)
      const cx = -4.55, cy = 1.05, R = 1.38;
      const ang = still ? 0.6 : v.time * 2 * Math.PI * v.rpm / 8000;       // 0.5 rev/s at 4000 rpm: 133× slower than reality
      p.circle(cx, cy, R, { fill: MAT.resist.fill, stroke: C.greyB, width: 2 });
      for (let i = 0; i < 6; i++) {                                      // faint radial streaks make the rotation visible
        const a = ang + i * Math.PI / 3;
        p.line(cx + 0.25 * R * Math.cos(a), cy + 0.25 * R * Math.sin(a), cx + 0.92 * R * Math.cos(a + 0.35), cy + 0.92 * R * Math.sin(a + 0.35),
          { color: MAT.resist.stroke, width: 2, alpha: 0.45, noOcc: true });
      }
      const fa = ang - Math.PI / 2, ca = Math.cos(fa), sa = Math.sin(fa), half = 0.42, rr = Math.sqrt(R * R - half * half);
      p.line(cx + rr * ca - half * sa, cy + rr * sa + half * ca, cx + rr * ca + half * sa, cy + rr * sa - half * ca, { color: C.bg, width: 7, noOcc: true });   // primary flat
      p.circle(cx, cy, 0.16, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.arc(cx, cy, R + 0.2, 20, 75, { color: C.text, width: 2.5 });
      const ae = 75 * Math.PI / 180;
      p.arrow(cx + (R + 0.2) * Math.cos(ae - 0.12), cy + (R + 0.2) * Math.sin(ae - 0.12), cx + (R + 0.2) * Math.cos(ae), cy + (R + 0.2) * Math.sin(ae), { color: C.text, width: 2.5, head: 0.16 });
      p.text(rpmS(v.rpm), cx + R + 0.35, cy + R * 0.5, { size: 0.28, color: C.yellow, bold: true });
      p.text(still ? 'top view' : 'top view (rotation shown 133× slower)', cx, cy - R - 0.25, { size: 0.19, align: 'center', color: C.muted });

      // ---------------------------------------------------------- cross-section at the wafer edge (thickness to scale)
      const X0 = -6.8, X1 = -2.2, yb = -3.25, yS = -2.35, H = 1.25;
      const span = w.smooth('span', SPAN.find(s => s >= v.t * 2.2) || 20, { log: true });   // µm per H units
      const k = H / span, tt = v.t * k;
      p.material('si', X0, yb, X1 - 0.35, yS, { stroke: null });
      const edge = X1 - 0.35, beadH = Math.min(S.BEAD[0] * v.t * k, H + 0.05);
      const film = [[X0, yS], [X0, yS + tt]];
      const bv = p.vis('bead');
      const beadTop = yS + tt + (beadH - tt) * bv;
      for (let i = 0; i <= 20; i++) { const u = i / 20, x = edge - 0.75 + 0.75 * u; film.push([x, yS + tt + (beadTop - yS - tt) * Math.sin(u * Math.PI / 2) ** 3]); }
      film.push([edge, yS]);
      p.clip(X0, yb, X1 + 0.2, yS + H + 0.1, () => p.materialPoly('resist', film));
      p.layer('bake', () => {
        p.line(X0, yS + S.BAKE * tt, edge - 0.8, yS + S.BAKE * tt, { color: C.gold, width: 2.5, dash: [0.1, 0.07] });
        p.place(`after soft bake ≈ ${um(v.tBaked)}`, [[X0 + 0.1, yS + S.BAKE * tt - 0.17, 'left', 'top'], [X0 + 0.1, yS + tt + 0.2, 'left', 'bottom']],
          { size: 0.19, color: C.gold, key: 'bake', within: [X0, yb, X1, yS + H + 0.4] });
      });
      p.dim(X0 + 2.3, yS, X0 + 2.3, yS + tt, '');
      p.place(`t = ${um(v.t)}`, [[X0 + 2.45, yS + tt + 0.18, 'left', 'bottom'], [X0 + 2.45, yS + tt / 2, 'left']], { size: 0.22, color: C.greyA, key: 'tdim' });
      p.text('Si wafer', X0 + 0.12, yb + 0.22, { size: 0.21, color: C.text });
      p.layer('bead', () => p.place('edge bead: up to 20–30 × t', [[edge - 0.05, Math.min(beadTop, yS + H) + 0.15, 'right', 'bottom'], [edge - 0.85, yS + tt + 0.35, 'right']],
        { size: 0.19, color: C.text, key: 'bead' }));
      const sb = span / 5;                                                // scale bar, to the right of the section
      p.line(X1 + 0.05, yS, X1 + 0.05, yS + sb * k, { color: C.white, width: 3 });
      p.text(um(sb), X1 + 0.15, yS + sb * k / 2, { size: 0.19, color: C.text });
      p.text('edge of the wafer, vertical scale only', (X0 + X1) / 2, yb - 0.22, { size: 0.19, align: 'center', color: C.muted });

      // ---------------------------------------------------------- spin curve t(rpm)
      const ymax = w.smooth('ymax', YMAX.find(y => y >= S.thickness(1000, v.p, 100) * 1.05) || 15, { log: true });
      const ax = p.axes({ x: 0.75, y: -2.75, w: 5.85, h: 5.1, xr: [1000, 8000], yr: [0, ymax], grid: true, size: 0.22, nticks: 7,
        xfmt: x => String(Math.round(x)), xlabel: 'spin speed (rpm)', ylabel: 'resist thickness t (µm)', ylabelOffset: 0.85 }).draw();
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
      ax.plot(x => S.thickness(x, v.p, v.k), { color: C.yellow, width: 4.5 });
      ax.dot(v.rpm, v.t, { r: 0.11 });
      ax.legend([
        { label: `t = k·p²/√w, p = ${fmt.num(v.p, 1)} %, k = ${fmt.num(v.k, 0)}`, color: C.yellow, width: 4 },
        { label: 'k = 80 … 100 (spinner constant)', color: C.yellow, width: 9, alpha: 0.35 * p.vis('band') },
        { label: 'after soft bake (≈ −25 %)', color: C.gold, dash: [0.1, 0.07], alpha: p.vis('bake') },
        { label: 'typical: 3000–6000 rpm, 1–2 µm', color: C.green, width: 9, alpha: 0.5 * p.vis('window') },
      ], { corner: 'tr', size: 0.18 });
    },

    readout: v => `<table>
      <tr><td>w = spin speed / 1000</td><td>${fmt.num(v.w, 2)}</td></tr>
      <tr><td>thickness t = k·p²/√w</td><td><b class="hl">${um(v.t)}</b> (${fmt.num(v.tA, 0)} Å)</td></tr>
      <tr><td>range for k = 80 … 100</td><td>${um(v.tLo)} … ${um(v.tHi)}</td></tr>
      <tr><td>after soft bake (≈ −25 %)</td><td>${um(v.tBaked)}</td></tr>
      <tr><td>at double the speed</td><td>${um(v.t / Math.SQRT2)} (÷ √2)</td></tr>
      <tr><td>edge bead, up to</td><td>${um(v.bead[0])} … ${um(v.bead[1])}</td></tr></table>`,

    steps: [
      { name: 'Spin coating', caption: 'Resist is dispensed, then the wafer spins at a few thousand rpm', set: { rpm: 4000, p: 20, k: 90 }, show: ['window'], duration: 1,
        text: v => `A puddle of resist is dispensed on the wafer, which is held by a vacuum chuck and spun at 3000–6000 rpm for 15–30 s. The centrifugal force throws most of the resist off the edge while the solvent evaporates, and a uniform film is left: here ${um(v.t)} – typical for silicon processes (1–2 µm, green band).` },
      { name: 'Faster spin, thinner film', caption: 't ∝ 1/√w: twice the speed gives √2 thinner, not half', set: { rpm: 8000 }, duration: 3,
        text: v => `The empirical spin curve is t = k·p²/√w with w = rpm/1000. Doubling the speed from 4000 to 8000 rpm thins the film only by √2, to ${um(v.t)}. Spin speed is therefore the <b>fine</b> adjustment of thickness.` },
      { name: 'Solids content', caption: 'p² – the resist formulation is the coarse knob', set: { rpm: 4000, p: 30 }, duration: 2.5,
        text: v => `The solids content p (and with it the viscosity) enters squared: 30 % instead of 20 % gives (30/20)² = 2.25× thicker film, ${um(v.t)}. That is why resists are sold in several viscosities – you choose the resist for the thickness range and fine-tune with the spin speed.` },
      { name: 'Spinner constant', caption: 'k = 80 … 100: every spinner and resist needs its own spin curve', set: { p: 20, k: 90 }, show: ['band'], duration: 1.5,
        text: v => `The constant k lumps together everything the formula leaves out – spin time, acceleration, solvent, exhaust, temperature. Its typical range 80–100 alone moves the thickness between ${um(v.tLo)} and ${um(v.tHi)} (shaded band). In a real lab you measure a spin curve for each resist on your spinner and read the speed from it.` },
      { name: 'Soft bake', caption: 'The soft bake drives off solvent: up to ~25 % thinner', show: ['bake'],
        text: v => `Before exposure a short soft bake on a hot plate or in an oven drives the remaining solvent out and densifies the resist. The film shrinks by up to about 25 %: ${um(v.t)} becomes about ${um(v.tBaked)} (dashed).` },
      { name: 'Edge bead', caption: 'At the wafer edge the resist piles up: up to 20–30 × thicker', show: ['bead'],
        text: v => `Surface tension holds back resist at the wafer edge and forms a ridge, the edge bead, up to 20–30 times thicker than the film (${um(v.bead[0])} … ${um(v.bead[1])} here, drawn not to scale). It would stop the mask from touching the resist in contact printing, so it is dissolved with a solvent jet (edge bead removal) right after coating. Now switch to <b>Explore</b>.` },
    ],
  });
}());
