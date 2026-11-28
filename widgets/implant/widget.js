/* Ion implantation: Gaussian as-implanted profile, projected range and straggle, junction depth, masking, beam time.
   Topic: doping. */
(function () {
  const { C, M, fmt } = MFW;
  const IM = MFW_IMPL;
  const ION = { B: { name: 'boron', sym: 'B⁺', type: 'p' }, P: { name: 'phosphorus', sym: 'P⁺', type: 'n' }, As: { name: 'arsenic', sym: 'As⁺', type: 'n' } };
  const MASKN = { resist: 'photoresist', sio2: 'SiO₂' };
  const WAFER_A = Math.PI * 10 * 10;                       // 200 mm wafer, cm²
  const NICE = [50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000];
  const nm = x => (x >= 1000 ? `${fmt.sig(x / 1000, 3)} µm` : `${fmt.sig(x, 3)} nm`);
  const conc = c => `${fmt.sci(c, 1)} cm⁻³`;
  const dose = q => `${fmt.sci(q, 1)} cm⁻²`;
  const secs = s => (s < 60 ? `${fmt.sig(s, 2)} s` : s < 3600 ? `${fmt.sig(s / 60, 2)} min` : `${fmt.sig(s / 3600, 2)} h`);
  const passS = f => (f < 1e-12 ? 'less than 10⁻¹² of the dose' : f > 0.995 ? 'practically the whole dose' : f >= 0.01 ? `${fmt.num(100 * f, 1)} % of the dose` : `${fmt.sci(f, 1)} of the dose`);
  const amps = a => (a >= 1e-3 ? `${fmt.sig(a * 1e3, 2)} mA` : `${fmt.sig(a * 1e6, 2)} µA`);

  let memoKey = null, memo = null;
  function compute(v) {
    const key = [v.ion, v.E, v.Q, v.NB, v.mask, v.dm, v.I].join('|');
    if (key === memoKey) return memo;
    const r = IM.range(v.ion, 'Si', v.E), rm = IM.range(v.ion, v.mask, v.E);
    const Np = IM.peak(v.Q, r.dRp);
    const [xj1, xj2] = IM.junctions(v.Q, r.Rp, r.dRp, v.NB);
    const mk = IM.mask(v.Q, rm, v.dm, v.NB);
    const need = Math.max(r.Rp + 3.5 * r.dRp, (xj2 || 0) * 1.25);
    const iN = NICE.findIndex(n => n >= need), zmax = iN < 0 ? 2000 : NICE[iN];
    const xs = M.linspace(0, NICE[Math.min(iN < 0 ? NICE.length - 1 : iN + 1, NICE.length - 1)], 451);   // one step beyond: the held range is covered
    memo = { Rp: r.Rp, dRp: r.dRp, Rpm: rm.Rp, dRpm: rm.dRp, Np, xj1, xj2, mk, zmax, need, xs,
      prof: xs.map(x => IM.gauss(x, v.Q, r.Rp, r.dRp)),
      leak: xs.map(x => IM.gauss(x + v.dm, v.Q, rm.Rp, rm.dRp)),       // under the mask, Si treated like the mask material (approximation)
      tBeam: IM.beamTime(v.Q, WAFER_A, v.I), N0: IM.gauss(0, v.Q, r.Rp, r.dRp) };
    memoKey = key;
    return memo;
  }

  MFW.widget('#app', {
    title: 'Ion implantation: range, straggle and dose',
    alt: v => `${ION[v.ion].name} implanted at ${fmt.num(v.E, 0)} keV with a dose of ${dose(v.Q)} into silicon doped ${conc(v.NB)}: projected range ${nm(v.Rp)}, straggle ${nm(v.dRp)}, peak ${conc(v.Np)}, junction at ${v.xj2 ? nm(v.xj2) : 'none'}.`,
    source: 'Gaussian as-implanted profile, peak concentration and masking criterion as in J. D. Plummer, M. D. Deal, P. B. Griffin, <i>Silicon VLSI Technology</i>, Prentice Hall 2000, ch. 8. Range data: see the references below the widget. Amorphous (random) target, no channeling, no damage or annealing; Pearson IV skewness of real profiles is ignored.',
    freeText: v => `Explore – design an implant: choose the ion, energy and dose, then check the junction depth and whether ${nm(v.dm)} of ${MASKN[v.mask]} masks it (it must hold the concentration at the Si surface below N<sub>B</sub>).`,

    params: {
      ion: { value: 'B', label: 'Ion', options: { B: 'Boron ¹¹B⁺ (p-type)', P: 'Phosphorus ³¹P⁺ (n-type)', As: 'Arsenic ⁷⁵As⁺ (n-type)' } },
      E: { value: 30, min: 10, max: 200, log: true, label: 'Energy <i>E</i>', format: e => `${fmt.num(e, 0)} keV` },
      Q: { value: 1e15, min: 1e11, max: 1e16, log: true, label: 'Dose <i>Q</i>', format: dose },
      NB: { value: 1e16, min: 1e14, max: 1e18, log: true, label: 'Substrate doping <i>N</i>_B (opposite type)', format: conc },
      mask: { value: 'resist', label: 'Mask material', options: { resist: 'Photoresist', sio2: 'SiO₂' }, group: 'Mask and beam' },
      dm: { value: 500, min: 50, max: 2000, log: true, label: 'Mask thickness <i>d</i>', format: nm, group: 'Mask and beam' },
      I: { value: 1e-3, min: 1e-6, max: 2e-2, log: true, label: 'Beam current <i>I</i> (200 mm wafer)', format: amps, group: 'Mask and beam' },
    },
    layers: { rp: false, junction: false, mask: false },
    explore: { show: ['rp', 'junction', 'mask'] },

    derived: v => compute(v),

    tex: [
      { at: [0, 3.42], tex: 'N(x) = \\frac{Q}{\\sqrt{2\\pi}\\,\\Delta R_p}\\,e^{-(x-R_p)^2/2\\Delta R_p^2},\\qquad R_p = {{Rp:0}}\\ \\mathrm{nm},\\quad \\Delta R_p = {{dRp:0}}\\ \\mathrm{nm},\\quad N_p = {{Np:sci2}}\\ \\mathrm{cm^{-3}}', size: 0.33 },
    ],

    draw(p, v, w) {
      const ion = ION[v.ion], dopMat = ion.type === 'p' ? 'pdoped' : 'ndoped', subMat = ion.type === 'p' ? 'ndoped' : 'pdoped';
      const dopCol = ion.type === 'p' ? C.red : C.blue;
      const zmaxT = w.nice('zmax', NICE, v.need);                                              // no flip-flop at a step boundary
      const zmax = w.smooth('zmax', zmaxT, { log: true });

      // ---------------------------------------------------------- cross-section through a mask window (depth to scale)
      // Si and mask share one vertical scale: the height is split between the depth range and the mask thickness,
      // with at least 2.3 units for the Si (a thicker mask is drawn broken)
      const X0 = -6.45, X1 = -1.75, Yb = -2.75, mTop = 2.45;
      const k = w.smooth('kz', Math.max(2.3 / zmaxT, (mTop - Yb) / (zmaxT + v.dm)), { log: true });   // units per nm
      const Ys = Math.min(Yb + zmax * k, mTop - 0.9);
      const wL = -4.9, wR = -3.3;                                                              // window
      const view = [X0, Yb, X1, 3.0];
      p.material('si', X0, Yb, X1, Ys);
      p.material(subMat, X0, Yb, X1, Ys, { stroke: null });
      // implanted dopant as filled iso-concentration contours, one shade per decade above N_B (darkest at the peak,
      // buried at R_p). N(x, y) = N_win(y)·L(x) + N_mask(y)·(1 − L(x)): L is the lateral spread of the ions through
      // the window, a Gaussian of the same σ as ΔR_p (assumed; the window width itself is schematic)
      const wC = (wL + wR) / 2, sig = M.clamp(v.dRp * k, 0.02, 0.5), s2 = Math.SQRT2 * sig;
      const Lx = x => 0.5 * (IM.erfc((x - wR) / s2) - IM.erfc((x - wL) / s2));
      const Nw = y => IM.gauss(y, v.Q, v.Rp, v.dRp), Nm = y => IM.gauss(y + v.dm, v.Q, v.Rpm, v.dRpm);
      const Nxy = (x, y) => { const l = Lx(x); return Nw(y) * l + Nm(y) * (1 - l); };
      const xEdge = (y, c) => {                                         // left contour point at depth y (N(wC, y) ≥ c)
        if (Nxy(X0 - 0.05, y) >= c) return X0 - 0.05;
        let lo = X0 - 0.05, hi = wC;
        for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; if (Nxy(m, y) >= c) hi = m; else lo = m; }
        return hi;
      };
      const yEdge = (y0, y1, c) => {                                    // depth between y0 and y1 where N(wC, y) = c
        const in0 = Nxy(wC, y0) >= c;
        for (let i = 0; i < 28; i++) { const m = (y0 + y1) / 2; if ((Nxy(wC, m) >= c) === in0) y0 = m; else y1 = m; }
        return (y0 + y1) / 2;
      };
      const NS = 160, ys = M.linspace(0, zmax, NS + 1);
      const contour = c => {                                            // runs of depth where N(wC, y) ≥ c → left boundary + flags
        const runs = []; let cur = null;
        ys.forEach((y, j) => {
          const inside = Nxy(wC, y) >= c;
          if (inside && !cur) { cur = { top: j === 0, pts: [] }; if (j > 0) { const ye = yEdge(ys[j - 1], y, c); cur.pts.push([wC, Ys - ye * k]); } }
          if (inside) cur.pts.push([xEdge(y, c), Ys - y * k]);
          if (!inside && cur) { const ye = yEdge(ys[j - 1], y, c); cur.pts.push([wC, Ys - ye * k]); runs.push(cur); cur = null; }
        });
        if (cur) runs.push(cur);
        return runs.map(r => ({ top: r.top, left: r.pts, right: r.pts.map(([x, y]) => [2 * wC - x, y]).reverse() }));
      };
      const levels = [v.NB];
      for (let e = Math.floor(Math.log10(v.NB)) + 1; 10 ** e < v.Np; e++) levels.push(10 ** e);
      const NBruns = contour(v.NB);
      p.clip(X0, Yb, X1, Ys, () => levels.forEach((c, i) => (i ? contour(c) : NBruns).forEach(r =>
        p.polygon([...r.left, ...r.right], { fill: dopCol, fillAlpha: i ? 0.17 : 0.22, stroke: null, noOcc: true }))));
      // junction = the N = N_B contour (not drawn along the surface)
      p.layer('junction', () => {
        p.clip(X0, Yb, X1, Ys, () => NBruns.forEach(r => p.path([...r.left, ...r.right], { color: C.yellow, width: 2.5, closed: !r.top, noOcc: true })));
        if (v.xj2 && v.xj2 * k < Ys - Yb) {
          const xRight = Math.max(wR, ...NBruns.flatMap(r => r.right.map(q => q[0])));            // right edge of the junction contour
          const xd = Math.min(xRight + 0.25, X1 - 0.55), yd = Ys - v.xj2 * k;
          p.dim(xd, Ys, xd, yd, '');
          p.place('x_j', [[xd + 0.1, (Ys + yd) / 2, 'left'], [xd - 0.1, (Ys + yd) / 2, 'right']], { size: 0.24, color: C.greyA, within: view, key: 'xjdim' });
        }
      });
      // mask, to the same vertical scale; a mask taller than the drawing is shown broken in the middle
      // (lower part next to the Si, upper part with the top surface where the ions enter)
      const mh = v.dm * k, cut = Ys + mh > mTop + 0.02, top = Math.min(Ys + mh, mTop);   // tolerance: a mask that just fits is not drawn broken (no blinking at equality)
      const gB = Ys + 0.55, gT = Ys + 0.72;                                                    // break between the two parts
      const parts = cut ? [{ y0: Ys, y1: gB, d0: v.dm - 0.55 / k }, { y0: gT, y1: mTop, d0: 0 }] : [{ y0: Ys, y1: top, d0: 0 }];
      const yOf = (part, d) => (cut ? (part.d0 === 0 ? mTop - d * k : Ys + (v.dm - d) * k) : Ys + mh - d * k);   // depth below the mask top → y
      const mat = v.mask === 'resist' ? 'resist' : 'sio2';
      for (const part of parts) for (const [a, b] of [[X0, wL], [wR, X1]]) {
        p.material(mat, a, part.y0, b, part.y1, { stroke: null });
        // ions stopped in the mask: band Rp,m ± ΔRp,m below the mask top
        p.clip(a, part.y0, b, part.y1, () => p.box(a, yOf(part, v.Rpm - v.dRpm), b, yOf(part, v.Rpm + v.dRpm), { fill: dopCol, fillAlpha: 0.45, stroke: null, noOcc: true }));
      }
      if (cut) for (const [a, b] of [[X0, wL], [wR, X1]]) for (const y of [gB, gT]) {
        const zz = []; for (let i = 0; i <= 8; i++) zz.push([a + (b - a) * i / 8, y + (i % 2 ? 0.05 : -0.05) * (y === gB ? 1 : -1)]);
        p.path(zz, { color: MFW.MAT[mat].stroke, width: 1.5, noOcc: true });
      }
      p.text(`${MASKN[v.mask]} ${nm(v.dm)}${cut ? ' (broken)' : ''}`, X0 + 0.1, Ys + Math.min(0.28, mh / 2), { size: 0.19, color: C.text, bg: true });
      // beam
      for (let i = 0; i < 5; i++) {
        const x = X0 + 0.45 + i * (X1 - X0 - 0.9) / 4;
        p.arrow(x, 2.72, x, top + 0.1, { color: dopCol, width: 2.5, head: 0.14 });
      }
      p.text(`${ion.sym}  ${fmt.num(v.E, 0)} keV`, X1 + 0.1, 2.6, { size: 0.22, color: dopCol, bold: true });
      p.text(ion.type === 'p' ? 'n-type substrate' : 'p-type substrate', X1 - 0.1, Yb + 0.25, { size: 0.21, align: 'right', color: C.text });
      // depth scale bar
      const sb = zmax / 4;
      p.line(X0 - 0.15, Ys, X0 - 0.15, Ys - sb * k, { color: C.text, width: 3 });
      p.text(nm(sb), X0 - 0.36, Ys - sb * k / 2, { size: 0.19, align: 'center', color: C.text, rotate: 90 });
      p.text('depth to scale · window width schematic', (X0 + X1) / 2, Yb - 0.22, { size: 0.19, align: 'center', color: C.muted });
      p.text('shading: one step per decade above N_B', (X0 + X1) / 2, Yb - 0.47, { size: 0.19, align: 'center', color: C.muted });

      // ---------------------------------------------------------- profile plot
      const ax = p.axes({ x: 0.45, y: -2.75, w: 6.15, h: 5.15, xr: [0, zmax], yr: [1e14, 1e23], ylog: true, grid: true, size: 0.22,
        yticks: [1e14, 1e16, 1e18, 1e20, 1e22], xlabel: 'depth x (nm)', ylabel: 'concentration (cm⁻³, log scale)', ylabelOffset: 1.05 }).draw();
      const DASH_NB = [0.08, 0.08], DASH_M = [0.1, 0.07], DASH_RP = [0.04, 0.07];
      p.clip(ax.x, ax.y - 0.05, ax.x + ax.w, ax.y + ax.h + 0.05, () => {
        ax.hline(v.NB, { color: C.muted, dash: DASH_NB });
        p.layer('mask', () => ax.curve(v.xs, v.leak, { color: C.red, width: 2.5, dash: DASH_M }));
        p.layer('rp', () => ax.vline(v.Rp, { color: C.purple, dash: DASH_RP, to: v.Np }));
        ax.curve(v.xs, v.prof, { color: C.yellow, width: 4.5 });
        p.layer('junction', () => { for (const xj of [v.xj1, v.xj2]) if (xj && xj < zmax) ax.dot(xj, v.NB, { r: 0.09 }); });
      });
      ax.legend([
        { label: `${ion.name}, as implanted`, color: C.yellow, width: 4 },
        { label: `under ${nm(v.dm)} of ${MASKN[v.mask]}`, color: C.red, dash: DASH_M, alpha: p.vis('mask') },
        { label: `substrate N_B = ${fmt.sci(v.NB, 1)}`, color: C.muted, textColor: C.greyA, dash: DASH_NB },
      ], { corner: 'tr', size: 0.19 });
      // straggle bracket at N = Np·e^(−1/2) (the profile is that high at Rp ± ΔRp)
      p.layer('rp', () => {
        const yb = v.Np * Math.exp(-0.5);
        if (v.Rp + v.dRp < zmax && ax.Y(yb) < ax.y + ax.h) {
          p.dim(ax.X(Math.max(0, v.Rp - v.dRp)), ax.Y(yb), ax.X(v.Rp + v.dRp), ax.Y(yb), '', { color: C.purple });
          ax.place('2ΔR_p', [0.12, 0.45, 0.8, 1.15].flatMap(dy => [[ax.X(v.Rp) + 0.08, ax.Y(yb) - dy, 'left', 'top'], [ax.X(v.Rp) - 0.08, ax.Y(yb) - dy, 'right', 'top']]),
            { color: C.purple, size: 0.21, key: 'drp' });
        }
        if (v.Rp < zmax) ax.place('R_p', [0.3, 0.7, 1.1, 1.5, 1.9, 2.3].flatMap(dy => [[ax.X(v.Rp) + 0.08, ax.y + dy, 'left'], [ax.X(v.Rp) - 0.08, ax.y + dy, 'right']]),
          { color: C.purple, size: 0.22, key: 'rpl' });
      });
      ax.place(`N_p = ${fmt.sci(v.Np, 1)}`, ax.around(v.Rp, v.Np, 0.16).concat(ax.around(v.Rp, v.Np, 0.4), ax.around(v.Rp, v.Np, 0.7)), { color: C.yellow, size: 0.21, key: 'np' });
      p.layer('junction', () => {
        if (v.xj2 && v.xj2 < zmax) ax.place(`x_j = ${nm(v.xj2)}`, ax.around(v.xj2, v.NB, 0.16).concat(ax.around(v.xj2, v.NB, 0.4), ax.around(v.xj2, v.NB, 0.7), [[ax.X(v.xj2) - 0.5, ax.Y(v.NB) + 0.15, 'right', 'bottom'], [ax.X(v.xj2) - 0.9, ax.Y(v.NB) + 0.15, 'right', 'bottom'], [ax.x + ax.w - 0.1, ax.Y(v.NB) + 0.15, 'right', 'bottom'], [ax.x + ax.w - 0.1, ax.y + ax.h * 0.45, 'right']]), { color: C.yellow, size: 0.21, key: 'xj' });
        if (v.xj1) ax.place(`shallow junction ${nm(v.xj1)}`, [[ax.x + 0.12, ax.y + ax.h - 0.12, 'left', 'top']].concat(ax.around(v.xj1, v.NB, 0.16), ax.around(v.xj1, v.NB, 0.4), ax.around(v.xj1, v.NB, 0.7), [[ax.X(v.xj1) + 0.5, ax.Y(v.NB) + 0.15, 'left', 'bottom'], [ax.X(v.xj1) + 0.9, ax.Y(v.NB) + 0.15, 'left', 'bottom']]), { color: C.yellow, size: 0.21, key: 'xj1' });
      });
    },

    readout: v => {
      const mk = v.mk;
      return MFW.chars([
        ['projected range', 'R<sub>p</sub>', nm(v.Rp)],
        ['straggle', 'ΔR<sub>p</sub>', nm(v.dRp)],
        ['peak concentration', 'N<sub>p</sub>', conc(v.Np), undefined, { hl: true, f: 'Q/(√(2π)·ΔR<sub>p</sub>) ≈ 0.4·Q/ΔR<sub>p</sub>' }],
        ['concentration at the surface', '', conc(v.N0)],
        ['junction depth', 'x<sub>j</sub>', v.xj2 ? nm(v.xj2) : 'none (peak below N<sub>B</sub>)', undefined, { note: v.xj1 ? `buried layer from ${nm(v.xj1)}` : '' }],
        [`range in ${MASKN[v.mask]}`, 'R<sub>p</sub><sup>*</sup>', nm(v.Rpm)],
        [`straggle in ${MASKN[v.mask]}`, 'ΔR<sub>p</sub><sup>*</sup>', nm(v.dRpm)],
        ['dose through the mask', 'T', passS(mk.pass)],
        ['mask needed', '', mk.need > 0 ? nm(mk.need) : 'none (peak below N<sub>B</sub>)', undefined, { f: 'N at the Si surface ≤ N<sub>B</sub>' }],
        ['this mask', '', mk.ok ? 'thick enough' : 'too thin', '', { warn: !mk.ok }],
        ['implant time, 200 mm wafer', 't', secs(v.tBeam), undefined, { f: 'Q·q·A/I' }]]);
    },

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Ions into silicon', caption: 'Each ion stops after a random path: a Gaussian depth profile', set: { ion: 'B', E: 30, Q: 1e15, NB: 1e16, mask: 'resist', dm: 500, I: 1e-3 }, show: ['rp'], duration: 1.5,
        text: v => `An ion implanter accelerates ionised dopant atoms – here ${ION[v.ion].sym} at ${fmt.num(v.E, 0)} keV – and scans the beam over the wafer. Each ion loses its energy in collisions with nuclei and electrons and stops after a random path. In an amorphous (random) target the depths are close to a Gaussian: centred at the <b>projected range</b> R<sub>p</sub> = ${nm(v.Rp)}, with a standard deviation, the <b>straggle</b> ΔR<sub>p</sub> = ${nm(v.dRp)}.` },
      { name: 'Energy sets the depth', caption: 'Higher energy → deeper and broader profile', set: { E: 30 }, duration: 1,
        task: 'The peak of the profile now lies about 110 nm below the surface. Raise the <b>energy E</b> until the projected range R<sub>p</sub> is about 300 nm.',
        goal: v => Math.abs(v.Rp - 300) <= 25, solution: { E: 93 },
        text: v => `At ${fmt.num(v.E, 0)} keV ${ION[v.ion].name} stops at R<sub>p</sub> = ${nm(v.Rp)} with ΔR<sub>p</sub> = ${nm(v.dRp)}: more energy carries the ions deeper and broadens the profile. The same dose spread over a broader profile gives a lower peak, here ${conc(v.Np)}.` },
      { name: 'Dose sets the concentration', caption: 'N_p = Q/(√(2π)·ΔR_p) ≈ 0.4·Q/ΔR_p', from: { E: 100, Q: 1e15 }, set: { E: 100, Q: 1e13 }, duration: 2.5,
        ask: { q: 'The energy stays at 100 keV, but the dose – the number of ions per cm² – is cut to one hundredth, from 10¹⁵ to 10¹³ cm⁻². What happens to the profile?',
          options: ['The peak is 100× lower; depth and width stay the same', 'The peak is 100× lower and the profile becomes shallower', 'The peak is 10× lower and the profile 10× narrower'], correct: 0 },
        text: v => `The dose Q – ions per cm² – is the area under the profile; R<sub>p</sub> and ΔR<sub>p</sub> depend only on the ion and its energy. The peak is N<sub>p</sub> = Q/(√(2π)·ΔR<sub>p</sub>) ≈ 0.4·Q/ΔR<sub>p</sub> = ${conc(v.Np)} for Q = ${dose(v.Q)}. Doses range from about 10¹¹–10¹³ cm⁻² (threshold adjustment) to 10¹⁵–10¹⁶ cm⁻² (source/drain contacts, polysilicon doping; Rubin &amp; Poate 2003). Unlike diffusion, the dose is measured exactly: it is the integrated beam current.` },
      { name: 'Heavy and light ions', caption: 'At the same energy, arsenic stops much closer to the surface', from: { ion: 'B', Q: 1e15, E: 100 }, set: { ion: 'As', Q: 1e15, E: 100 }, duration: 2,
        ask: { q: 'Boron at 100 keV stops about 320 nm deep. An arsenic ion is almost seven times heavier. Where does arsenic of the same energy stop?',
          options: ['Deeper – the heavier ion has more momentum', 'At about the same depth – the energy is the same', 'Much closer to the surface'], correct: 2 },
        text: v => `Arsenic is almost seven times heavier than boron. At the same ${fmt.num(v.E, 0)} keV it stops at R<sub>p</sub> = ${nm(v.Rp)} with a narrow straggle of ${nm(v.dRp)} – heavy ions lose their energy mainly in nuclear collisions, close to the surface. That is why As is the choice for shallow n⁺ layers.` },
      { name: 'Junction depth', caption: 'The junction lies where N(x) = N_B', set: { ion: 'B', E: 30, NB: 1e16 }, show: ['junction'], duration: 2,
        text: v => `The implanted ${ION[v.ion].name} compensates the substrate doping N<sub>B</sub>. Where the Gaussian falls to N<sub>B</sub> the junction forms: x<sub>j</sub> = R<sub>p</sub> + ΔR<sub>p</sub>·√(2 ln(N<sub>p</sub>/N<sub>B</sub>)) = ${nm(v.xj2)}. If the surface concentration is below N<sub>B</sub> (deep implant, highly doped substrate) there is a second junction above the peak: a <i>buried</i> layer – try it in Explore.` },
      { name: 'Masking', caption: 'The mask must stop the tail of the profile, not only the peak', from: { dm: 300 }, set: { dm: 300 }, show: ['mask'], duration: 2,
        ask: { q: 'Outside the window the ions must stop in the mask, so that the concentration reaching the silicon stays below N<sub>B</sub>. In photoresist these boron ions have R<sub>p</sub> ≈ 200 nm and ΔR<sub>p</sub> ≈ 50 nm. Is 300 nm of resist enough?',
          options: ['Yes – the mask is thicker than R<sub>p</sub>', 'Yes – the mask is even thicker than R<sub>p</sub> + ΔR<sub>p</sub>', 'No – too much of the Gaussian tail still reaches the silicon'], correct: 2 },
        text: v => `Where the window is closed the ions stop in the mask (R<sub>p</sub> = ${nm(v.Rpm)} in ${MASKN[v.mask]}). But the Gaussian tail goes further: with ${nm(v.dm)} of mask, ${passS(v.mk.pass)} gets through and the highest concentration that reaches the Si is ${conc(v.mk.inSi)} – ${v.mk.ok ? 'below' : 'above'} N<sub>B</sub> = ${conc(v.NB)} (red dashed curve: the profile under the mask).` },
      { name: 'Mask thickness', caption: v => `${nm(v.dm)} of ${MASKN[v.mask]}: ${v.mk.ok ? 'thick enough' : 'too thin'}`, set: { dm: 300 }, duration: 1,
        task: 'Open <b>Mask and beam</b> and raise the <b>mask thickness d</b> until the profile under the mask (red, dashed) stays below N<sub>B</sub> everywhere in the silicon.',
        goal: v => v.mk.ok, solution: { dm: 450 },
        text: v => `To keep the concentration in the Si below N<sub>B</sub> the mask must be at least R<sub>p</sub> + ΔR<sub>p</sub>·√(2 ln(N<sub>p</sub>/N<sub>B</sub>)) = ${nm(v.mk.need)} thick (range, straggle and peak taken in the mask material)${v.mk.need > 0 ? ` – here ${fmt.sig(v.mk.need / v.Rpm, 2)}× the projected range in the mask` : ''}. With ${nm(v.dm)} of ${MASKN[v.mask]}, ${passS(v.mk.pass)} gets through and at most ${conc(v.mk.inSi)} reaches the Si.` },
      { name: 'Beam time', caption: 't = Q·q·A / I', set: { dm: 500, I: 1e-3 }, duration: 1.5,
        text: v => `The dose is counted as charge: t = Q·q·A/I. For ${dose(v.Q)} on a 200 mm wafer (A = 314 cm²) at ${amps(v.I)} the implant takes ${secs(v.tBeam)}. After implantation the lattice is damaged and most dopants sit on interstitial sites – an anneal repairs the damage and activates them (and moves the profile a little). Wafers are usually tilted by about 7° so that the ions do not channel along crystal rows. Now switch to <b>Explore</b>.` },
    ],
  });
}());
