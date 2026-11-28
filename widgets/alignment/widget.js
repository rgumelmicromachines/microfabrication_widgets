/* Alignment and overlay on a mask aligner: translation, rotation and run-out, two alignment marks, vernier,
   pad enclosure of a contact window, thermal run-out of the mask. Topic: lithography. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const AL = MFW_ALN;
  const WIN = 6;                                                            // contact window, µm (2λ with λ = 3 µm)
  const VP = 4, VR = 0.5, VN = 5;                                           // vernier: main pitch, resolution (µm), bars to each side
  const sg = (x, d = 2) => (x >= 0 ? '+' : '−') + fmt.num(Math.abs(x), d);
  const umS = (x, d = 2) => `${fmt.num(x, d)} µm`;

  function compute(v) {
    const Mr = AL.runout(v.mat, v.dT), o = { Tx: v.Tx, Ty: v.Ty, th: v.th, M: Mr };
    const mk = AL.marks(o, v.L), mp = AL.map(o, v.e);
    return { M: Mr, o, mk, mp, need: mp.need, yld: mp.yield, worst: mp.worst, maxErr: AL.maxError(o),
      markMax: Math.max(Math.abs(mk.left.dx), Math.abs(mk.left.dy), Math.abs(mk.right.dx), Math.abs(mk.right.dy)),
      rotEdge: Math.abs(v.th) * AL.R_WAFER * 1e-3, runEdge: Math.abs(Mr) * AL.R_WAFER * 1e-3,
      ver: AL.vernier(mk.right.dx, VR, VN), thRead: AL.rotationFromReading(0.5, v.L) };
  }

  MFW.widget('#app', {
    title: 'Alignment and overlay: shift, rotation and run-out',
    alt: v => `Overlay of a mask on a 100 mm wafer: shift (${sg(v.Tx)}, ${sg(v.Ty)}) µm, rotation ${sg(v.th, 0)} µrad, run-out ${sg(v.M, 1)} ppm. Largest error at the wafer edge ${umS(v.maxErr)}. With an enclosure of ${umS(v.e, 1)} the pad covers the contact window on ${v.mp.covered} of ${v.mp.n} dies.`,
    source: 'Standard linear overlay model: translation, small rotation about the wafer centre and a uniform change of scale (run-out); different scales in x and y, skew and higher-order distortion are left out. Thermal run-out M = (α<sub>mask</sub> − α<sub>Si</sub>)·ΔT with the expansion coefficients of fused silica 0.54, borosilicate glass 3.25, soda-lime glass 9.06 (MicroChemicals; SCHOTT technical data, 20–300 °C) and silicon 2.6 × 10⁻⁶ /K (Okada &amp; Tokumaru 1984). The arrows on the wafer map are enlarged by the stated factor. The alignment marks and the vernier are examples drawn to scale in their own frames; the pad and window are to scale.',
    freeText: v => `Explore – shift and rotate the mask, change the temperature and the mask glass. The largest overlay error on the wafer is ${umS(v.maxErr)}; an enclosure of ${umS(v.e, 1)} covers the contact window on ${v.mp.covered} of ${v.mp.n} dies.`,

    params: {
      Tx: { value: 0.8, min: -3, max: 3, step: 0.05, label: 'Mask shift <i>T</i>_x', unit: 'µm', digits: 2 },
      Ty: { value: -0.5, min: -3, max: 3, step: 0.05, label: 'Mask shift <i>T</i>_y', unit: 'µm', digits: 2 },
      th: { value: 0, min: -150, max: 150, step: 1, label: 'Mask rotation θ', unit: 'µrad', digits: 0 },
      mat: { value: 'soda', label: 'Mask substrate', options: Object.fromEntries(Object.entries(AL.MASKS).map(([k, x]) => [k, `${x.name} (${fmt.num(x.alpha, 2)} ppm/K)`])) },
      dT: { value: 0, min: -5, max: 5, step: 0.1, label: 'Temperature change of mask and wafer Δ<i>T</i>', unit: 'K', digits: 1 },
      L: { value: 60, min: 10, max: 90, step: 5, label: 'Distance between the two marks <i>L</i>', unit: 'mm', digits: 0, group: 'Marks and design rule', groupOpen: true },
      e: { value: 3, min: 0, max: 5, step: 0.1, label: 'Enclosure of the window by the pad <i>e</i>', unit: 'µm', digits: 1, group: 'Marks and design rule', groupOpen: true },
    },
    derived: v => compute(v),

    draw(p, v, w) {
      // ======================================================== wafer map with the overlay vectors
      const cx = -4.05, cy = 0.2, RU = 2.7, mm = RU / AL.R_WAFER;                // scene units per mm
      p.text('overlay error at each die', -6.9, 3.6, { size: 0.2, color: C.greyA });
      p.circle(cx, cy, RU, { fill: MAT.si.fill, fillAlpha: 0.35, stroke: MAT.si.stroke, width: 2 });
      const per = w.nice('arr', [0.2, 0.5, 1, 2, 5, 10], Math.max(0.2, v.maxErr));   // µm that one grid pitch stands for
      const s = w.smooth('arrs', 0.46 / per, { log: true });                      // scene units per µm
      for (const d of v.mp.sites) {
        const x = cx + d.x * mm, y = cy + d.y * mm, colr = d.ok ? C.green : C.red;
        p.rect(x - 0.2, y - 0.2, 0.4, 0.4, { fill: colr, fillAlpha: 0.16, stroke: colr, width: 1, noOcc: true });
        if (!d.ok) { p.line(x - 0.2, y - 0.2, x + 0.2, y + 0.2, { color: C.red, width: 1, noOcc: true }); p.line(x - 0.2, y + 0.2, x + 0.2, y - 0.2, { color: C.red, width: 1, noOcc: true }); }
        const ax = d.dx * s, ay = d.dy * s;
        if (Math.hypot(ax, ay) > 0.03) p.arrow(x, y, x + ax, y + ay, { color: C.white, width: 2, head: Math.min(0.11, Math.hypot(ax, ay) * 0.6), noOcc: true });
        else p.circle(x, y, 0.025, { fill: C.white, stroke: null });
      }
      // the two alignment marks
      for (const sx of [-1, 1]) {
        const x = cx + sx * v.L / 2 * mm;
        p.line(x - 0.13, cy, x + 0.13, cy, { color: C.yellow, width: 3, noOcc: true });
        p.line(x, cy - 0.13, x, cy + 0.13, { color: C.yellow, width: 3, noOcc: true });
      }
      // legend below the wafer
      const ly = -3.0;
      p.arrow(-6.9, ly, -6.9 + 0.46, ly, { color: C.white, width: 2, head: 0.11 });
      p.text(`= ${fmt.sig(per, 1)} µm`, -6.36, ly, { size: 0.18, color: C.text });
      p.line(-5.0, ly, -4.76, ly, { color: C.yellow, width: 3 }); p.line(-4.88, ly - 0.12, -4.88, ly + 0.12, { color: C.yellow, width: 3 });
      p.text('alignment mark', -4.68, ly, { size: 0.18, color: C.text });
      p.rect(-6.9, ly - 0.52, 0.24, 0.24, { fill: C.green, fillAlpha: 0.16, stroke: C.green, width: 1, noOcc: true });
      p.text('window covered', -6.58, ly - 0.4, { size: 0.18, color: C.text });
      p.rect(-4.6, ly - 0.52, 0.24, 0.24, { fill: C.red, fillAlpha: 0.16, stroke: C.red, width: 1, noOcc: true });
      p.line(-4.6, ly - 0.52, -4.36, ly - 0.28, { color: C.red, width: 1, noOcc: true }); p.line(-4.6, ly - 0.28, -4.36, ly - 0.52, { color: C.red, width: 1, noOcc: true });
      p.text('not covered', -4.28, ly - 0.4, { size: 0.18, color: C.text });
      p.text('100 mm wafer, die pitch 10 mm; arrows enlarged', -6.9, ly - 0.8, { size: 0.16, color: C.muted });

      // ======================================================== what the operator sees at the two marks (to scale, 12 µm field)
      const view = (x0, title, d, draw) => {
        const y0 = 1.05, S = 2.2;
        p.text(title, x0, y0 + S + 0.2, { size: 0.19, color: C.greyA });
        p.rect(x0, y0, S, S, { fill: C.greyE, stroke: C.axis, width: 1.5, noOcc: true });
        p.clip(x0, y0, x0 + S, y0 + S, () => draw(x0 + S / 2, y0 + S / 2, S));
        p.text(`Δx ${sg(d.dx)}, Δy ${sg(d.dy)} µm`, x0, y0 - 0.2, { size: 0.18, color: C.text });
      };
      const mark = d => (xc, yc, S) => {
        const u = S / 12;                                                    // units per µm
        // wafer layer: frame with a 6 µm opening; mask layer: 4 µm square – 1 µm clearance on every side when aligned
        p.rect(xc - 4.5 * u, yc - 4.5 * u, 9 * u, 9 * u, { fill: MAT.sio2.fill, stroke: MAT.sio2.stroke, width: 1.5, noOcc: true });
        p.rect(xc - 3 * u, yc - 3 * u, 6 * u, 6 * u, { fill: C.greyE, stroke: MAT.sio2.stroke, width: 1.5, noOcc: true });
        p.rect(xc + (d.dx - 2) * u, yc + (d.dy - 2) * u, 4 * u, 4 * u, { fill: MAT.chrome.fill, fillAlpha: 0.85, stroke: MAT.chrome.stroke, width: 1.5, noOcc: true });
      };
      view(-0.75, 'left mark', v.mk.left, mark(v.mk.left));
      view(1.85, 'right mark', v.mk.right, mark(v.mk.right));
      // worst die: aluminium pad on the contact window (to scale, 22 µm field)
      view(4.45, 'pad on window, worst die', v.worst, (xc, yc, S) => {
        const u = S / 22, d = v.worst, h = WIN / 2, ph = WIN / 2 + v.e;
        p.rect(xc - h * u, yc - h * u, WIN * u, WIN * u, { fill: C.red, fillAlpha: 0.55, stroke: C.red, width: 1.5, noOcc: true });
        p.rect(xc + (d.dx - ph) * u, yc + (d.dy - ph) * u, 2 * ph * u, 2 * ph * u, { fill: MAT.metal.fill, stroke: MAT.metal.stroke, width: 1.5, noOcc: true });
        p.rect(xc - h * u, yc - h * u, WIN * u, WIN * u, { stroke: C.white, width: 1.5, dash: [0.05, 0.05], noOcc: true });
      });

      // ======================================================== vernier at the right mark, x direction (to scale)
      const vx0 = -0.75, vw = 7.4, vc = vx0 + vw / 2, u = vw / (2 * VN * VP + 8), yv = -1.45, bh = 0.62, off = v.mk.right.dx;
      p.text(`vernier at the right mark, x direction: main scale ${VP} µm, vernier ${VP - VR} µm`, vx0, 0.15, { size: 0.19, color: C.greyA });
      p.rect(vx0, yv - bh - 0.1, vw, 2 * bh + 0.2, { fill: C.greyE, stroke: C.axis, width: 1.5, noOcc: true });
      p.clip(vx0, yv - bh - 0.1, vx0 + vw, yv + bh + 0.1, () => {
        for (let n = -VN; n <= VN; n++) {
          const hit = v.ver.inRange && n === v.ver.n;
          p.rect(vc + (n * VP - 0.7) * u, yv, 1.4 * u, bh, { fill: hit ? C.yellow : MAT.sio2.stroke, stroke: null, noOcc: true });
          p.rect(vc + (n * (VP - VR) + off - 0.7) * u, yv - bh, 1.4 * u, bh, { fill: hit ? C.yellow : MAT.chrome.fill, stroke: null, noOcc: true });
        }
      });
      p.text('wafer', vx0 - 0.1, yv + bh / 2, { size: 0.17, align: 'right', color: C.muted });
      p.text('mask', vx0 - 0.1, yv - bh / 2, { size: 0.17, align: 'right', color: C.muted });
      for (let n = -VN; n <= VN; n += 1) if (n % 2 === 0) p.text(n === 0 ? '0' : sg(n * VR, 1), vc + n * VP * u, yv + bh + 0.28, { size: 0.16, align: 'center', color: C.muted });
      p.text(v.ver.inRange ? `the pair at ${v.ver.reading === 0 ? '0' : sg(v.ver.reading, 1)} µm lines up (true offset ${sg(off)} µm)` : `off the scale (true offset ${sg(off)} µm): use the coarse marks first`,
        vx0, yv - bh - 0.35, { size: 0.19, color: v.ver.inRange ? C.yellow : C.red });

      // ======================================================== the model
      p.text('Δx = T_x − θ·y + M·x        Δy = T_y + θ·x + M·y', vx0, -2.95, { size: 0.22, color: C.text });
      p.text(`run-out M = (α_{mask} − α_{Si})·ΔT = ${sg(v.M, 1)} ppm`, vx0, -3.35, { size: 0.19, color: C.muted });
    },

    readout: v => MFW.chars([
      ['largest overlay error on the wafer', '|Δ|<sub>max</sub>', umS(v.maxErr), undefined, { hl: true, f: '|T| + R·√(θ² + M²), R = 50 mm' }],
      ['rotation at the wafer edge', '', umS(v.rotEdge), undefined, { f: 'θ·R' }],
      ['run-out', 'M', `${sg(v.M, 1)} ppm`, undefined, { f: '(α<sub>mask</sub> − α<sub>Si</sub>)·ΔT', note: `${umS(v.runEdge)} at the edge` }],
      ['largest residual at the two marks', '', umS(v.markMax)],
      ['rotation hidden by ±0.5 µm at each mark', '', `${fmt.num(v.thRead, 0)} µrad`, undefined, { f: '2·0.5 µm / L', note: `${umS(v.thRead * 0.05)} at the edge` }],
      ['enclosure needed for every die', '', umS(v.need), undefined, { f: 'max(|Δx|, |Δy|) over the dies' }],
      ['windows covered', '', `${v.mp.covered} of ${v.mp.n} dies`, '', { warn: v.yld < 1 }]]),

    // interactive tour: predict (ask) and try (goal) steps – see Widget._goInteractive in assets/mfw.js
    steps: [
      { name: 'Two layers', caption: 'Every die sees the same shift', set: { Tx: 0.8, Ty: -0.5, th: 0, mat: 'soda', dT: 0, L: 60, e: 3 }, duration: 0.5,
        text: v => `A second pattern has to land on the one already on the wafer: here aluminium pads on contact windows. The mask is held a few micrometres off its ideal place, and the arrows show the <b>overlay error</b> at each die. A pure shift of the mask, (${sg(v.Tx)}, ${sg(v.Ty)}) µm here, is the same everywhere. The operator sees it at the two alignment marks (upper right): the mask square is off-centre in the frame on the wafer by the same amount in both.` },
      { name: 'Rotation', caption: v => `θ = ${fmt.num(v.th, 0)} µrad: ${umS(v.rotEdge)} at the wafer edge`, from: { th: 0 }, set: { th: 40 }, duration: 3,
        ask: { q: 'The mask is also rotated by 40 µrad, about two thousandths of a degree, around the wafer centre. Where does that add the most overlay error?',
          options: ['At the wafer centre', 'At the wafer edge', 'The same everywhere'], correct: 1 },
        text: v => `A rotation moves every point by θ times its distance from the centre: nothing at the centre, ${fmt.num(v.th, 0)} µrad × 50 mm = ${umS(v.rotEdge)} at the edge, at right angles to the radius. At the marks it shows as opposite Δy: ${sg(v.mk.left.dy)} µm left and ${sg(v.mk.right.dy)} µm right. One mark alone cannot tell a rotation from a shift, which is why an aligner uses two.` },
      { name: 'Align the mask', caption: v => `Residual at the marks ${umS(v.markMax)}`, set: { Tx: 1.5, Ty: -1, th: 60 }, duration: 1,
        task: 'Now do the operator’s job: use <b>shift x</b>, <b>shift y</b> and <b>rotation</b> until the mask square sits centred in both frames, within 0.25 µm.',
        goal: v => v.markMax <= 0.25, solution: { Tx: 0, Ty: 0, th: 0 },
        text: v => `Both marks are within ${umS(v.markMax)}, and the largest error on the wafer is ${umS(v.maxErr)}. Shift and rotation are the three things the stage of an aligner can correct. The two Δy readings fix the rotation, θ = (Δy<sub>right</sub> − Δy<sub>left</sub>)/L, and the means fix the shift.` },
      { name: 'Marks too close together', caption: v => `L = ${fmt.num(v.L, 0)} mm: ±0.5 µm at the marks hides ${umS(v.thRead * 0.05)} at the edge`, from: { th: 17, L: 60, Tx: 0, Ty: 0 }, set: { th: 100, L: 10, Tx: 0, Ty: 0 }, duration: 3,
        ask: { q: 'A mark can be set to about ±0.5 µm. With the marks 60 mm apart, a rotation of 17 µrad hides inside that tolerance. What if the marks are only 10 mm apart?',
          options: ['The hidden rotation is 6 times smaller', 'The same', 'The hidden rotation is 6 times larger'], correct: 2 },
        text: v => `Both marks still read within ±0.5 µm (${sg(v.mk.left.dy)} and ${sg(v.mk.right.dy)} µm), yet the rotation is 2 × 0.5 µm / ${fmt.num(v.L, 0)} mm = ${fmt.num(v.thRead, 0)} µrad and the dies at the edge are off by ${umS(v.rotEdge)}: ${v.mp.n - v.mp.covered} of ${v.mp.n} windows are no longer covered. Alignment marks belong as far apart as the microscope allows.` },
      { name: 'Run-out', caption: v => `${AL.MASKS[v.mat].name}, ΔT = ${fmt.num(v.dT, 1)} K: run-out ${sg(v.M, 1)} ppm, ${umS(v.runEdge)} at the edge`, set: { Tx: 0, Ty: 0, th: 0, L: 60, dT: 3, mat: 'soda' }, duration: 1.5,
        task: 'The room is 3 K warmer than when the first layer was printed. The soda-lime mask has grown more than the silicon wafer, and the pattern no longer fits: the marks read opposite Δx. No stage setting removes that. Choose a <b>mask substrate</b> that brings the largest error below 0.2 µm.',
        goal: v => v.maxErr < 0.2, solution: { mat: 'boro' },
        text: v => `The scale error is M = (α<sub>mask</sub> − α<sub>Si</sub>)·ΔT = ${sg(v.M, 1)} ppm, which is ${umS(v.runEdge)} at the wafer edge. What counts is the difference to silicon (2.6 ppm/K): borosilicate glass (3.25) nearly matches it, soda-lime glass (9.06) expands far more, and fused silica (0.54) expands less than the wafer, so its run-out has the opposite sign. Try fused silica as well.` },
      { name: 'Enclosure', caption: v => `e = ${umS(v.e, 1)}: ${v.mp.covered} of ${v.mp.n} windows covered`, set: { Tx: 0.6, Ty: 0.4, th: 25, mat: 'soda', dT: 2, e: 0.5 }, duration: 1.5,
        task: 'Some error always remains. The layout absorbs it: the pad is drawn larger than the window by the <b>enclosure</b> on every side. Raise it until every window on the wafer is covered, and not much further, because enclosure costs area.',
        goal: v => v.yld === 1 && v.e <= v.need + 0.4, solution: { e: 2 },
        text: v => `The worst die is off by ${umS(v.need)} in one direction, so an enclosure of ${umS(v.e, 1)} is enough. The lower right view shows that die: the 6 µm window (dashed) is still under the pad. A design rule fixes the enclosure once, for the worst overlay the process is allowed to have. Scalable λ rules, for example, use a contact of 2λ with 1λ of surround.` },
      { name: 'Adding up the contributions', caption: 'Independent errors add as squares', set: { e: 2 }, duration: 0.5,
        ask: { q: 'Three independent sources each contribute a random overlay error: reading the marks 0.5 µm, pattern placement on the mask 0.5 µm, run-out 0.65 µm. What is the combined error?',
          options: ['1.65 µm: they add', '0.96 µm: root sum of squares', '0.65 µm: the largest one'], correct: 1 },
        text: 'Independent random errors rarely all point the same way, so their variances add: √(0.5² + 0.5² + 0.65²) = 0.96 µm. The plain sum of 1.65 µm is the worst case and applies to errors that are systematic and have the same sign, such as the run-out of one mask on one wafer. Now switch to <b>Explore</b> and find the combination your enclosure can still absorb.' },
    ],
  });
}());
