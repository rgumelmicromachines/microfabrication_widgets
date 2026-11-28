/* Development of a positive photoresist: Dill exposure, Mack development rate, resist profile of a line, contrast curve,
   dark erosion and the attack of the developer on an aluminium film. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const DV = MFW_DEV, LI = MFW_LITHO;
  const NX = 41, NZ = 32, H_AL = 0.3;                                         // grid of the cross-section; Al film drawn (µm)
  const DOSES = M.logspace(2, 500, 33);                                       // doses of the line-width curve
  const um = x => `${fmt.sig(x, 3)} µm`;
  const nm = x => `${fmt.num(x * 1000, 0)} nm`;
  const mj = x => `${fmt.sig(x, 3)} mJ/cm²`;

  let kImg = null, img = null, kSet = null, set = null, kMain = null, main = null;
  function compute(v) {
    const S = DV.MACK[v.pb], hp = v.hp, d = v.d;
    const ki = [hp, v.gap, d].join('|');
    if (ki !== kImg) {
      img = LI.aerialImage({ mode: 'proximity', lambda: DV.DILL.lambda, hp, xs: M.linspace(0, hp, NX), gap: v.gap, resist: d, collimation: 2 });
      kImg = ki;
    }
    const ks = ki + '|' + v.pb;
    if (ks !== kSet) { set = DOSES.map(E => DV.develop2D({ I: img, E, d, S, X: hp, nz: NZ })); kSet = ks; }
    const km = ks + '|' + v.E;
    if (km !== kMain) { main = DV.develop2D({ I: img, E: v.E, d, S, X: hp, nz: NZ }); kMain = km; }
    const R = main, t = v.t;
    const foot = DV.footEdge(R, t), cd = 2 * (hp - foot);
    const ct = DV.contrast(d, t, S);
    const depthOpen = DV.depth(v.E, d, t, S);
    const tb0 = R.T[NZ * NX];                                                 // the developer reaches the substrate here first
    const alL = DV.alLoss(v.dev, t - tb0);
    return { S, I: img, R, prof: DV.profile(R, t), foot, cd, notOpen: foot <= 0, gone: foot >= hp,
      Dc: ct.Dc, gamma: ct.gamma, D0: ct.D0, depthOpen, leftOpen: Math.max(0, d - depthOpen), tClear: DV.clearTime(v.E, d, S),
      mS: DV.mSurface(v.E), mB: DV.pacProfile(v.E, d)[40], dark: Math.min(d, S.rmin * t), tb0, alLo: alL[0], alHi: alL[1],
      cdCurve: set.map(Rk => 2 * (hp - DV.footEdge(Rk, t))) };
  }
  const interp = (arr, x, h) => { const q = Math.min(arr.length - 1, Math.max(0, x / h)), i = Math.min(arr.length - 2, Math.floor(q)); return arr[i] + (arr[i + 1] - arr[i]) * (q - i); };
  const cdText = v => (v.notOpen ? 'not opened at the substrate' : v.gone ? 'line washed away' : um(v.cd));
  const alText = v => (v.dev === 'azdev' ? 'taken as 0' : v.alHi <= 0 ? '0 nm' : v.alLo === null ? `≈ ${fmt.num(v.alHi, 0)} nm` : `${fmt.num(v.alLo, 0)}–${fmt.num(v.alHi, 0)} nm`);

  const widget = MFW.widget('#app', {
    title: 'Development: from exposure dose to resist profile',
    alt: v => `Positive resist, ${um(v.d)} thick, exposed with ${mj(v.E)} through a mask of ${um(v.hp)} lines and spaces and developed for ${fmt.num(v.t, 0)} s. Large open area: ${v.leftOpen > 0 ? nm(v.leftOpen) + ' of resist left' : 'cleared'}; dose to clear ${mj(v.Dc)}, contrast ${fmt.num(v.gamma, 1)}. Resist line at the substrate: ${cdText(v)}. Unexposed resist lost: ${nm(v.dark)}.`,
    source: 'Exposure: Dill’s equations for the photoactive compound, reduced to one equation in depth for a substrate that reflects nothing (Dill et al. 1975; Babu &amp; Barouch 1986); Dill parameters of the AZ 1500 series at 365 nm from MicroChemicals. Development rate: Mack’s model with the two parameter sets he measured for <b>AZ 1350J in AZ Developer 1:1</b> (Mack 1987, Table I) – not an AZ 1500 resist; no published set for AZ 1500 was found. Front propagation in the cross-section: eikonal equation, fast sweeping method (Zhao 2005). Image at the mask edge: the contact/proximity image of the lithography lesson (scalar diffraction, 2° collimation half-angle), taken as constant through the resist apart from absorption. Attack on aluminium: Merck data sheet and MicroChemicals product page; they disagree for TMAH (10 against 70 nm/min). For AZ Developer no rate is published; it is taken as zero. The cross-section is to scale; the mask is drawn above it without its true distance.',
    freeText: v => `Explore – the dose sets how much photoactive compound is left, the developer does the rest. At ${mj(v.E)} and ${fmt.num(v.t, 0)} s the resist line is ${v.notOpen || v.gone ? cdText(v) : um(v.cd) + ' wide at the substrate'}; the mask line is ${um(v.hp)}. Press <b>Develop</b> on the figure to watch the front move.`,

    params: {
      E: { value: 60, min: 2, max: 500, log: true, label: 'Exposure dose <i>E</i> (at 365 nm)', format: mj },
      t: { value: 60, min: 0, max: 180, step: 1, label: 'Development time <i>t</i>', unit: 's', digits: 0 },
      d: { value: 1.2, min: 0.5, max: 3, step: 0.05, label: 'Resist thickness <i>d</i>', unit: 'µm', digits: 2 },
      pb: { value: 'pb70', label: 'Rate parameters (AZ 1350J, Mack 1987)', options: { pb70: 'Prebake 70 °C: 55 and 0.15 nm/s', pb100: 'Prebake 100 °C: 21 and 2 nm/s' } },
      hp: { value: 2, min: 1, max: 5, step: 0.1, label: 'Mask line = space width', unit: 'µm', digits: 1, group: 'Mask' },
      gap: { value: 0, min: 0, max: 20, step: 0.5, label: 'Mask–resist gap', format: x => (x === 0 ? '0 (contact)' : `${fmt.num(x, 1)} µm`), group: 'Mask' },
      al: { value: false, label: 'Aluminium film under the resist', group: 'Substrate and developer' },
      dev: { value: 'azdev', label: 'Developer (attack on aluminium)', options: Object.fromEntries(Object.entries(DV.DEVELOPERS).map(([k, x]) => [k, x.name])), group: 'Substrate and developer' },
    },
    layers: { gamma: false, latent: true },
    explore: { show: ['gamma', 'latent'] },
    derived: v => compute(v),

    draw(p, v, w) {
      const hp = v.hp, d = v.d, E = v.E, t = v.t, R = v.R;
      const X0 = -6.15, XW = 5.6, XC = X0 + XW / 2, X1 = X0 + XW, TOP = 0.5, BOT = -3.2;
      const k = w.smooth('k', Math.min(XW / (2 * hp), (TOP - BOT - 0.95) / (d + H_AL)), { log: true });   // scene units per µm
      const U = XW / (2 * k), sx = u => XC + u * k;
      const fold = u => { const q = ((u + hp) % (2 * hp) + 2 * hp) % (2 * hp); return hp - Math.abs(q - hp); };   // 0 = space centre, hp = line centre
      const us = M.linspace(-U, U, Math.min(321, Math.max(81, Math.round(2 * U / R.hx) + 1)));

      // ======================================================== mask (position only) and dose at the resist surface
      p.text('mask', X0 - 0.12, 3.37, { size: 0.18, align: 'right', color: C.muted });
      p.material('glass', X0, 3.34, X1, 3.5, { stroke: null });
      for (let n = -Math.ceil(U / (2 * hp)) - 1; n <= Math.ceil(U / (2 * hp)) + 1; n++) {
        const a = Math.max(-U, 2 * hp * n - hp / 2), b = Math.min(U, 2 * hp * n + hp / 2);
        if (b > a) p.box(sx(a), 3.24, sx(b), 3.34, { fill: MAT.chrome.fill, stroke: null });
      }
      const eMax = w.smooth('emax', w.nice('emax', null, 1.7 * E), { log: true });
      const ad = p.axes({ x: X0, y: 1.3, w: XW, h: 1.75, xr: [-U, U], yr: [0, eMax], grid: true, size: 0.18, nticks: 4,
        xlabel: 'position across the line (µm)', ylabel: 'dose (mJ/cm²)', ylabelOffset: 0.78 }).draw();
      ad.curve(us, us.map(u => Math.min(eMax, E * interp(v.I, fold(u), R.hx))), { color: C.purple, width: 3 });
      if (v.Dc > 0 && v.Dc < eMax) {
        ad.hline(v.Dc, { color: C.muted, width: 1.5 });
        if (v.Dc > 0.16 * eMax) ad.place('dose to clear D_c', [0.06, 0.5, 0.28, 0.72, 0.9].flatMap(f => [[X0 + f * XW, ad.Y(v.Dc) + 0.05, 'left', 'bottom'], [X0 + f * XW, ad.Y(v.Dc) - 0.05, 'left', 'top']]),
          { size: 0.17, color: C.muted, key: 'dc0' });
      }
      ad.place('dose entering the resist', [2.95, 2.6, 2.25, 1.9].flatMap(y => [[X1 - 0.1, y, 'right', 'top'], [X0 + 0.1, y, 'left', 'top'], [XC, y, 'center', 'top']]), { size: 0.17, color: C.purple, key: 'dl' });

      // ======================================================== cross-section, to scale
      const yRes = TOP - 0.3, yAl = yRes - d * k, ySi = yAl - (v.al ? H_AL * k : 0);
      const depthAt = u => interp(v.prof, fold(u), R.hx), tBot = u => interp(R.T.subarray(NZ * NX, NZ * NX + NX), fold(u), R.hx);
      p.clip(X0, BOT, X1, TOP, () => {
        p.material('si', X0, BOT, X1, ySi, { stroke: null });
        if (v.al) p.box(X0, ySi, X1, yAl, { fill: MAT.metal.fill, stroke: null });
        p.material('resist', X0, yAl, X1, yRes, { stroke: null });
        // latent image: the lighter, the more of the photoactive compound is destroyed
        p.layer('latent', () => {
          const stride = Math.max(1, Math.ceil(us.length / 81)), du = (us[1] - us[0]) * stride, rows = 16, dz = d / rows;
          for (let a = 0; a < us.length - 1; a += stride) {
            const i = Math.round(fold(us[a] + du / 2) / R.hx);
            for (let j = 0; j < rows; j++) {
              const e = 1 - R.m[Math.round((j + 0.5) * NZ / rows) * NX + i];
              if (e > 0.03) p.rect(sx(us[a]), yRes - (j + 1) * dz * k, du * k * 1.03, dz * k * 1.03, { fill: C.yellow, fillAlpha: 0.75 * e, stroke: null, noOcc: true });
            }
          }
        });
        if (t > 0) {
          const dev = [[sx(-U), yRes], [sx(U), yRes]];
          for (let a = us.length - 1; a >= 0; a--) dev.push([sx(us[a]), yRes - depthAt(us[a]) * k]);
          p.polygon(dev, { fill: C.bg, stroke: null, noOcc: true });
          if (v.al && v.alHi > 0) {                                           // recess in the aluminium, drawn for the higher rate
            const rate = DV.DEVELOPERS[v.dev].al[1] / 60000, rec = [];
            for (const u of us) rec.push([sx(u), yAl - (depthAt(u) >= d - 1e-9 ? Math.min(H_AL, rate * Math.max(0, t - tBot(u))) : 0) * k]);
            p.polygon([[sx(-U), yAl], [sx(U), yAl], ...rec.reverse()], { fill: C.bg, stroke: null, noOcc: true });
          }
        }
        p.path(us.map(u => [sx(u), yRes - Math.min(depthAt(u), d) * k]), { color: MAT.resist.stroke, width: 2, noOcc: true });
        // the mask edges, to compare with the resist edges
        for (let n = -Math.ceil(U / (2 * hp)) - 1; n <= Math.ceil(U / (2 * hp)) + 1; n++) for (const sg of [-1, 1]) {
          const u = 2 * hp * n + sg * hp / 2;
          if (Math.abs(u) < U) p.line(sx(u), TOP, sx(u), yAl, { color: C.muted, width: 1, dash: [0.05, 0.06], noOcc: true });
        }
      });
      if (!v.notOpen && !v.gone && t > 0) p.dim(sx(-v.cd / 2), ySi - 0.2, sx(v.cd / 2), ySi - 0.2, `resist line ${um(v.cd)}`, { size: 0.18, offset: -0.2, color: C.white, labelColor: C.text });
      // legend and scale bar
      let lx = X0;
      [['resist', MAT.resist.fill, MAT.resist.stroke], ['exposed', MFW.mix(MAT.resist.fill, C.yellow, 0.6), C.yellow], v.al && ['Al', MAT.metal.fill, MAT.metal.stroke], ['Si', MAT.si.fill, MAT.si.stroke]]
        .filter(Boolean).forEach(([lab, fill, stroke]) => {
          p.rect(lx, BOT - 0.3, 0.24, 0.16, { fill, stroke, width: 1, noOcc: true });
          p.text(lab, lx + 0.32, BOT - 0.22, { size: 0.17, color: C.text });
          lx += 0.32 + p.measure(lab, 0.17) + 0.3;
        });
      const sb = w.nice('sb', [0.2, 0.5, 1, 2, 5], 0.6 / k);
      p.line(X1 - sb * k, BOT - 0.5, X1, BOT - 0.5, { color: C.white, width: 3 });
      p.text(`${fmt.sig(sb, 1)} µm`, X1 - sb * k - 0.1, BOT - 0.5, { size: 0.17, align: 'right', color: C.text });
      p.text('cross-section to scale; mask distance not to scale', X0, BOT - 0.55, { size: 0.16, color: C.muted });

      // ======================================================== contrast curve of a large open area
      const xt = [2, 5, 10, 20, 50, 100, 200, 500];
      const a1 = p.axes({ x: 0.95, y: 0.85, w: 5.8, h: 2.05, xr: [2, 500], xlog: true, yr: [0, 1.3], grid: true, size: 0.18, xticks: xt, xfmt: x => String(x),
        yticks: [0, 0.5, 1], ylabel: 'resist left / d', ylabelOffset: 0.62 }).draw();
      p.text('large open area', a1.x, a1.y + a1.h + 0.2, { size: 0.19, color: C.greyA });
      const left = x => 1 - DV.depth(x, d, t, v.S) / d;
      a1.plot(left, { color: C.yellow, width: 3.5, samples: 160 });
      a1.vline(E, { color: C.yellow, width: 1.5, dash: null });
      a1.dot(E, left(E), { r: 0.08 });
      p.layer('gamma', () => {
        if (isFinite(v.gamma) && v.D0 > 2 && v.Dc < 500) {
          a1.curve([v.D0, v.Dc], [1, 0], { color: C.teal, width: 2, dash: [0.08, 0.07] });
          a1.dot(v.D0, 1, { color: C.teal, r: 0.06 }); a1.dot(v.Dc, 0, { color: C.teal, r: 0.06 });
          a1.place(`D_0 = ${fmt.sig(v.D0, 2)}`, [[a1.X(v.D0), a1.Y(1.08), 'center', 'bottom'], [a1.X(v.D0) + 0.1, a1.Y(1.08), 'left', 'bottom'], [a1.X(v.D0) - 0.1, a1.Y(1.08), 'right', 'bottom'], [a1.X(v.D0) - 0.15, a1.Y(0.7), 'right']], { size: 0.18, color: C.teal, key: 'd0' });
          a1.place(`D_c = ${fmt.sig(v.Dc, 2)}`, [0.22, 0.4, 0.58, 0.76].flatMap(y => [[a1.X(v.Dc) + 0.14, a1.Y(y), 'left'], [a1.X(v.Dc) + 0.6, a1.Y(y), 'left'], [a1.X(v.Dc) + 1.2, a1.Y(y), 'left']]), { size: 0.18, color: C.teal, key: 'dc' });
          a1.place(`γ = ${fmt.num(v.gamma, 1)}`, [[a1.X(Math.sqrt(v.D0 * v.Dc)) + 0.15, a1.Y(0.62), 'left'], [a1.X(Math.sqrt(v.D0 * v.Dc)) + 0.15, a1.Y(0.8), 'left'], [a1.X(Math.sqrt(v.D0 * v.Dc)) - 0.15, a1.Y(0.35), 'right'], [a1.X(v.Dc) + 0.12, a1.Y(0.75), 'left']], { size: 0.2, color: C.teal, bold: true, key: 'gm' });
        }
      });

      // ======================================================== width of the resist line at the substrate against dose
      const yMax = w.smooth('cdmax', 2 * hp, { log: true });
      const a2 = p.axes({ x: 0.95, y: -3.05, w: 5.8, h: 2.55, xr: [2, 500], xlog: true, yr: [0, yMax * 1.08], grid: true, size: 0.18, xticks: xt, xfmt: x => String(x), nticks: 4,
        xlabel: 'exposure dose E (mJ/cm²)', ylabel: 'resist line at the substrate (µm)', ylabelOffset: 0.62 }).draw();
      a2.hline(hp, { color: C.muted, width: 1.5 });
      a2.curve(DOSES, v.cdCurve.map(c => Math.min(c, yMax)), { color: C.blue, width: 3.5 });
      a2.vline(E, { color: C.yellow, width: 1.5, dash: null });
      a2.dot(E, Math.min(v.cd, yMax), { r: 0.08 });
      a2.place('mask line width', [0.04, 0.3, 0.55].flatMap(f => [[a2.x + f * a2.w, a2.Y(hp) - 0.06, 'left', 'top'], [a2.x + f * a2.w, a2.Y(hp) + 0.06, 'left', 'bottom']]), { size: 0.17, color: C.muted, key: 'mw' });
      a2.place('not opened', [0.1, 0.9, 1.7, 2.5].flatMap(dx => [[a2.x + dx, a2.Y(yMax) - 0.08, 'left', 'top']]), { size: 0.17, color: C.blue, key: 'no' });
    },

    readout: v => MFW.chars([
      ['PAC left at the resist surface', 'm', fmt.num(v.mS, 2), '', { f: 'exp(−C·E)', note: `${fmt.num(v.mB, 2)} at the substrate` }],
      ['dose to clear', 'D<sub>c</sub>', isFinite(v.Dc) ? mj(v.Dc) : 'cannot clear in this time', undefined, { f: `open area, ${fmt.num(v.t, 0)} s` }],
      ['contrast', 'γ', isFinite(v.gamma) ? fmt.num(v.gamma, 1) : '–', '', { f: '1/log<sub>10</sub>(D<sub>c</sub>/D<sub>0</sub>)' }],
      ['resist left in the open area', '', v.leftOpen > 0 ? nm(v.leftOpen) : `none (cleared after ${fmt.num(v.tClear, 0)} s)`],
      ['resist line at the substrate', '', cdText(v), undefined, { hl: true, note: `mask ${um(v.hp)}` }],
      ['unexposed resist lost (dark erosion)', '', nm(v.dark), undefined, { f: 'r<sub>min</sub>·t' }],
      v.al && ['aluminium removed in the open area', '', alText(v), undefined, { note: v.dev === 'mif' ? 'sources give 10 and 70 nm/min' : v.dev === 'naoh' ? 'at 100 nm/min; quoted as “several 10 to over 100”' : 'made for minimal attack; no rate is published' }],
      v.gone && { warn: 'The resist line is developed away: too much dose or too long in the developer.' }]),

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Exposure', caption: 'Light destroys the photoactive compound – most of it near the surface', set: { E: 60, t: 0, d: 1.2, pb: 'pb70', hp: 2, gap: 0, al: false, dev: 'azdev' }, duration: 0.5,
        text: v => `A positive resist contains a photoactive compound (PAC) that keeps the resin from dissolving in the developer. UV light destroys it: after the dose E the fraction m = exp(−C·E) is left at the surface, here ${fmt.num(v.mS, 2)}. The resist absorbs part of the light on the way down, so the bottom of the film receives less – ${fmt.num(v.mB, 2)} is left at the substrate. The lighter areas of the cross-section are where the PAC is gone. The mask edge is not imaged sharply either (purple curve): diffraction lets some light under the chrome.` },
      { name: 'Too little dose', caption: v => `${mj(v.E)}, 60 s: ${nm(v.depthOpen)} developed, ${nm(v.leftOpen)} left`, from: { E: 25, t: 0 }, set: { E: 25, t: 60 }, duration: 3,
        ask: { q: 'A dose of 25 mJ/cm² leaves 55 % of the PAC at the surface. The 1.2 µm film is developed for 60 s. How much of it is gone in a large open area?',
          options: ['All of it', 'About half', 'Almost nothing'], correct: 1 },
        text: v => `About half: ${nm(v.depthOpen)} of ${um(v.d)}. The developer starts fast at the well-exposed surface and slows down on the way to the substrate, where more PAC is left. More time hardly helps: at this dose the film would need ${fmt.num(v.tClear / 60, 0)} min to clear.` },
      { name: 'Dose to clear', caption: v => `Open area ${v.leftOpen > 0 ? 'not yet clear' : 'clear'} at ${mj(v.E)}`, set: { E: 25, t: 60 }, duration: 1,
        task: 'Raise the <b>exposure dose</b> until the large open area (upper right) just clears in 60 s. Do not go further than needed.',
        goal: v => v.leftOpen === 0 && v.E <= 1.12 * v.Dc, solution: { E: 46 },
        text: v => `The smallest dose that clears the film in the given time is the <b>dose to clear</b>, D<sub>c</sub> = ${mj(v.Dc)} for ${um(v.d)} and ${fmt.num(v.t, 0)} s. Look at the cross-section: the middle of the space is open, but the resist line is still ${v.notOpen ? 'joined to its neighbours at the substrate' : um(v.cd) + ' wide at the substrate'}, far more than the ${um(v.hp)} of chrome. Near the mask edge the dose is lower than in the open.` },
      { name: 'Time against dose', caption: v => `120 s: dose to clear ${mj(v.Dc)}`, from: { t: 60 }, set: { t: 120 }, show: ['gamma'], duration: 3,
        ask: { q: 'The development time is doubled from 60 s to 120 s. What happens to the dose to clear?',
          options: ['It halves', 'It drops by about a seventh', 'It does not change'], correct: 1 },
        text: v => `It drops only from 44 to ${mj(v.Dc)}. The development rate rises steeply with the amount of PAC destroyed, so time is a poor substitute for dose. The steepness is the <b>contrast</b>: the film starts to thin near D<sub>0</sub> = ${mj(v.D0)} and clears at D<sub>c</sub>, γ = 1/log<sub>10</sub>(D<sub>c</sub>/D<sub>0</sub>) = ${fmt.num(v.gamma, 1)} (dashed tangent). A high contrast turns a blurred image into a steep resist edge.` },
      { name: 'Dose to size', caption: v => `Resist line ${cdText(v)} – mask ${um(v.hp)}`, set: { E: 46, t: 60 }, duration: 1,
        task: 'Clearing the open area is not enough. Raise the <b>dose</b> until the resist line at the substrate is as wide as the 2 µm chrome line (within 0.1 µm). The lower right plot shows where you are.',
        goal: v => !v.notOpen && !v.gone && Math.abs(v.cd - v.hp) <= 0.1, solution: { E: 150 },
        text: v => `At ${mj(v.E)} the line measures ${cdText(v)}: the <b>dose to size</b> is ${fmt.num(v.E / v.Dc, 1)} times the dose to clear here. Every further increase of the dose moves the edge under the chrome and narrows the line, so the line width has to be controlled through the dose.` },
      { name: 'Too long in the developer', caption: v => `180 s: line ${cdText(v)}, ${nm(v.dark)} lost on top`, from: { t: 60 }, set: { t: 180 }, duration: 3,
        ask: { q: 'The wafer stays in the developer three times as long, 180 s instead of 60 s. What happens to the 2 µm resist line?',
          options: ['Nothing, it is unexposed', 'It gets about 0.1 µm narrower', 'It is washed away'], correct: 1 },
        text: v => `The line shrinks to ${cdText(v)}. Its flanks received some light and keep dissolving slowly, and even unexposed resist is not immune: it loses r<sub>min</sub>·t = ${nm(v.dark)} in thickness (<b>dark erosion</b>). The exposed resist dissolved ${fmt.num(v.S.rmax / v.S.rmin, 0)} times faster than that, which is why the pattern survives.` },
      { name: 'A weaker rate ratio', caption: v => `r_max/r_min = ${fmt.num(v.S.rmax / v.S.rmin, 0)}: ${nm(v.dark)} of unexposed resist lost`, from: { t: 60 }, set: { pb: 'pb100', t: 60 }, show: ['gamma'], duration: 1,
        ask: { q: 'After a hotter prebake Mack measured for the same resist a maximum rate of 21 instead of 55 nm/s, and a rate of unexposed resist of 2 instead of 0.15 nm/s. How much unexposed resist is lost in 60 s now?',
          options: ['9 nm, as before', 'About 120 nm, a tenth of the film', 'None'], correct: 1 },
        text: v => `${nm(v.dark)}: the ratio of the two rates fell from 367 to ${fmt.num(v.S.rmax / v.S.rmin, 1)}. The contrast drops to ${fmt.num(v.gamma, 1)} and the dose to clear rises to ${mj(v.Dc)}. Both numbers describe one resist in one developer; a different developer, dilution or bake gives a different pair, and the data sheet of a resist rarely states them.` },
      { name: 'Aluminium under the resist', caption: v => `${DV.DEVELOPERS[v.dev].name}: aluminium removed ${alText(v)}`, set: { pb: 'pb70', al: true, dev: 'mif', t: 60 }, duration: 1,
        task: 'The wafer now carries an aluminium film, and the developer is 0.26 N TMAH. As soon as the resist is open the developer etches the aluminium. Open <b>Substrate and developer</b> and choose the developer that is made for aluminium.',
        goal: v => v.al && v.dev === 'azdev', solution: { dev: 'azdev' },
        text: v => `Aluminium dissolves in alkaline solutions. For 0.26 N TMAH one manufacturer document gives about 10 nm/min and another about 70 nm/min; for NaOH- and KOH-based developers “several 10 to over 100 nm/min” is quoted. AZ Developer is formulated for minimal attack on aluminium; its manufacturer gives no rate, and the model takes it as zero. The open area was exposed to the developer for ${fmt.num(Math.max(0, v.t - v.tb0), 0)} s here. Now switch to <b>Explore</b>: thicker resist, a gap under the mask, another line width.` },
    ],
  });

  // ------------------------------------------------------------ "Develop" button on the stage
  if (widget && widget.stage && typeof document !== 'undefined') widget.stageBar([
    { icon: '▶', label: 'Develop', title: 'Develop from 0 s to the chosen time', onClick: () => {
      if (widget.mode === 'tour') widget.setMode('explore');
      const end = widget.P.t > 0 ? widget.P.t : 60;
      widget.set({ t: 0 });
      widget.animate({ t: end }, 6, 'linear');
    } },
  ], { right: true });
}());
