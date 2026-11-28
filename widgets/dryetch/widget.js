/* Dry (reactive ion) etching of SiO₂ through a resist window: plasma, anisotropy and bias, overetch and selectivity,
   laser-interferometric end-point detection. Topic: etching. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const DR = MFW_DRY;
  const nmS = x => (Math.abs(x) >= 1000 ? `${fmt.sig(x / 1000, 3)} µm` : `${fmt.num(x, 0)} nm`);
  const minS = m => `${fmt.num(m, m < 10 ? 1 : 0)} min`;
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const hash = k => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const T0 = nowMs();

  const widget = MFW.widget('#app', {
    title: 'Dry etching: anisotropy, bias and end point',
    loop: true,                                                          // the plasma particles move all the time
    alt: v => `Reactive ion etching of ${nmS(v.hf)} SiO₂ through a ${nmS(v.W)} resist window: vertical rate ${v.Rv} nm/min, lateral ${fmt.num(v.Rl, 0)} nm/min (anisotropy ${fmt.num(v.A, 2)}). After ${minS(v.t)}: depth ${nmS(v.depth)}, undercut ${nmS(v.U)}, bias ${nmS(v.B)}; end point at ${minS(v.tc)}.`,
    source: 'Geometric etch-front model: a directional (ion-driven) vertical rate R_v plus an isotropic (radical-driven) rate R_l; anisotropy A = 1 − R_l/R_v, bias B = d_f − d_m = 2·R_l·t, complete isotropic etching gives B = 2h_f (J. D. Plummer, M. D. Deal, P. B. Griffin, <i>Silicon VLSI Technology</i>, Prentice Hall 2000, ch. 10). End point: normal-incidence reflectance of a He–Ne laser (632.8 nm) from the remaining SiO₂ on Si, thin-film interference with the optical constants of I. H. Malitson (1965) and M. A. Green (2008); one fringe per λ/2n = 217 nm. Etch rates and selectivities are free parameters with illustrative defaults – real values depend on gas, pressure, power and tool. The reactor drawing and the particle motion are schematic.',
    freeText: v => `Explore – set the two rate components and the etch time. With A = ${fmt.num(v.A, 2)} the opening widens by ${nmS(v.B)} after ${minS(v.t)}. Press <b>▶ Run etch</b> on the picture to watch the whole etch.`,

    params: {
      Rv: { value: 100, min: 20, max: 300, step: 5, label: 'Vertical (ion-driven) etch rate <i>R</i>_v', unit: 'nm/min', digits: 0 },
      Rl: { value: 15, min: 0, max: 300, step: 1, label: 'Lateral (chemical) etch rate <i>R</i>_l (≤ <i>R</i>_v)', unit: 'nm/min', digits: 0 },
      t: { value: 12, min: 0, max: 40, step: 0.1, label: 'Etch time <i>t</i>', format: minS },
      hf: { value: 1000, min: 100, max: 2000, step: 10, label: 'SiO₂ film thickness <i>h</i>_f', format: nmS },
      W: { value: 2000, min: 500, max: 5000, step: 50, label: 'Mask opening <i>d</i>_m', format: nmS },
      Ssi: { value: 15, min: 2, max: 50, step: 1, label: 'Selectivity SiO₂ : Si', format: x => `${fmt.num(x, 0)} : 1`, group: 'Mask and substrate' },
      Sr: { value: 4, min: 1, max: 10, step: 0.5, label: 'Selectivity SiO₂ : resist', format: x => `${fmt.num(x, 1)} : 1`, group: 'Mask and substrate' },
      hr: { value: 1500, min: 300, max: 3000, step: 50, label: 'Resist thickness', format: nmS, group: 'Mask and substrate' },
    },
    layers: { signal: false, bias: false },
    explore: { show: ['signal', 'bias'] },

    derived: v => DR.state(v),

    draw(p, v, w) {
      const tAnim = (nowMs() - T0) / 1000;
      const C_ION = C.gold, C_RAD = C.teal;
      // ======================================================== reactor (schematic): RF-driven bottom electrode, plasma, sheath
      const X0 = -6.9, X1 = -0.4, xc = (X0 + X1) / 2;
      const yTop = 3.05, yPl1 = 2.75, yPl0 = 1.5, ySh = 1.15, yWaf = 1.05;
      p.text('RIE reactor (schematic)', X0, 3.62, { size: 0.21, color: C.muted });
      p.box(X0 + 0.3, yTop, X1 - 0.3, yTop + 0.14, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.text('grounded electrode', X1 - 0.3, yTop + 0.32, { size: 0.18, align: 'right', color: C.muted });
      p.box(X0 + 0.3, yWaf - 0.32, X1 - 0.3, yWaf - 0.12, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.box(xc - 1.6, yWaf - 0.12, xc + 1.6, yWaf, { fill: MAT.si.fill, stroke: MAT.si.stroke, width: 1.2 });
      p.text('wafer', xc + 1.7, yWaf - 0.06, { size: 0.18, color: C.muted });
      p.text('RF-powered electrode, 13.56 MHz', X0 + 0.45, yWaf - 0.22, { size: 0.15, color: C.greyA });
      // glowing plasma and the dark sheath above the wafer
      p.box(X0 + 0.3, yPl0, X1 - 0.3, yPl1, { fill: C.purple, fillAlpha: 0.22, stroke: null, noOcc: true });
      p.text('plasma', X0 + 0.45, yPl1 - 0.18, { size: 0.2, color: C.purple });
      p.text('sheath', X1 - 0.45, (ySh + yPl0) / 2 + 0.06, { size: 0.18, align: 'right', color: C.muted });
      // ions: fall slowly in the plasma, accelerate straight down through the sheath (number ∝ directional rate)
      const nIon = Math.round(4 + 18 * (v.Rv - v.Rl) / 300), nRad = Math.round(3 + 22 * v.Rl / 300);
      for (let i = 0; i < nIon; i++) {
        const x = X0 + 0.6 + (X1 - X0 - 1.9) * hash(i + 0.1), ph = (tAnim * 0.6 + hash(i + 0.7)) % 1;    // keep clear of the 'sheath' label
        const y = ph < 0.7 ? yPl1 - 0.15 - (yPl1 - 0.15 - yPl0) * ph / 0.7 : yPl0 - (yPl0 - yWaf) * ((ph - 0.7) / 0.3) ** 2;
        if (ph > 0.7) p.line(x, y + 0.18, x, y, { color: C_ION, width: 2, alpha: 0.6, noOcc: true });
        p.circle(x, y, 0.05, { fill: C_ION, stroke: null });
      }
      // radicals: neutral, random directions, reach every surface (number ∝ lateral rate)
      for (let i = 0; i < nRad; i++) {
        const a = 2 * Math.PI * hash(i + 3.3) + tAnim * (0.6 + hash(i + 5.1)), rr = 0.35 + 0.3 * hash(i + 9.9);
        const x0 = X0 + 0.7 + (X1 - X0 - 2.0) * hash(i + 2.2), y0 = yWaf + 0.4 + (yPl1 - yWaf - 0.7) * hash(i + 4.4);
        p.circle(x0 + rr * Math.cos(a) * 0.6, y0 + rr * Math.sin(1.3 * a) * 0.3, 0.04, { fill: C_RAD, stroke: null });
      }
      // laser beam for the end-point signal, through a window in the top electrode
      const xl = xc - 0.9;
      p.line(xl, yTop + 0.55, xl, yWaf, { color: C.red, width: 2, alpha: 0.8, noOcc: true });
      p.text('He–Ne 632.8 nm', xl + 0.1, yTop + 0.42, { size: 0.18, color: C.red });
      // legend for the particles
      p.circle(X0 + 0.45, 0.62, 0.05, { fill: C_ION, stroke: null });
      p.text('ions (directional)', X0 + 0.6, 0.62, { size: 0.18, color: C.text });
      p.circle(X0 + 2.75, 0.62, 0.04, { fill: C_RAD, stroke: null });
      p.text('radicals (isotropic)', X0 + 2.9, 0.62, { size: 0.18, color: C.text });

      // ======================================================== cross-section of one feature (to scale, x = y)
      const sx0 = -6.9, sx1 = -0.4, sTop = 0.15, sBot = -3.55;
      const halfMax = 1.25 * (v.W / 2 + Math.max(v.U, 200)) + 800;      // nm shown left and right of the centre (room for labels)
      const spanY = v.hr + v.hf + Math.max(v.recess, 100) + 500;
      const k = w.smooth('k', Math.min((sx1 - sx0) / (2 * halfMax), (sTop - sBot) / spanY), { log: true });   // scene units per nm
      const cxs = (sx0 + sx1) / 2, yF = sTop - 0.25 - Math.max(0, v.resist) * k;   // top of the film
      const yI = yF - v.hf * k;                                              // film / substrate interface
      const X = x => cxs + x * k;
      p.clip(sx0, sBot, sx1, sTop, () => {
        p.material('si', sx0, sBot, sx1, yI, { stroke: null });
        p.material('sio2', sx0, yI, sx1, yF, { stroke: null });
        // etched cavity in the film (polygon from the edge function) and the recess in the substrate
        // one open outline (wall, floor or recess, wall) – no line across the opening or across the floor of the film
        if (v.t > 0) {
          const ys = M.linspace(0, v.depth, 80), right = ys.map(y => [X(v.edge(y) ?? v.W / 2), yF - y * k]);   // top → bottom
          const left = right.map(([x, y]) => [2 * cxs - x, y]);                                                   // top → bottom
          const rec = v.recess > 0 ? [[X(-v.floorHalf), yI - v.recess * k], [X(v.floorHalf), yI - v.recess * k]] : [];
          const outline = [...left, ...rec, ...right.slice().reverse()];
          p.polygon(outline, { fill: C.bg, stroke: null, noOcc: true });
          p.path(outline, { color: MAT.sio2.stroke, width: 1.5, noOcc: true });
        }
      });
      // resist on top of the cavity, so its edge overhangs an undercut film
      if (v.resist > 0) p.clip(sx0, sBot, sx1, sTop, () => {
        p.material('resist', sx0, yF, X(-v.W / 2), yF + v.resist * k, { stroke: null });
        p.material('resist', X(v.W / 2), yF, sx1, yF + v.resist * k, { stroke: null });
      });
      const yR = Math.min(sTop - 0.12, yF + Math.max(0, v.resist) * k + 0.14);
      if (v.resist > 0) p.place('resist', [[sx0 + 0.1, yR, 'left'], [sx1 - 0.1, yR, 'right']], { size: 0.19, color: C.text, key: 'resist' });
      else p.place('resist consumed – mask lost!', [[sx0 + 0.1, sBot + 0.55, 'left'], [sx1 - 0.1, sBot + 0.55, 'right'], [sx0 + 0.1, sBot + 0.9, 'left']],
        { size: 0.19, color: C.red, bold: true, key: 'resist' });
      p.place('SiO₂', [[sx0 + 0.1, (yF + yI) / 2, 'left'], [sx1 - 0.1, (yF + yI) / 2, 'right'], [sx0 + 0.1, yF - 0.14, 'left'], [sx1 - 0.1, yF - 0.14, 'right']],
        { size: 0.2, color: C.text, key: 'sio2' });
      p.text('Si', sx0 + 0.1, sBot + 0.2, { size: 0.2, color: C.text });
      p.layer('bias', () => {
        if (v.t > 0) {
          const yd = yF + Math.max(0.1, Math.max(0, v.resist) * k - 0.4);
          p.dim(X(-v.W / 2), yd, X(v.W / 2), yd, `d_m = ${nmS(v.W)}`, { size: 0.18, offset: 0.17 });
          if (v.U * k > 0.03) {
            const yb = yI - Math.max(v.recess * k, 0) - 0.22;
            // d_f is the width at the top of the film (the wall tapers inwards below): witness lines down to the dimension
            for (const sg of [-1, 1]) p.line(X(sg * (v.W / 2 + v.U)), yF - 0.04, X(sg * (v.W / 2 + v.U)), yb - 0.08, { color: C.muted, width: 1, dash: [0.04, 0.05] });
            p.dim(X(-v.W / 2 - v.U), yb, X(v.W / 2 + v.U), yb, `d_f = ${nmS(v.cd)}`, { size: 0.18, offset: -0.2 });
          }
        }
      });
      const sb = w.nice('sb', [100, 200, 500, 1000, 2000], 0.6 / k);
      p.line(sx1 - 0.15 - sb * k, sBot - 0.2, sx1 - 0.15, sBot - 0.2, { color: C.white, width: 3 });
      p.text(nmS(sb), sx1 - 0.25 - sb * k, sBot - 0.2, { size: 0.18, align: 'right', color: C.text });
      p.text('one feature, to scale', sx0, sBot - 0.2, { size: 0.18, color: C.muted });

      // ======================================================== end-point signal: reflected laser intensity
      const tMax = w.smooth('tmax', w.nice('tmax', null, Math.max(1.5 * v.tc, v.t * 1.05, 2)), { log: true });
      const a1 = p.axes({ x: 0.85, y: 0.75, w: 5.85, h: 2.15, xr: [0, tMax], yr: [0, 0.45], grid: true, size: 0.19, nticks: 5,
        yticks: [0, 0.2, 0.4], xlabel: '', ylabel: 'reflectance', ylabelOffset: 0.7 }).draw();
      p.text('etch time (min)', a1.x + a1.w, a1.y - 0.42, { size: 0.19, align: 'right', color: C.muted });
      p.text('laser interferometry: reflected He–Ne signal', a1.x, a1.y + a1.h + 0.2, { size: 0.2, color: C.greyA });
      p.layer('signal', () => {
        const sig = x => DR.reflectance(Math.max(0, v.hf - v.Rv * x));
        a1.plot(sig, { color: C.red, width: 1.5, alpha: 0.3, samples: 500 });                        // what is still to come
        if (v.t > 0) a1.plot(sig, { to: v.t, color: C.red, width: 2.8, samples: Math.max(20, Math.round(500 * v.t / tMax)) });   // recorded so far
        a1.vline(v.tc, { color: C.muted });
      });
      a1.vline(v.t, { color: C.yellow, width: 2, dash: null });
      a1.dot(v.t, v.signal, { r: 0.08 });
      p.layer('signal', () => a1.place(`end point ${minS(v.tc)}`, [0.42, 0.06, 0.25].flatMap(y => [[a1.X(v.tc) + 0.08, a1.Y(y), 'left', 'top'], [a1.X(v.tc) - 0.08, a1.Y(y), 'right', 'top']]),
        { size: 0.18, color: C.muted, key: 'ep' }));

      // ======================================================== depth and undercut vs time
      const yMax = Math.max(v.hf * 1.15, v.hf + v.recess * 1.2, v.U * 1.2, 100);
      const a2 = p.axes({ x: 0.85, y: -2.95, w: 5.85, h: 2.5, xr: [0, tMax], yr: [0, w.smooth('ymax', w.nice('ymax', null, yMax), { log: true })], grid: true, size: 0.19, nticks: 5,
        xlabel: 'etch time (min)', ylabel: 'nm', ylabelOffset: 0.7 }).draw();
      const st = tt => DR.state({ ...v, t: tt });
      a2.hline(v.hf, { color: MAT.sio2.stroke, width: 1.5 });
      a2.plot(tt => { const s = st(tt); return s.depth + s.recess; }, { color: C.yellow, width: 3.5, samples: 200 });
      a2.plot(tt => st(tt).U, { color: C.teal, width: 3, samples: 200 });
      a2.vline(v.t, { color: C.yellow, width: 2, dash: null });
      // legend as one row above the plot (the lines run diagonally – no corner of the plot stays free)
      let lx = a2.x;
      [['depth (film + Si)', C.yellow, null], ['undercut U', C.teal, null], ['film h_f', MAT.sio2.stroke, [0.08, 0.08]]].forEach(([lab, colr, dash]) => {
        const ly = a2.y + a2.h + 0.2;
        p.line(lx, ly, lx + 0.35, ly, { color: colr, width: 3, dash, noOcc: true });
        p.text(lab, lx + 0.45, ly, { size: 0.17, color: colr });
        lx += 0.45 + p.measure(lab.replace(/_/g, ''), 0.17) + 0.35;
      });
    },

    readout: v => MFW.chars([
      ['anisotropy', 'A', fmt.num(v.A, 2), '', { hl: true, f: '1 − R<sub>l</sub>/R<sub>v</sub>' }],
      ['end point', 't<sub>c</sub>', minS(v.tc), undefined, { f: 'h<sub>f</sub>/R<sub>v</sub>' }],
      ['overetch', '', v.over > 0 ? `${fmt.num(v.overPct, 0)} %` : '– (film not cleared yet)', undefined, { note: v.over > 0 ? minS(v.over) : '' }],
      ['undercut per side', 'U', nmS(v.U)],
      ['bias', 'B', nmS(v.B), undefined, { f: 'd<sub>f</sub> − d<sub>m</sub> = 2U' }],
      ['opening in the film', 'd<sub>f</sub>', nmS(v.cd)],
      ['Si recess during overetch', '', nmS(v.recess)],
      ['resist left', '', v.resist > 0 ? nmS(v.resist) : 'none'],
      ['film etched per interference fringe', '', `${fmt.num(v.period, 0)} nm`, undefined, { note: `${minS(v.periodT)} per fringe, ${fmt.num(v.fringes, 1)} fringes in total` }],
      v.maskGone && { warn: 'The resist is used up before the end of the etch – the film under the mask is attacked.' }]),

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Reactive ion etching', caption: 'Ions accelerated through the sheath + reactive radicals', set: { Rv: 100, Rl: 15, t: 0, hf: 1000, W: 2000, Ssi: 15, Sr: 4, hr: 1500 }, duration: 0.5,
        text: 'In a reactive ion etcher the RF-driven electrode under the wafer charges negatively, and a dark <b>sheath</b> forms above it. Positive ions from the plasma are accelerated straight down across the sheath and hit the wafer vertically; neutral <b>radicals</b> (e.g. F, CF<sub>x</sub> from a fluorocarbon gas) arrive from all directions. Ions drive vertical etching, radicals etch chemically in every direction. (How fast radicals alone attack a film depends on the material: SiO₂ in fluorocarbon plasmas hardly etches without ions, Si and polymers do – so the lateral rate here is a free parameter.)' },
      { name: 'Anisotropic etch', caption: 'Only ion-driven etching: vertical walls, B = 0', from: { Rl: 0, t: 0 }, set: { Rl: 0, t: 10 }, show: ['bias'], duration: 3,
        ask: { q: 'Suppose only the ions etch: the lateral rate is zero. After the 1 µm film is etched through, how wide is the opening in the film compared with the opening in the mask?',
          options: ['Wider than the mask opening', 'Exactly as wide', 'Narrower than the mask opening'], correct: 1 },
        text: v => `With no chemical (lateral) component the etch goes straight down: anisotropy A = 1 − R<sub>l</sub>/R<sub>v</sub> = ${fmt.num(v.A, 2)}, vertical walls, and the opening in the film is exactly as wide as in the mask – bias B = d<sub>f</sub> − d<sub>m</sub> = 0.` },
      { name: 'Chemical component', caption: v => `R_l = ${fmt.num(v.Rl, 0)} nm/min: the walls recede – bias ${nmS(v.B)}`, set: { Rl: 0, t: 10 }, duration: 1,
        task: 'Radicals attack the sidewalls too. Raise the <b>lateral etch rate</b> until the opening in the film is 600 nm wider than the mask opening (bias B = 600 nm).',
        goal: v => Math.abs(v.B - 600) <= 40, solution: { Rl: 30 },
        text: v => `With R<sub>l</sub> = ${fmt.num(v.Rl, 0)} nm/min the anisotropy drops to A = ${fmt.num(v.A, 2)}: every side is undercut by U = R<sub>l</sub>·t = ${nmS(v.U)}, so the etched opening is ${nmS(v.B)} wider than the mask opening (B = 2U); a masked line would come out narrower by the same amount. Undercut is the reason why fine features need highly anisotropic etching.` },
      { name: 'Isotropic limit', caption: 'R_l = R_v: complete isotropic etching, B = 2h_f', from: { Rl: 100, t: 0 }, set: { Rl: 100, t: 10 }, duration: 3,
        ask: { q: 'Now the lateral rate equals the vertical one, as in a wet etch. When the 1 µm film is just etched through, how much wider than the mask opening is the opening in the film?',
          options: ['Not wider at all', 'By the film thickness: 1 µm', 'By twice the film thickness: 2 µm'], correct: 2 },
        text: v => `If the lateral rate equals the vertical one (A = 0), the etch is isotropic: at the end point each side is undercut by the film thickness, so B = 2·h<sub>f</sub> = ${nmS(v.B)}. For a ${nmS(v.W)} opening this makes the etched opening ${fmt.sig((v.W + v.B) / v.W, 2)}× as wide as the mask opening.` },
      { name: 'End point: laser interferometry', caption: 'One fringe per λ/2n ≈ 217 nm of oxide removed', set: { Rl: 15, t: 0 }, show: ['signal'], duration: 1,
        task: 'A laser watches the oxide get thinner (upper right). Move the <b>etch time</b> and stop the etch at the end point – the moment the signal stops oscillating.',
        goal: v => v.t >= v.tc && v.t <= v.tc + 0.5, solution: { t: 10.2 },
        text: v => `A He–Ne laser (632.8 nm) shines vertically on an open area. Light reflected from the oxide surface and from the oxide/Si interface interferes, so the signal oscillates as the oxide gets thinner – one full fringe per λ/(2n) = ${fmt.num(v.period, 0)} nm, i.e. every ${minS(v.periodT)} here (${fmt.num(v.fringes, 1)} fringes for ${nmS(v.hf)}). When the oxide is gone the oscillation stops: the <b>end point</b> at ${minS(v.tc)}.` },
      { name: 'Overetch', caption: v => `${fmt.num(v.overPct, 0)} % overetch: Si recess ${nmS(v.recess)}, more undercut`, from: { t: 10 }, set: { t: 13 }, duration: 3,
        ask: { q: 'Film thickness and etch rate vary across a wafer, so the etch runs 30 % past the end point. What happens to the opening in the film during that extra time?',
          options: ['Nothing – the film is already gone there', 'It keeps getting wider', 'It gets narrower again'], correct: 1 },
        text: v => `The radicals keep attacking the sidewalls for as long as the plasma is on: the bias grows to ${nmS(v.B)}. Meanwhile the silicon under the cleared film is etched at R<sub>v</sub>/S = ${fmt.num(v.Rv / v.Ssi, 1)} nm/min (selectivity SiO₂ : Si = ${fmt.num(v.Ssi, 0)}), a recess of ${nmS(v.recess)}. Overetch is needed, but it costs linewidth and substrate.` },
      { name: 'Mask selectivity', caption: 'Dry etching is less selective: the resist must be thick enough', set: { Sr: 1.5, hr: 600, t: 13 }, duration: 1.5,
        task: 'Ions sputter the resist as well. This resist etches almost as fast as the oxide (selectivity 1.5 : 1) and is used up before the etch ends. Open <b>Mask and substrate</b> and make the resist thick enough to survive.',
        goal: v => !v.maskGone, solution: { hr: 1000 },
        text: v => `Plasma etching is much less selective than wet etching. With SiO₂ : resist = ${fmt.num(v.Sr, 1)} : 1 the etch removes R<sub>v</sub>·t/S = ${nmS(v.Rv * v.t / v.Sr)} of resist, so ${nmS(v.hr)} leaves ${nmS(v.resist)}. A thicker resist is harder to pattern finely – one more reason to keep the overetch short. Now switch to <b>Explore</b> and design your own etch.` },
    ],
  });

  // ------------------------------------------------------------ "Run etch" / "Reset" buttons on the stage
  if (widget && widget.stage && typeof document !== 'undefined') widget.stageBar([
    { icon: '▶', label: 'Run etch', title: 'Etch from the start to 30 % overetch', onClick: () => {
      if (widget.mode === 'tour') widget.setMode('explore');
      const v = widget.values;
      widget.set({ t: 0 });
      widget.animate({ t: Math.min(40, 1.3 * v.tc) }, 7, 'linear');
    } },
    { icon: '↺', label: 'Reset', title: 'Back to the start of the etch', onClick: () => { if (widget.mode === 'tour') widget.setMode('explore'); widget.set({ t: 0 }); } },
  ], { right: true });
}());
