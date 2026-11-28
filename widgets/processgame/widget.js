/* Process game: pattern an aluminium meander resistor – eight stations from the resist bottle to the electrical test.
   The figure is an MFW widget (microscope top view, cross-section, alignment marks, wafer map); the run sheet around
   it is plain DOM. Address ending in #all: every station's controls are shown at once (used by the audits). */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const G = MFW_GAME, DRY = MFW_DRY, O = G.ORDER;
  const SHOW_ALL = typeof location !== 'undefined' && location.hash === '#all';
  const sg = (x, d = 1) => (Math.abs(x) < 0.5 * 10 ** -d ? '0' : (x > 0 ? '+' : '−') + fmt.num(Math.abs(x), d));
  const um = (x, d = 2) => `${fmt.num(x, d)} µm`;
  const ohm = x => (isFinite(x) ? `${fmt.sig(x, 3)} Ω` : '–');
  const at = k => v => SHOW_ALL || v.stage === k;
  const num3 = x => String(+x.toPrecision(3));
  let updateQLabels = null;                                                   // set once the run sheet exists

  const STATIONS = [
    { name: 'Resist and spin coating', done: v => `${G.TDS.resists[v.resist].name}, ${fmt.num(v.rpm, 0)} rpm`,
      text: `The work order asks for ${O.thick[0]}–${O.thick[1]} µm of resist. Open the <a href="${G.TDS.url}" target="_blank" rel="noopener">AZ 1500 data sheet</a>, find the spin curve, and choose a resist and a spin speed that give this thickness.` },
    { name: 'Soft bake', done: v => `${fmt.num(v.sbT, 0)} °C, ${fmt.num(v.sbt, 0)} s on the hotplate`,
      text: 'The film still holds solvent. For contact printing it has to be dry enough not to stick to the mask; a bake that is too hot or too long destroys photoactive compound. The data sheet gives a temperature range.' },
    { name: 'Alignment', done: v => `mask moved by (${sg(v.ax, 2)}, ${sg(v.ay, 2)}) µm, ${sg(v.ath, 0)} µrad`,
      text: `The mask is loaded and sits a few micrometres off. At each of the two marks a dark cross on the mask has to sit in the middle of the cross-shaped channel on the wafer, with the same gap on both sides of every arm. Use the buttons or the sliders. The pads overlap the contact windows by ${O.enclosure} µm. The mask is ${O.dT} K warmer than at the first exposure, so a small opposite Δx at the two marks cannot be removed.` },
    { name: 'Exposure', done: v => `${v.mode === 'prox' ? `proximity, gap ${fmt.num(v.gap, 0)} µm` : 'hard contact'}, ${fmt.num(v.dose, 0)} mJ/cm²`,
      text: `Set the dose; the aligner turns it into an exposure time at ${G.LAMP} mW/cm² (365 nm). The resist line should come out ${O.line} µm wide at the aluminium. The <a href="../development/index.html" target="_blank" rel="noopener">Development lesson</a> uses the same resist model: set your thickness and ${O.line} µm lines there to find the dose before you expose here.` },
    { name: 'Development', done: v => `${MFW_DEV.DEVELOPERS[v.dev].name}, ${fmt.num(v.tdev, 0)} s`,
      text: 'There is aluminium under the resist, and alkaline developers attack aluminium. Choose the developer and the time. After this station the microscope shows the resist pattern.' },
    { name: 'Hard bake', done: v => (v.hbt > 0 ? `${fmt.num(v.hbT, 0)} °C, ${fmt.num(v.hbt, 0)} s` : 'skipped'),
      text: 'A bake after development stabilises the resist for the etch. Too hot, and the resist cross-links so far that a solvent no longer strips it. Set the time to 0 s to skip the bake.' },
    { name: 'Aluminium etch', done: v => `${G.ETCH[v.etT].T} °C, ${fmt.num(v.tet, 1)} s`,
      text: `The etchant (phosphoric, nitric and acetic acid) removes aluminium in all directions at the same rate, so it also etches sideways under the resist. Its rate is in the <a href="${G.ETCH_URL}" target="_blank" rel="noopener">data of the etchant</a> (Type A). The film is ${O.h0} nm thick at the wafer centre and about 5 % thinner at the edge. The mask designer expects ${fmt.num(O.wTarget, 1)} µm of electrical line width after the etch.` },
    { name: 'Strip and test', done: () => 'resist stripped, 69 dies probed',
      text: 'The resist is stripped in a solvent and every die is probed: contact through both pads, then the resistance of the meander against the target.' },
  ];
  const STATE = ['aluminium film, no resist', 'coated with resist', 'soft-baked', 'mask aligned', 'exposed', 'developed', 'hard-baked', 'etched', 'stripped and tested'];
  const CLS = { pass: 'within ±10 %', high: 'resistance too high', low: 'resistance too low', short: 'short circuit', open: 'open circuit', nocontact: 'no contact at the pads' };

  let memoKey = null, memo = null;
  function compute(v) {
    const rc = { resist: v.resist, rpm: v.rpm, sbT: v.sbT, sbt: v.sbt, ax: v.ax, ay: v.ay, ath: v.ath, mode: v.mode, gap: v.gap, dose: v.dose,
      dev: v.dev, tdev: v.tdev, hbT: v.hbT, hbt: v.hbt, etT: v.etT, tet: v.tet };
    const key = JSON.stringify(rc) + [v.ox, v.oy, v.oth].join();
    if (key !== memoKey) { memo = { rc, res: G.run(rc, { ox: v.ox, oy: v.oy, oth: v.oth }) }; memoKey = key; }
    return { ...memo, st: Math.max(0, Math.min(8, Math.round(v.stage))) };
  }
  const interp = (arr, x, h) => { const q = Math.min(arr.length - 1, Math.max(0, x / h)), i = Math.min(arr.length - 2, Math.floor(q)); return arr[i] + (arr[i + 1] - arr[i]) * (q - i); };
  const cdText = L => (L.stick ? 'pattern lost: the resist stuck to the mask' : L.notOpen ? 'spaces not open' : L.gone ? 'lines washed away' : um(L.cd));
  /** What the microscope shows at the wafer centre: is there a resist pattern, are the spaces etched clear, is there a line. */
  function look(res, st) {
    const L = res.L, sec = res.centre.sec, lost = (L.stick && st >= 4) || (L.gone && st >= 5);
    const pattern = st >= 5 && !lost, open = pattern && !L.notOpen;
    const etched = st >= 7, cleared = etched && ((open && !!sec && sec.cleared) || (lost && res.rEtch >= O.h0));
    const line = etched ? (open && sec && sec.cleared ? sec.area > 0 : !lost) : true;
    const resist = st >= 1 && !lost && (st < 8 || res.xlink);
    return { lost, pattern, open, etched, cleared, line, resist, sec };
  }
  const etchText = (res, st) => { const k = look(res, st); return k.lost ? 'no resist mask: the film is etched away' : !k.open ? 'nothing etched: the resist was not open' : !k.cleared ? 'aluminium left between the lines' : !k.line ? 'lines etched away' : 'spaces clear'; };

  const widget = MFW.widget('#app', {
    title: 'Lithography run: aluminium meander resistor',
    alt: v => `Process game, ${v.st} of 8 stations done: ${STATE[v.st]}.${v.st >= 1 ? ` Resist ${um(v.res.L.d)}.` : ''}${v.st >= 5 ? ` Resist line ${cdText(v.res.L)}.` : ''}${v.st >= 7 ? ` After the etch: ${etchText(v.res, v.st)}.` : ''}${v.st >= 8 ? ` Test: ${v.res.count.pass} of ${v.res.n} dies pass, mean resistance ${ohm(v.res.Rmean)}, target ${ohm(G.R_TARGET)}.` : ''}`,
    source: 'Every station uses the model of its lesson: soft bake (residual solvent, decomposition of the photoactive compound), contact and proximity image, exposure and development (Dill; Mack with the rate parameters of AZ 1350J in AZ Developer 1:1 as a stand-in for AZ 1500), linear overlay with thermal run-out, cosine law for the thickness of the evaporated film, isotropic etch front, four-point probe factor π/ln 2. Product data: Merck data sheet of the AZ 1500 series (spin curve read from the graph), MicroChemicals application notes, Transene data of aluminium etchant Type A, Williams et al. 2003. Resistances use the bulk resistivity of aluminium (Desai et al. 1984) and are lower bounds for a thin film. The top view shows a simplified layout with a few turns; its detail, the pad offset and the alignment marks are to scale. The cross-section has an enlarged vertical scale.',
    freeText: v => (v.st < 8 ? `<b>Station ${v.st + 1} of 8: ${STATIONS[v.st].name}</b>` : '<b>The wafer is tested</b>'),

    params: {
      resist: { value: 'az1518', label: 'Resist', options: Object.fromEntries(Object.entries(G.TDS.resists).map(([k, x]) => [k, x.name])), when: at(0) },
      rpm: { value: 2000, min: 1000, max: 4000, step: 50, label: 'Spin speed', unit: 'rpm', digits: 0, when: at(0) },
      sbT: { value: 80, min: 60, max: 140, step: 1, label: 'Hotplate temperature', unit: '°C', digits: 0, when: at(1) },
      sbt: { value: 30, min: 10, max: 300, step: 5, label: 'Bake time', unit: 's', digits: 0, when: at(1) },
      ax: { value: 0, min: -4, max: 4, step: 0.05, label: 'Move mask in x', unit: 'µm', digits: 2, when: at(2) },
      ay: { value: 0, min: -4, max: 4, step: 0.05, label: 'Move mask in y', unit: 'µm', digits: 2, when: at(2) },
      ath: { value: 0, min: -150, max: 150, step: 1, label: 'Rotate mask', unit: 'µrad', digits: 0, when: at(2) },
      mode: { value: 'contact', label: 'Printing mode', options: { contact: 'Hard contact', prox: 'Proximity' }, when: at(3) },
      gap: { value: 20, min: 10, max: 30, step: 1, label: 'Proximity gap', unit: 'µm', digits: 0, when: v => (SHOW_ALL || v.stage === 3) && v.mode === 'prox' },
      dose: { value: 40, min: 10, max: 400, step: 1, label: 'Exposure dose (at 365 nm)', unit: 'mJ/cm²', digits: 0, when: at(3) },
      dev: { value: 'mif', label: 'Developer', options: Object.fromEntries(Object.entries(MFW_DEV.DEVELOPERS).map(([k, x]) => [k, x.name])), when: at(4) },
      tdev: { value: 30, min: 10, max: 180, step: 1, label: 'Development time', unit: 's', digits: 0, when: at(4) },
      hbT: { value: 120, min: 80, max: 160, step: 1, label: 'Hotplate temperature', unit: '°C', digits: 0, when: at(5) },
      hbt: { value: 60, min: 0, max: 300, step: 5, label: 'Bake time', unit: 's', digits: 0, when: at(5) },
      etT: { value: 't25', label: 'Etchant temperature', options: { t25: '25 °C', t40: '40 °C' }, when: at(6) },
      tet: { value: 60, min: 10, max: 300, step: 0.5, label: 'Etch time', unit: 's', digits: 1, when: at(6) },
      stage: { value: 0, min: 0, max: 8, step: 1, hidden: true },
      ox: { value: 1.6, min: -3, max: 3, step: 0.01, hidden: true },
      oy: { value: -2.1, min: -3, max: 3, step: 0.01, hidden: true },
      oth: { value: 70, min: -120, max: 120, step: 1, hidden: true },
    },
    derived: v => compute(v),
    onInput: () => { if (updateQLabels) updateQLabels(); },

    draw(p, v, w) {
      const res = v.res, L = res.L, st = v.st, K = look(res, st), sec = K.sec;
      const cMetal = MAT.metal.fill, cRes = MAT.resist.fill, cOx = MAT.sio2.fill;
      const X0 = -6.9, X1 = -0.55;
      // colours of the top view: what lies in the field (between the lines) and what the lines and pads are made of
      let field, lines = null;
      if (st === 0) field = cMetal;
      else if (st < 5) field = K.lost ? cMetal : cRes;
      else if (K.lost) field = K.cleared ? cOx : cMetal;
      else {
        field = !K.open ? MFW.mix(cRes, cMetal, 0.5) : K.cleared ? cOx : cMetal;
        lines = K.resist ? cRes : K.line ? cMetal : null;
      }
      const lineStroke = lines === cRes ? MAT.resist.stroke : MAT.metal.stroke;

      // ======================================================== microscope: top view of one die (layout simplified)
      const TX0 = X0, TX1 = -2.25, TY0 = 1.0, TY1 = 3.05, cxv = (TX0 + TX1) / 2, cyv = (TY0 + TY1) / 2, upm = 0.36 / 7;
      p.text('microscope, wafer centre: top view of one resistor', X0, 3.62, { size: 0.2, color: C.greyA });
      p.text(`now: ${STATE[st]}`, X0, 3.3, { size: 0.19, color: C.text });
      const dxy = st >= 2 ? [res.centre.dx * upm, res.centre.dy * upm] : [0, 0];
      p.rect(TX0, TY0, TX1 - TX0, TY1 - TY0, { fill: field, stroke: C.axis, width: 1.5, noOcc: true });
      p.clip(TX0, TY0, TX1, TY1, () => {
        {
          const xs = M.linspace(cxv - 1.2, cxv + 1.2, 7), pts = [[cxv - 1.85, cyv], [xs[0], cyv]];
          xs.forEach((x, i) => { const y = cyv + (i % 2 ? -0.72 : 0.72); pts.push([x, y]); if (i < xs.length - 1) pts.push([xs[i + 1], y]); });
          pts.push([xs[6], cyv], [cxv + 1.85, cyv]);
          const sh = pts.map(([x, y]) => [x + dxy[0], y + dxy[1]]);
          // before the pattern is on the wafer: the mask layout as a faint ghost, so the target is visible from the start
          const ghost = !lines && st < 5, colr = lines || C.white, al = ghost ? 0.16 : 1;
          if (lines || ghost) {
            p.path(sh, { color: colr, width: 13, cap: 'butt', alpha: al, noOcc: true });
            for (const sx of [-1, 1]) p.rect(cxv + sx * 1.85 - 0.36 + dxy[0], cyv - 0.36 + dxy[1], 0.72, 0.72, { fill: colr, fillAlpha: al, stroke: ghost ? null : lineStroke, width: 1, noOcc: true });
          }
        }
        for (const sx of [-1, 1]) p.rect(cxv + sx * 1.85 - 5 * upm, cyv - 5 * upm, 10 * upm, 10 * upm, { stroke: C.white, width: 1.5, dash: [0.05, 0.05], noOcc: true });
      });
      p.text(st < 5 ? 'faint: the pattern on the mask, not yet on the wafer · dashed: contact windows' : 'dashed: contact windows under the film · turns reduced, pads to scale', X0, TY0 - 0.2, { size: 0.16, color: C.muted });
      // detail of three lines, to scale (20 µm wide)
      const DX0 = -1.95, DX1 = X1, DY0 = 1.45, DY1 = 3.05, ud = (DX1 - DX0) / 20, dc = (DX0 + DX1) / 2;
      p.rect(DX0, DY0, DX1 - DX0, DY1 - DY0, { fill: field, stroke: C.axis, width: 1.5, noOcc: true });
      let detail = st < 5 ? 'no pattern yet' : K.lost ? 'no resist left' : !K.open && st < 7 ? 'spaces not open' : '';
      if (lines) p.clip(DX0, DY0, DX1, DY1, () => {
        const isRes = lines === cRes, ok = sec && sec.cleared;
        const wOut = isRes ? L.cd : ok ? sec.bottom : 10, wIn = isRes ? L.cd : ok ? sec.top : 10;
        for (const c of [-10, 0, 10]) {
          p.rect(dc + (c - wOut / 2) * ud, DY0, wOut * ud, DY1 - DY0, { fill: isRes ? cRes : MFW.mix(cMetal, cOx, 0.45), stroke: null, noOcc: true });
          if (wIn > 0) p.rect(dc + (c - wIn / 2) * ud, DY0, wIn * ud, DY1 - DY0, { fill: lines, stroke: null, noOcc: true });
        }
        if (!detail) detail = isRes ? `resist ${um(L.cd)}` : ok ? `Al ${fmt.num(sec.top, 2)}–${fmt.num(sec.bottom, 2)} µm` : 'lines shorted';
      });
      if (!detail) detail = 'lines etched away';
      p.text('detail, to scale', DX0, DY0 - 0.2, { size: 0.16, color: C.muted });
      p.text(detail, DX0, DY0 - 0.46, { size: 0.17, color: C.text });

      // ======================================================== cross-section of two lines (vertical scale enlarged)
      const XW = X1 - X0, XC = (X0 + X1) / 2, TOP = 0.15, BOT = -2.75;
      const kx = XW / 20, d = L.d, hAl = O.h0 / 1000, hOx = 0.3;
      const ky = w.smooth('ky', Math.min(3 * kx, (TOP - BOT - 0.85) / (d + hAl + hOx)), { log: true });
      const ySi = BOT + 0.45, yOx = ySi + hOx * ky, yAl = yOx + hAl * ky, yRes = yAl + d * ky;
      const sx = u => XC + u * kx, hx = O.line / (G.NX - 1);
      const fold = u => { const q = ((u + 5) % 10 + 10) % 10; return O.line - Math.abs(q - 5); };   // 0 = space centre, 5 = line centre
      const us = M.linspace(-10, 10, 321);
      const resist = K.resist && st < 8;
      const depthAt = u => (st >= 5 ? interp(L.prof, fold(u), hx) : 0);
      p.text('cross-section of two lines', X0, TOP + 0.2, { size: 0.19, color: C.greyA });
      p.clip(X0, BOT, X1, TOP, () => {
        p.material('si', X0, BOT, X1, ySi, { stroke: null });
        p.material('sio2', X0, ySi, X1, yOx, { stroke: null });
        p.box(X0, yOx, X1, yAl, { fill: cMetal, stroke: null });
        if (st >= 7) {                                                        // what the etch removed
          const rr = res.rEtch, h = O.h0, deep = Math.min(h, rr), open = (10 - L.cd) * 1000;
          if (K.lost) p.box(X0, yAl - deep / 1000 * ky, X1, yAl + 0.02, { fill: C.bg, stroke: null });
          else if (K.open) {
            const e = DRY.state({ hf: h, Rv: 1, Rl: 1, W: open, t: rr, Ssi: 1e9, Sr: 1e9, hr: 1 }).edge;
            const ys = M.linspace(0, deep, 30);
            for (const c of [-15, -5, 5, 15]) {
              const right = ys.map(y => [sx(c + (e(y) ?? open / 2) / 1000), yAl - y / 1000 * ky]);
              const left = right.map(([x, y]) => [2 * sx(c) - x, y]);
              p.polygon([...left, ...right.slice().reverse()], { fill: C.bg, stroke: null, noOcc: true });
            }
          }
        }
        if (resist) {
          p.material('resist', X0, yAl, X1, yRes, { stroke: null });
          if (st >= 4) for (let a = 0; a < us.length - 4; a += 4) {            // latent image (not visible on a real wafer)
            const i = Math.round(fold(us[a + 2]) / hx), du = us[a + 4] - us[a];
            for (let j = 0; j < 12; j++) {
              const e = 1 - L.R.m[Math.round((j + 0.5) * G.NZ / 12) * G.NX + i];
              if (e > 0.03) p.rect(sx(us[a]), yRes - (j + 1) * d / 12 * ky, du * kx * 1.03, d / 12 * ky * 1.03, { fill: C.yellow, fillAlpha: 0.7 * e, stroke: null, noOcc: true });
            }
          }
          if (st >= 5) {
            const gone = [[sx(-10), yRes + 0.02], [sx(10), yRes + 0.02]];
            for (let a = us.length - 1; a >= 0; a--) gone.push([sx(us[a]), yRes - depthAt(us[a]) * ky]);
            p.polygon(gone, { fill: C.bg, stroke: null, noOcc: true });
          }
          // outline of the resist only where resist is left – no line across an open space
          let seg = [];
          const flush = () => { if (seg.length > 1) p.path(seg, { color: MAT.resist.stroke, width: 2, noOcc: true }); seg = []; };
          for (const u of us) { const dd = depthAt(u); if (dd >= d - 1e-6) flush(); else seg.push([sx(u), yRes - dd * ky]); }
          flush();
        }
      });
      let lx = X0;
      [['resist', cRes, MAT.resist.stroke], ['Al', cMetal, MAT.metal.stroke], ['SiO₂', cOx, MAT.sio2.stroke], ['Si', MAT.si.fill, MAT.si.stroke]].forEach(([lab, fill, stroke]) => {
        p.rect(lx, BOT - 0.33, 0.24, 0.16, { fill, stroke, width: 1, noOcc: true });
        p.text(lab, lx + 0.32, BOT - 0.25, { size: 0.17, color: C.text });
        lx += 0.32 + p.measure(lab, 0.17) + 0.3;
      });
      p.line(X1 - 5 * kx, BOT - 0.25, X1, BOT - 0.25, { color: C.white, width: 3 });
      p.text('5 µm', X1 - 5 * kx - 0.1, BOT - 0.25, { size: 0.17, align: 'right', color: C.text });
      p.text(st === 4 ? 'vertical scale enlarged · yellow: exposed resist, invisible on a real wafer' : 'vertical scale enlarged; oxide thickness schematic', X0, BOT - 0.62, { size: 0.16, color: C.muted });

      // ======================================================== alignment marks: mask cross in a cross-shaped channel (to scale)
      const view = (x0, y0, S, title, dd, rd) => {
        const u = S / 14, xc = x0 + S / 2, yc = y0 + S / 2;
        p.text(title, x0, y0 + S + 0.2, { size: 0.18, color: C.greyA });
        p.rect(x0, y0, S, S, { fill: C.greyE, stroke: C.axis, width: 1.5, noOcc: true });
        p.clip(x0, y0, x0 + S, y0 + S, () => {
          for (const qx of [-1, 1]) for (const qy of [-1, 1])                 // wafer layer: four squares leave a 4 µm wide cross
            p.rect(xc + (qx > 0 ? 2 : -6) * u, yc + (qy > 0 ? 2 : -6) * u, 4 * u, 4 * u, { fill: cOx, stroke: MAT.sio2.stroke, width: 1.5, noOcc: true });
          if (st >= 2) {                                                      // mask layer: cross with 2 µm arms – 1 µm gap on each side when aligned
            const mx = xc + dd.dx * u, my = yc + dd.dy * u, o2 = { fill: MAT.chrome.fill, fillAlpha: 0.9, stroke: null, noOcc: true };
            p.rect(mx - 5.5 * u, my - 1 * u, 11 * u, 2 * u, o2);
            p.rect(mx - 1 * u, my - 5.5 * u, 2 * u, 11 * u, o2);
          }
        });
        p.text(st >= 2 ? `vernier: Δx ${sg(rd[0])}, Δy ${sg(rd[1])} µm` : 'mask not loaded', x0, y0 - 0.2, { size: 0.18, color: C.text });
      };
      if (st === 2) {                                                         // the alignment station: marks large, no wafer map
        view(0.25, 0.55, 2.95, 'left alignment mark', res.mk.left, [res.read.lx, res.read.ly]);
        view(3.55, 0.55, 2.95, 'right alignment mark', res.mk.right, [res.read.rx, res.read.ry]);
        p.text('Centre each dark cross in its channel: equal gaps on both sides of every arm.', 0.25, -0.2, { size: 0.19, color: C.text });
        p.text(`The gap is 1 µm when aligned. Verniers read in 0.5 µm steps; the marks are ${O.marksL} mm apart.`, 0.25, -0.55, { size: 0.17, color: C.muted });
        p.text('A difference in Δy between the marks is a rotation; a difference in Δx is run-out and stays.', 0.25, -0.85, { size: 0.17, color: C.muted });
        if (res.read.off) p.text('A mark is off the vernier scale (more than 2.5 µm).', 0.25, -1.2, { size: 0.17, color: C.red });
        return;
      }
      view(0.25, 1.25, 2.0, 'left alignment mark', res.mk.left, [res.read.lx, res.read.ly]);
      view(2.6, 1.25, 2.0, 'right alignment mark', res.mk.right, [res.read.rx, res.read.ry]);
      p.text('mask cross in the', 4.95, 2.95, { size: 0.17, color: C.muted });
      p.text('channel on the wafer;', 4.95, 2.7, { size: 0.17, color: C.muted });
      p.text(`marks ${O.marksL} mm apart`, 4.95, 2.45, { size: 0.17, color: C.muted });
      if (st >= 2 && res.read.off) p.text('off the vernier scale', 4.95, 1.9, { size: 0.17, color: C.red });

      // ======================================================== wafer map of the electrical test
      const cx = 2.1, cy = -1.75, RU = 1.8, mm = RU / 50, hs = 0.15;
      const glyph = (x, y, cls) => {
        const col = { pass: C.green, high: C.gold, low: C.gold, short: C.purple, open: C.red, nocontact: C.grey }[cls] || C.axis;
        p.rect(x - hs, y - hs, 2 * hs, 2 * hs, { fill: cls ? col : null, fillAlpha: cls === 'pass' ? 0.55 : 0.18, stroke: col, width: 1, noOcc: true });
        if (cls === 'high') p.polygon([[x - 0.09, y - 0.06], [x + 0.09, y - 0.06], [x, y + 0.09]], { fill: col, stroke: null, noOcc: true });
        if (cls === 'low') p.polygon([[x - 0.09, y + 0.06], [x + 0.09, y + 0.06], [x, y - 0.09]], { fill: col, stroke: null, noOcc: true });
        if (cls === 'open') { p.line(x - hs, y - hs, x + hs, y + hs, { color: col, width: 1.5, noOcc: true }); p.line(x - hs, y + hs, x + hs, y - hs, { color: col, width: 1.5, noOcc: true }); }
        if (cls === 'short') p.rect(x - 0.07, y - 0.07, 0.14, 0.14, { fill: col, stroke: null, noOcc: true });
        if (cls === 'nocontact') p.circle(x, y, 0.07, { stroke: col, width: 1.5 });
      };
      p.text(st >= 8 ? `electrical test of ${res.n} dies` : `electrical test of ${res.n} dies: after the last station`, 0.25, 0.42, { size: 0.18, color: C.greyA });
      p.circle(cx, cy, RU, { fill: MAT.si.fill, fillAlpha: 0.3, stroke: MAT.si.stroke, width: 2 });
      for (const dd of res.dies) glyph(cx + dd.x * mm, cy + dd.y * mm, st >= 8 ? dd.cls : null);
      Object.keys(CLS).forEach((k, i) => {
        const y = -0.45 - i * 0.4;
        glyph(4.5, y, k);
        p.text(`${CLS[k]}${st >= 8 ? `: ${res.count[k]}` : ''}`, 4.78, y, { size: 0.17, color: C.text });
      });
      p.text(st >= 8 ? `mean ${ohm(res.Rmean)}, target ${ohm(G.R_TARGET)}` : `target ${ohm(G.R_TARGET)}`, 4.35, -3.0, { size: 0.18, color: C.text });
    },

    readout: v => {
      const r = v.res, L = r.L, st = v.st;
      return MFW.chars([
        ['target resistance', 'R', ohm(G.R_TARGET), undefined, { f: 'ρ·L/(w·h), bulk ρ: lower bound', note: 'test limit ±10 %' }],
        st >= 1 && ['resist thickness', 'd', um(L.d), undefined, { note: `order: ${O.thick[0]}–${O.thick[1]} µm`, warn: L.d < O.thick[0] - 1e-9 || L.d > O.thick[1] + 1e-9 }],
        st >= 4 && ['exposure', 'E', `${fmt.num(L.E, 0)} mJ/cm²`, undefined, { note: `${fmt.num(L.tExp, 1)} s at ${G.LAMP} mW/cm²` }],
        st >= 5 && ['microscope after development: resist line', '', cdText(L), undefined, { note: `mask ${O.line} µm`, warn: L.stick || L.notOpen || L.gone }],
        st >= 7 && ['microscope after the etch', '', etchText(r, st), '', { warn: etchText(r, st) !== 'spaces clear' }],
        st >= 7 && ['etch time against the time to clear the centre', '', `${fmt.num(v.tet, 1)} s / ${fmt.num(r.tc0, 1)} s`],
        st >= 8 && ['sheet resistance, four-point probe', 'R<sub>s</sub>', `${fmt.num(r.Rs * 1000, 1)} mΩ/□`, undefined, { f: `(π/ln 2)·V/I, V/I = ${fmt.num(r.VI * 1000, 2)} mΩ` }],
        st >= 8 && ['mean resistance of the contacted dies', '', ohm(r.Rmean), undefined, { hl: true, note: isFinite(r.dev) ? `mean deviation ${fmt.num(100 * r.dev, 1)} %` : '' }],
        st >= 8 && ['dies within the limit', '', `${r.count.pass} of ${r.n}`, '', { warn: r.count.pass < r.n }],
        st < 1 && { text: 'Measured values appear here as the wafer moves through the stations.' }]);
    },
  });
  if (!widget || typeof document === 'undefined') return;

  // ================================================================ run sheet (DOM around the engine's controls)
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  const panel = widget.panel, pbox = widget.paramBox;
  const strip = el('ol', 'pg-strip'); panel.insertBefore(strip, widget.explainEl);
  strip.setAttribute('aria-label', 'Stations');
  STATIONS.forEach((s, i) => { const li = el('li', null, strip, `<span>${i + 1}</span>`); li.title = s.name; });
  const textBox = el('p', 'pg-text'); widget.explainEl.after(textBox);
  // values from the documents
  const qSec = el('section', 'pg-box'); panel.insertBefore(qSec, pbox);
  el('h4', null, qSec, 'Look up in the documents');
  el('p', 'mfw-need', qSec, '<b>Your input</b><span>20 points for all nine values of the run</span>');
  el('p', 'pg-hint', qSec, 'Type the value you find. It is checked when you run the station; the first answer counts. A field may stay empty.');
  const qBox = el('div', 'pg-qs', qSec);
  // tool settings (the engine's sliders live here)
  const setSec = el('section', 'pg-box'); panel.insertBefore(setSec, pbox);
  el('h4', null, setSec, 'Set the tool');
  el('p', 'mfw-need', setSec, '<b>Your input</b><span>decides resistance (35 points) and yield (30)</span>');
  const nudge = el('div', 'pg-nudge', setSec);
  setSec.appendChild(pbox);
  const nrow = (label, key, steps, unit, digits) => {
    const r = el('div', 'pg-nrow', nudge); el('span', null, r, label);
    steps.forEach(d => {
      const b = el('button', null, r, `${d > 0 ? '+' : '−'}${Math.abs(d)}`); b.type = 'button';
      b.setAttribute('aria-label', `${label} ${d > 0 ? 'plus' : 'minus'} ${Math.abs(d)} ${unit}`);
      b.addEventListener('click', () => { const pd = widget.cfg.params[key]; widget.set({ [key]: +Math.min(pd.max, Math.max(pd.min, widget.P[key] + d)).toFixed(digits) }); });
    });
    el('span', 'pg-nunit', r, unit);
  };
  nrow('x', 'ax', [-0.5, -0.1, 0.1, 0.5], 'µm', 2); nrow('y', 'ay', [-0.5, -0.1, 0.1, 0.5], 'µm', 2); nrow('rotation', 'ath', [-10, -2, 2, 10], 'µrad', 0);
  // run
  const actions = el('div', 'pg-actions'); setSec.after(actions);
  const runBtn = el('button', 'pg-run', actions); runBtn.type = 'button';
  const againBtn = el('button', 'pg-again', actions); againBtn.type = 'button';
  const msg = el('p', 'pg-msg', null); msg.setAttribute('aria-live', 'polite'); actions.after(msg);
  const ptsBox = el('p', 'pg-points'); msg.after(ptsBox);
  const logBox = el('div', 'pg-log'); msg.after(logBox);
  el('h3', 'mfw-chars-h', logBox, 'Run sheet');
  const logList = el('ol', null, logBox);
  const report = document.getElementById('report');

  const state = { graded: {}, reworks: 0, scraps: 0, wafers: 1, log: [] };
  const allQ = () => G.questions(widget.values.rc);
  function renderQs() {
    const st = widget.values.st;
    qBox.innerHTML = '';
    for (const q of allQ().filter(x => (SHOW_ALL ? true : x.station === st))) {
      const g = state.graded[q.id], row = el('label', 'pg-q' + (g ? (g.ok ? ' is-right' : ' is-wrong') : ''), qBox);
      el('span', 'pg-q-t', row, g ? g.text : q.text).dataset.qt = q.id;
      const box = el('span', 'pg-q-in', row), inp = el('input', null, box);
      inp.type = 'number'; inp.step = 'any'; inp.placeholder = '?'; inp.inputMode = 'decimal'; inp.dataset.q = q.id; inp.setAttribute('aria-label', `${q.text} (${q.unit})`);
      el('span', 'pg-q-u', box, q.unit);
      if (g) { inp.value = g.given === undefined ? '' : g.given; inp.disabled = true; el('span', 'pg-q-v', row, g.ok ? '✓ matches the document' : `✗ the document gives ${num3(g.want)} ${q.unit}`); }
    }
    qSec.hidden = !qBox.children.length;
  }
  /** The questions about the chosen resist and etchant name the current choice: keep their wording up to date. */
  updateQLabels = () => {
    for (const q of allQ()) { const e = qBox.querySelector(`[data-qt="${q.id}"]`); if (e && !state.graded[q.id] && e.textContent !== q.text) e.textContent = q.text; }
  };
  function gradeStation(st) {
    for (const q of allQ().filter(x => x.station === st)) {
      if (state.graded[q.id]) continue;                                       // the first answer counts
      const inp = qBox.querySelector(`[data-q="${q.id}"]`), raw = inp ? inp.value.trim().replace(',', '.') : '';
      const given = raw === '' ? undefined : parseFloat(raw);
      state.graded[q.id] = { ...q, given, ok: G.grade({ [q.id]: given }, widget.values.rc).find(x => x.id === q.id).ok };
    }
  }
  const grades = () => allQ().map(q => state.graded[q.id] || { ...q, ok: false, given: undefined });
  function renderLog() {
    logList.innerHTML = '';
    state.log.forEach(t => el('li', null, logList, t));
    logBox.hidden = !state.log.length;
  }
  function sync() {
    const v = widget.values, st = v.st;
    [...strip.children].forEach((li, i) => { li.className = i < st ? 'is-done' : i === st ? 'is-now' : ''; if (i === st) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    runBtn.textContent = st < 8 ? (st === 7 ? 'Strip the resist and test' : `Run station ${st + 1}: ${STATIONS[st].name.toLowerCase()}`) : 'Tested';
    runBtn.disabled = st >= 8;
    againBtn.hidden = st === 0;
    againBtn.textContent = st >= 7 ? 'Start a new wafer (−10 points)' : 'Strip and recoat (−5 points)';
    setSec.hidden = st >= 7 && !SHOW_ALL;
    nudge.hidden = !(st === 2 || SHOW_ALL);
    textBox.innerHTML = st < 8 ? STATIONS[st].text : 'The map shows every die, and the report with your score is below the figure. If the result is off, decide which station caused it and run another wafer.';
    renderQs(); renderLog();
    const done = Object.values(state.graded), right = done.filter(g => g.ok).length, eco = Math.max(0, 15 - 5 * state.reworks - 10 * state.scraps);
    ptsBox.innerHTML = `<b>Points so far</b> documents: ${right} of ${done.length} checked values right (${fmt.num(20 * right / 9, 0)} of 20) · economy: ${eco} of 15 · resistance (35) and yield (30) are decided at the test`;
    ptsBox.hidden = st >= 8;
    if (st >= 8) renderReport(); else if (report) report.hidden = true;
  }
  runBtn.addEventListener('click', () => {
    const v = widget.values, st = v.st;
    if (st >= 8) return;
    gradeStation(st);
    state.log.push(`<b>${STATIONS[st].name}:</b> ${STATIONS[st].done(v)}`);
    widget.set({ stage: st + 1 });
    const after = widget.values, L = after.res.L, rd = after.res.read;
    if (st === 7) {                                                           // tested: the run counts for the reader's progress
      const gr = grades(), sc = G.score(after.res, gr, state.reworks, state.scraps);
      MFW.progress.emit({ type: 'game', score: sc.total, reworks: state.reworks, scraps: state.scraps, docs: gr.every(g => g.ok) });
    }
    msg.textContent = [
      `Coated: ${um(L.d)} of resist. The order asks for ${O.thick[0]}–${O.thick[1]} µm.`,
      'Baked. There is nothing to see on the wafer; whether the bake was right shows later.',
      `Mask clamped. Verniers: left Δx ${sg(rd.lx)}, Δy ${sg(rd.ly)} µm; right Δx ${sg(rd.rx)}, Δy ${sg(rd.ry)} µm.`,
      `Exposed with ${fmt.num(L.E, 0)} mJ/cm² (${fmt.num(L.tExp, 1)} s). The latent image is invisible on a real wafer; the cross-section shows it in yellow.`,
      `Developed. Microscope: ${L.stick || L.notOpen || L.gone ? cdText(L) : `resist lines ${um(L.cd)} wide, spaces open`}.`,
      after.rc.hbt > 0 ? 'Hard-baked.' : 'Hard bake skipped.',
      `Etched. Microscope: ${etchText(after.res, 7)}.`,
      ''][st];
    sync();
  });
  againBtn.addEventListener('click', () => {
    const st = widget.values.st;
    if (st >= 7) { state.scraps++; state.log.push('<b>New wafer</b> (−10 points)'); } else { state.reworks++; state.log.push('<b>Stripped and recoated</b> (−5 points)'); }
    state.wafers++;
    const wf = G.newWafer(Math.random(), Math.random(), Math.random());
    widget.set({ stage: 0, ox: wf.ox, oy: wf.oy, oth: wf.oth, ax: 0, ay: 0, ath: 0 });
    msg.textContent = 'Your settings are kept. Change what you think went wrong and run the stations again. The mask has to be aligned anew.';
    sync();
  });

  function renderReport() {
    if (!report) return;
    const v = widget.values, r = v.res, gr = grades(), sc = G.score(r, gr, state.reworks, state.scraps), rc = v.rc;
    const row = (a, b, c = '') => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`;
    const name = (report.querySelector('#pg-name') || {}).value || '';
    report.hidden = false;
    report.innerHTML = `<h2>Run report: aluminium meander resistor</h2>
      <p class="pg-noprint"><label>Name (stays in this browser; printed on the report) <input id="pg-name" type="text" autocomplete="name" value="${name.replace(/"/g, '&quot;')}"></label></p>
      <p class="pg-printname"></p>
      <p><b class="pg-total">Score: ${sc.total} of 100</b> &nbsp; resistance ${fmt.num(sc.acc, 0)}/35 · yield ${fmt.num(sc.yld, 0)}/30 · documents ${fmt.num(sc.doc, 0)}/20 · economy ${fmt.num(sc.eco, 0)}/15</p>
      <table><tr><th>Result</th><th>Value</th><th>Note</th></tr>
        ${row('Mean resistance of the contacted dies', ohm(r.Rmean), `target ${ohm(G.R_TARGET)}, limit ±10 %`)}
        ${row('Mean deviation from the target', isFinite(r.dev) ? `${fmt.num(100 * r.dev, 1)} %` : '–', 'full marks up to 2 %, none from 20 %')}
        ${row('Dies within the limit', `${r.count.pass} of ${r.n}`, Object.keys(CLS).filter(k => k !== 'pass' && r.count[k]).map(k => `${CLS[k]}: ${r.count[k]}`).join('; ') || 'no failures')}
        ${row('Wafers used', String(state.wafers), `${state.reworks} strip and recoat, ${state.scraps} new wafer after the etch`)}
      </table>
      <table><tr><th>Station</th><th>Setting</th><th>Outcome</th></tr>
        ${row('Resist and spin coating', STATIONS[0].done(v), `${um(r.L.d)}; order ${O.thick[0]}–${O.thick[1]} µm`)}
        ${row('Soft bake', STATIONS[1].done(v), `${fmt.num(r.L.w, 1)} wt% solvent left${r.L.stick ? ' – stuck to the mask' : ''}; ${fmt.num(100 * (1 - r.L.pac), 1)} % of the PAC decomposed`)}
        ${row('Alignment', STATIONS[2].done(v), `largest error at a die ${um(r.need)}; pads allow ${um(O.enclosure, 1)}`)}
        ${row('Exposure', STATIONS[3].done(v), `${fmt.num(r.L.tExp, 1)} s at ${G.LAMP} mW/cm², 365 nm`)}
        ${row('Development', STATIONS[4].done(v), `resist line ${cdText(r.L)}; ${fmt.num(r.L.alLoss, 0)} nm of aluminium attacked in the spaces`)}
        ${row('Hard bake', STATIONS[5].done(v), r.xlink ? 'resist cross-linked: not stripped by the solvent' : rc.hbt > 0 ? 'resist strips in solvent' : 'no bake')}
        ${row('Aluminium etch', STATIONS[6].done(v), `${fmt.num(r.rate, 0)} nm/min; ${fmt.num(100 * r.over, 0)} % ${r.over >= 0 ? 'over' : 'under'} the time to clear the centre${r.centre.sec && r.centre.sec.cleared ? `; electrical line width ${um(r.centre.sec.wEff)}` : ''}`)}
      </table>
      <table><tr><th>Value from the documents</th><th>Your answer</th><th>Document</th></tr>
        ${gr.map(g => row(g.text, g.given === undefined ? '–' : `${g.given} ${g.unit}`, `${g.ok ? '✓' : '✗'} ${num3(g.want)} ${g.unit}`)).join('')}
      </table>
      <p class="note">Development uses rate parameters of AZ 1350J as a stand-in for AZ 1500; resistances use the bulk resistivity of aluminium and are lower bounds. ${new Date().toISOString().slice(0, 10)}</p>
      <p class="pg-noprint"><button type="button" id="pg-print">Print or save as PDF</button> <button type="button" id="pg-save">Download as text</button></p>`;
    const nameEl = report.querySelector('#pg-name'), printName = report.querySelector('.pg-printname');
    const setName = () => { printName.textContent = nameEl.value ? `Name: ${nameEl.value}` : ''; };
    nameEl.addEventListener('input', setName); setName();
    report.querySelector('#pg-print').addEventListener('click', () => window.print());
    report.querySelector('#pg-save').addEventListener('click', () => {
      const lines = [];
      report.querySelectorAll('h2, .pg-printname, .pg-total, tr, .note').forEach(e => {
        const t = e.tagName === 'TR' ? [...e.children].map(c => c.textContent.trim()).join(' | ') : e.tagName === 'B' ? e.parentNode.textContent.trim() : e.textContent.trim();
        if (t) lines.push(t);
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' }));
      a.download = 'process-game-report.txt'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
  sync();
  window.MFW_GAME_UI = { state, sync, grades };
}());
