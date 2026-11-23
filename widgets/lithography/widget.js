/* Optical lithography: contact/proximity vs projection printing, resolution and depth of focus. Topic: lithography. */
(function () {
  const { C, M, fmt } = MFW;
  const L = MFW_LITHO;
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const N = 361;

  let memoKey = null, memo = null;
  function compute(v) {
    const lam = L.LAMBDA[v.lam];
    const key = [v.mode, lam, v.hp, v.gap, v.resist, v.coll, v.NA, v.sigma, v.defocus].join('|');
    if (key !== memoKey) {
      const p = 2 * v.hp, xs = M.linspace(-p, p, N);
      const I = L.aerialImage({ mode: v.mode, lambda: lam, hp: v.hp, xs, NA: v.NA, sigma: v.sigma, defocus: v.defocus,
        gap: v.gap, resist: v.resist, collimation: v.coll });
      let mx = -Infinity, mn = Infinity; for (const y of I) { if (y > mx) mx = y; if (y < mn) mn = y; }
      memo = { lamUm: lam, xs, I, Imax: mx, Imin: mn, contrast: (mx - mn) / (mx + mn), reversed: I[(N - 1) / 2] < I[(N - 1) / 4] - 0.02 };
      memoKey = key;
    }
    const thr = 1 / v.dose;
    const cd = L.clearedWidth(memo.xs, memo.I, thr);
    const k1 = v.hp * v.NA / memo.lamUm;
    return { ...memo, thr, cd, k1, hpMin: L.minPitch(memo.lamUm, v.NA, v.sigma) / 2, dofv: L.dof(memo.lamUm, v.NA),
      bmin: L.proximityLimit(memo.lamUm, v.gap, v.resist),
      printed: cd > 0 && isFinite(cd) && memo.Imin < thr };
  }
  const verdict = v => (v.reversed ? 'contrast-reversed image (Talbot effect) – wrong pattern' : !isFinite(v.cd) ? 'over-exposed: everything cleared' : v.cd === 0 ? (v.Imax < v.thr ? 'not resolved: nothing clears' : 'nothing clears')
    : v.printed ? `printed, space width ${um(v.cd)} (target ${um(v.hp)})` : 'not resolved');

  MFW.widget('#app', {
    title: 'Optical lithography – resolution limits',
    alt: v => `${v.mode === 'projection' ? 'Projection' : 'Contact/proximity'} printing of ${um(v.hp)} lines and spaces with ${L.LNAME[v.lam]}. Image contrast ${fmt.num(v.contrast, 2)}; ${verdict(v)}.`,
    source: 'Scalar Fourier optics of an ideal binary chrome mask with equal lines and spaces. Projection: Abbe imaging with a circular partially coherent source (σ) and a circular pupil (NA), defocus as an exact scalar phase; no aberrations, polarisation or resist optics. Contact/proximity: free-space angular-spectrum propagation over gap + d/2, averaged over the collimation cone of the illumination. Resist: threshold model (positive tone). Rules of thumb: Rayleigh R = k₁λ/NA, DOF ≈ ±0.5 λ/NA² (total λ/NA²), minimum pitch λ/(NA(1+σ)) (C. A. Mack, <i>Fundamental Principles of Optical Lithography</i>, Wiley 2007); proximity b<sub>min</sub> = 1.5√(λ(s + d/2)) (M. J. Madou, <i>Manufacturing Techniques for Microfabrication and Nanotechnology</i>, CRC 2011).',
    freeText: v => (v.mode === 'projection'
      ? 'Explore – find the smallest half-pitch that still prints. Then shorten λ or raise NA and σ. How much defocus can you tolerate?'
      : 'Explore – how small a feature can you print in contact? And with a 20 µm gap (to protect the mask)?'),

    params: {
      mode: { value: 'proximity', label: 'Printing method', options: { proximity: 'Contact / proximity (mask aligner)', projection: 'Projection (stepper / scanner)' } },
      lam: { value: 'i', label: 'Wavelength λ', options: L.LNAME },
      hp: { value: 2, min: 0.05, max: 10, log: true, label: 'Line = space width (half-pitch)', format: um },
      gap: { value: 0, min: 0, max: 50, step: 0.5, label: 'Mask–resist gap <i>s</i>', format: x => (x === 0 ? '0 (contact)' : `${fmt.num(x, 1)} µm`), when: v => v.mode === 'proximity' },
      resist: { value: 1.4, min: 0.5, max: 5, step: 0.1, label: 'Resist thickness <i>d</i>', unit: 'µm', digits: 1, when: v => v.mode === 'proximity' },
      coll: { value: 2, min: 0, max: 5, step: 0.25, label: 'Illumination half-angle (collimation)', unit: '°', digits: 2, when: v => v.mode === 'proximity' },
      NA: { value: 0.5, min: 0.1, max: 0.93, step: 0.01, label: 'Numerical aperture NA', digits: 2, when: v => v.mode === 'projection' },
      sigma: { value: 0.5, min: 0, max: 1, step: 0.05, label: 'Partial coherence σ', digits: 2, when: v => v.mode === 'projection' },
      defocus: { value: 0, min: -1, max: 1, step: 0.01, label: 'Defocus', unit: 'µm', digits: 2, when: v => v.mode === 'projection' },
      dose: { value: 2.5, min: 1.1, max: 6, step: 0.05, label: 'Exposure dose E / E₀ (dose-to-clear)', digits: 2 },
    },
    layers: { thr: true, rule: false },
    explore: { show: ['rule'] },
    derived: v => compute(v),

    tex: [
      { at: [0, 3.5], tex: v => (v.mode === 'projection'
        ? 'R = k_1\\frac{\\lambda}{NA},\\quad k_1 = \\frac{{{hp:3}}\\,\\mathrm{\\mu m}\\cdot {{NA}}}{{{lamUm:3}}\\,\\mathrm{\\mu m}} = {{k1}}\\qquad \\mathrm{DOF} \\approx \\pm\\frac{\\lambda}{2\\,NA^2}'
        : 'b_{min} \\approx 1.5\\sqrt{\\lambda\\,(s + d/2)} = 1.5\\sqrt{{{lamUm:3}}\\cdot({{gap:1}} + {{resist:1}}/2)}\\ \\mathrm{\\mu m} = {{bmin}}\\ \\mathrm{\\mu m}'), size: 0.38 },
    ],

    draw(p, v) {
      const proj = v.mode === 'projection';
      // ---------------------------------------------------------- schematic of the exposure tool (not to scale)
      const cx = -4.1;
      p.text(proj ? 'projection: mask imaged by a lens' : (v.gap > 0 ? 'proximity: mask above the resist' : 'contact: mask on the resist'), cx, 2.75, { size: 0.24, align: 'center', color: C.greyA });
      if (proj) {
        p.material('glass', cx - 1.6, 2.0, cx + 1.6, 2.2);
        for (let i = -3; i <= 3; i += 2) p.box(cx + i * 0.25 - 0.12, 1.92, cx + i * 0.25 + 0.12, 2.0, { fill: MATc('chrome'), stroke: null });
        p.text('mask (4× or 5× larger)', cx + 1.7, 2.1, { size: 0.19, color: C.muted });
        const half = 1.55 * v.NA / 0.93 + 0.2, yl = 0.45;
        p.ellipse(cx, yl, 1.75, 0.22, { fill: C.blueE, fillAlpha: 0.35, stroke: C.blue, width: 2 });
        p.text('lens', cx + 1.85, yl, { size: 0.2, color: C.muted });
        const yw = -1.9;
        p.polygon([[cx - half, yl - 0.1], [cx + half, yl - 0.1], [cx, yw]], { fill: C.yellow, fillAlpha: 0.13, stroke: null });
        p.line(cx - half, yl - 0.1, cx, yw, { color: C.yellow, width: 2 }); p.line(cx + half, yl - 0.1, cx, yw, { color: C.yellow, width: 2 });
        p.line(cx, yl - 0.1, cx, yw, { color: C.muted, width: 1.5, dash: [0.06, 0.06] });
        const ang = Math.atan2(half, yl - 0.1 - yw);
        p.arc(cx, yw, 0.9, 90, 90 - ang * 180 / Math.PI, { color: C.yellow, width: 2 });
        const hAt = y => half * (y - yw) / (yl - 0.1 - yw);              // half-width of the light cone at height y
        p.place(`NA = sin θ = ${fmt.num(v.NA, 2)}`, [0.95, 0.75, 1.2].map(dy => [cx + hAt(yw + dy) + 0.14, yw + dy, 'left']),
          { size: 0.21, color: C.yellow, key: 'na' });
        p.line(cx - 1.2, 1.8, cx - 1.2, 0.75, { color: C.muted, width: 1.5 }); p.line(cx + 1.2, 1.8, cx + 1.2, 0.75, { color: C.muted, width: 1.5 });
        p.material('resist', cx - 2.2, yw - 0.12, cx + 2.2, yw);
        p.material('si', cx - 2.2, yw - 0.55, cx + 2.2, yw - 0.12);
        if (Math.abs(v.defocus) > 0.005) p.text(`defocus ${fmt.num(v.defocus, 2)} µm`, cx, yw - 0.8, { size: 0.2, align: 'center', color: C.gold });
      } else {
        for (let i = -2; i <= 2; i++) {                                  // illumination rays with collimation spread
          const x = cx + i * 0.6, s = Math.tan(v.coll * Math.PI / 180) * 2;
          p.arrow(x, 2.45, x, 1.25, { color: C.purple, width: 2, head: 0.15 });
          if (v.coll > 0) { p.line(x, 2.45, x - s * 0.5, 1.4, { color: C.purple, width: 1, alpha: 0.6 }); p.line(x, 2.45, x + s * 0.5, 1.4, { color: C.purple, width: 1, alpha: 0.6 }); }
        }
        p.text('UV', cx - 1.7, 2.3, { size: 0.22, color: C.purple });
        const gapU = Math.min(v.gap / 50, 1) * 1.2;                      // exaggerated gap
        const ym = 0.9, yr = ym - 0.08 - gapU;
        p.material('glass', cx - 2, ym, cx + 2, ym + 0.32);
        for (let i = -3; i <= 3; i += 2) p.box(cx + i * 0.3 - 0.15, ym - 0.08, cx + i * 0.3 + 0.15, ym, { fill: MATc('chrome'), stroke: null });
        p.text('mask: glass + Cr', cx + 2.1, ym + 0.15, { size: 0.19, color: C.muted });
        p.material('resist', cx - 2.2, yr - 0.3, cx + 2.2, yr);
        p.material('si', cx - 2.2, yr - 0.9, cx + 2.2, yr - 0.3);
        p.text('resist', cx + 2.3, yr - 0.15, { size: 0.19, color: C.muted });
        if (v.gap > 0) p.dim(cx + 2.5, ym - 0.08, cx + 2.5, yr, `s = ${fmt.num(v.gap, 1)} µm`, { offset: 0.12, align: 'left', size: 0.2 });
        p.text('gap not to scale', cx, yr - 1.15, { size: 0.19, align: 'center', color: C.muted });
      }

      // ---------------------------------------------------------- mask, aerial image and resist (to scale, two periods)
      const X0 = 0.45, W = 5.55, pp = 2 * v.hp, sx = x => X0 + (x + pp) / (2 * pp) * W;
      // mask strip
      p.text('mask', X0 - 0.12, 2.45, { size: 0.21, align: 'right', color: C.muted });
      p.material('glass', X0, 2.33, X0 + W, 2.58, { stroke: null });
      for (let k = -2; k <= 2; k++) {                                     // chrome lines centred at x = (k + 1/2)·p
        const a = (k + 0.5) * pp - v.hp / 2, b = (k + 0.5) * pp + v.hp / 2;
        const A = Math.max(a, -pp), B = Math.min(b, pp);
        if (B > A) p.box(sx(A), 2.33, sx(B), 2.45, { fill: MATc('chrome'), stroke: null });
      }
      // aerial image
      const ax = p.axes({ x: X0, y: -0.85, w: W, h: 2.85, xr: [-pp, pp], yr: [0, 1.6], grid: true, size: 0.22, nticks: 4,
        xfmt: x => (Math.abs(x) < 1e-9 ? '0' : um(Math.abs(x)).replace(/^/, x < 0 ? '−' : '')), yticks: [0, 0.5, 1, 1.5],
        ylabel: 'intensity / open frame', ylabelOffset: 0.6 }).draw();
      ax.hline(1, { color: C.muted, dash: [0.03, 0.06], width: 1.5 });
      ax.area(x => interp(v.xs, v.I, x), -pp, pp, { color: C.yellow, fillAlpha: 0.12, samples: 240 });
      ax.curve(v.xs, Array.from(v.I), { color: C.yellow, width: 4 });
      p.layer('thr', () => {
        ax.hline(v.thr, { color: C.gold, width: 2.5, dash: [0.12, 0.08] });
        // label in the right margin: inside the plot the image edges cross the threshold line everywhere
        const Yt = ax.Y(v.thr), xm = ax.X(pp) + 0.1;
        p.text('threshold', xm, Yt + 0.07, { color: C.gold, size: 0.18, baseline: 'bottom' });
        p.text(`E₀/E = ${fmt.num(v.thr, 2)}`, xm, Yt - 0.07, { color: C.gold, size: 0.18, baseline: 'top' });
      });
      // developed resist (positive): resist stays where dose·I < E0
      const yS = -2.75, yR = -1.95;
      p.text('after development', X0 - 0.12, (yS + yR) / 2 + 0.1, { size: 0.2, align: 'right', color: C.muted });
      p.material('si', X0, yS - 0.3, X0 + W, yS);
      let start = null;
      for (let j = 0; j < v.xs.length; j++) {
        const keep = v.I[j] < v.thr;
        if (keep && start === null) start = j;
        if ((!keep || j === v.xs.length - 1) && start !== null) {
          p.material('resist', sx(v.xs[start]), yS, sx(v.xs[keep ? j : j - 1]), yR, { stroke: null });
          start = null;
        }
      }
      p.line(X0, yS, X0 + W, yS, { color: MATc('si', 'stroke'), width: 1.5 });
      p.text(verdict(v), X0 + W / 2, yS - 0.52, { size: 0.22, align: 'center', color: v.printed ? C.green : C.red, bold: true });
      p.layer('rule', () => {
        const lim = proj ? v.hpMin : v.bmin;
        const txt = proj ? `cut-off half-pitch λ/(2NA(1+σ)) = ${um(lim)}` : `rule of thumb b_{min} = ${um(lim)}`;
        p.text(txt, X0 + W, 2.85, { size: 0.21, align: 'right', color: v.hp >= lim ? C.muted : C.red });
      });
      p.text('position x', X0 + W / 2, -1.42, { size: 0.21, align: 'center', color: C.muted });
    },

    readout: v => MFW.chars([
      ['image contrast', '', fmt.num(v.contrast, 2), '', { hl: true, f: '(I<sub>max</sub> − I<sub>min</sub>)/(I<sub>max</sub> + I<sub>min</sub>)' }],
      ['result', '', verdict(v), ''],
      ['resist threshold', 'E₀/E', fmt.num(v.thr, 2), '', { f: '1/dose' }],
      v.mode === 'projection' && ['k₁ factor', 'k₁', fmt.num(v.k1, 2), '', { f: 'half-pitch·NA/λ' }],
      v.mode === 'projection' && ['smallest half-pitch (cut-off)', '', um(v.hpMin)],
      v.mode === 'projection' && ['depth of focus', 'DOF', `±${um(v.dofv / 2)}`, undefined, { f: '≈ ±λ/(2NA²)' }],
      v.mode !== 'projection' && ['smallest resolvable feature', 'b<sub>min</sub>', um(v.bmin), undefined, { f: '1.5√(λ(s + d/2))' }]]),

    steps: [
      { name: 'Contact printing', caption: 'Mask in contact with the resist: a near-perfect shadow', set: { mode: 'proximity', lam: 'i', hp: 2, gap: 0, resist: 1.4, coll: 2, dose: 2.5 }, duration: 1,
        text: 'A mask aligner presses the chrome mask onto the resist and floods it with mercury i-line light. The light diffracts only over half the resist thickness, so the intensity in the resist (yellow) is close to a copy of the mask – with Fresnel fringes that overshoot by up to ~30 % near the edges – and 2 µm lines print well. The price: contact damages the mask and the resist, and every particle becomes a defect.' },
      { name: 'Proximity gap', caption: 'A gap protects the mask – and blurs the image', set: { gap: 10 }, show: ['rule'], duration: 3,
        text: v => `Lifting the mask by s = ${fmt.num(v.gap, 0)} µm avoids contact, but the light now diffracts across the gap (Fresnel diffraction): fringes appear and edges blur. The rule of thumb b<sub>min</sub> ≈ 1.5√(λ(s + d/2)) = ${um(v.bmin)} puts our 2 µm lines below the safe limit: the ideal simulated image still prints (contrast ${fmt.num(v.contrast, 2)}), but with real resist contrast, dose and gap variations this is no longer a robust process.` },
      { name: 'Too large a gap', caption: v => `s = ${fmt.num(v.gap, 0)} µm: image contrast only ${fmt.num(v.contrast, 2)}`, set: { gap: 20 }, duration: 2.5,
        text: v => `At 20 µm the image of 2 µm lines has almost no contrast left (${fmt.num(v.contrast, 2)}): lines and spaces receive nearly the same dose, so there is no practical dose window. Proximity printing is limited to a few micrometres – fine for MEMS and many research cleanrooms, not for modern chips. (In Explore you will find that for a perfectly periodic grating the contrast comes back at larger gaps, partly <i>reversed</i> – the Talbot self-imaging effect. Real masks are not infinite gratings, so do not rely on it.)` },
      { name: 'Projection printing', caption: 'A lens images the mask: resolution set by λ and NA', set: { mode: 'projection', hp: 0.5, NA: 0.5, sigma: 0.5, defocus: 0, dose: 2.5 }, duration: 1.5,
        text: v => `A projection lens collects the diffraction orders of the mask and recombines them into an image. Only orders that fit into the pupil (sin θ ≤ NA) take part. For 0.5 µm lines at i-line and NA = 0.5, k₁ = ${fmt.num(v.k1, 2)} and the image is sharp.` },
      { name: 'Shrinking the features', caption: v => `k₁ = ${fmt.num(v.k1, 2)}: contrast falls to ${fmt.num(v.contrast, 2)}`, set: { hp: 0.3 }, duration: 3,
        text: v => `At 0.3 µm (k₁ = ${fmt.num(v.k1, 2)}) the ±1st orders only partly fit into the pupil and the image loses contrast. The space still prints, but the printed width (${um(v.cd)}) no longer matches the mask – dose and process control get critical.` },
      { name: 'Below the cut-off', caption: 'No ±1st order → no image at all', set: { hp: 0.22 }, duration: 2.5,
        text: v => `For a pitch below λ/(NA(1+σ)) – here a half-pitch below ${um(v.hpMin)} – not even one first diffraction order passes the lens. Only the 0th order arrives: uniform grey light, and nothing prints. This is the hard limit; k₁ = 0.25 is reached only with σ → 1 and off-axis illumination.` },
      { name: 'Shorter λ, higher NA', caption: 'ArF 193 nm, NA 0.85: k₁ back to a comfortable value', set: { lam: 'arf', NA: 0.85, hp: 0.12 }, duration: 2,
        text: v => `The industry's answer has been shorter wavelengths (436 → 365 → 248 → 193 nm, then EUV at 13.5 nm) and larger NA (up to 1.35 with water immersion). With ArF and NA = 0.85, 120 nm lines have k₁ = ${fmt.num(v.k1, 2)} and print again.` },
      { name: 'Depth of focus', caption: v => `Defocus ${fmt.num(v.defocus, 2)} µm vs DOF ≈ ±${um(v.dofv / 2)}`, set: { defocus: 0.2 }, duration: 2.5,
        text: v => `The price of high NA is depth of focus: DOF ≈ ±λ/(2NA²) = ±${um(v.dofv / 2)}. Already at about ±130 nm the printed width drifts by more than 10 %, and at ${fmt.num(v.defocus * 1000, 0)} nm – less than the resist thickness or typical wafer topography – nothing prints at all. That is why wafers must be flat and why CMP planarisation became essential. Try it in <b>Explore</b>.` },
    ],
  });

  function MATc(name, prop = 'fill') { return MFW.MAT[name][prop]; }
  function interp(xs, ys, x) {
    const n = xs.length, t = (x - xs[0]) / (xs[n - 1] - xs[0]) * (n - 1), i = Math.max(0, Math.min(n - 2, Math.floor(t)));
    return ys[i] + (ys[i + 1] - ys[i]) * (t - i);
  }
}());
