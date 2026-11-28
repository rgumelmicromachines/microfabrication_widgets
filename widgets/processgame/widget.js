/* Process game: pattern an aluminium meander resistor – eight stations from the resist bottle to the electrical test.
   The figure is an MFW widget (cross-section, alignment marks, wafer map); the run sheet around it is plain DOM.
   Address ending in #all: every station's controls are shown at once (used by the audits). */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const G = MFW_GAME, DRY = MFW_DRY, O = G.ORDER;
  const SHOW_ALL = typeof location !== 'undefined' && location.hash === '#all';
  const sg = (x, d = 1) => (Math.abs(x) < 0.5 * 10 ** -d ? '0' : (x > 0 ? '+' : '−') + fmt.num(Math.abs(x), d));
  const um = (x, d = 2) => `${fmt.num(x, d)} µm`;
  const ohm = x => (isFinite(x) ? `${fmt.sig(x, 3)} Ω` : '–');
  const at = k => v => SHOW_ALL || v.stage === k;
  const num3 = x => String(+x.toPrecision(3));

  const STATIONS = [
    { name: 'Resist and spin coating', done: v => `${G.TDS.resists[v.resist].name}, ${fmt.num(v.rpm, 0)} rpm`,
      text: `Open the <a href="${G.TDS.url}" target="_blank" rel="noopener">AZ 1500 data sheet</a> and find the spin curve. The work order asks for ${O.thick[0]}–${O.thick[1]} µm of resist. Choose a resist and a spin speed that give it, and enter the thickness you read from the curve.` },
    { name: 'Soft bake', done: v => `${fmt.num(v.sbT, 0)} °C, ${fmt.num(v.sbt, 0)} s on the hotplate`,
      text: 'The film still holds solvent. For contact printing it has to be dry enough not to stick to the mask; a bake that is too hot or too long destroys photoactive compound. Take the temperature range from the data sheet, then set the hotplate.' },
    { name: 'Alignment', done: v => `stage moved by (${sg(v.ax, 2)}, ${sg(v.ay, 2)}) µm, ${sg(v.ath, 0)} µrad`,
      text: `The mask is loaded and sits a few micrometres off. Move it in x and y and rotate it until the mask square is centred in both frames; the verniers read in 0.5 µm steps. The pads overlap the contact windows by ${O.enclosure} µm. The soda-lime mask is ${O.dT} K warmer than at the first exposure, so a small opposite Δx at the two marks cannot be removed.` },
    { name: 'Exposure', done: v => `${v.mode === 'prox' ? `proximity, gap ${fmt.num(v.gap, 0)} µm` : 'hard contact'}, ${fmt.num(v.texp, 1)} s`,
      text: `The lamp delivers ${G.LAMP} mW/cm² at 365 nm; the dose is intensity × time. The resist line should come out ${O.line} µm wide at the aluminium. The <a href="../development/index.html" target="_blank" rel="noopener">Development lesson</a> uses the same resist model: set your thickness and ${O.line} µm lines there and find the dose before you expose here.` },
    { name: 'Development', done: v => `${MFW_DEV.DEVELOPERS[v.dev].name}, ${fmt.num(v.tdev, 0)} s`,
      text: 'There is aluminium under the resist, and alkaline developers attack aluminium. Choose the developer and the time. The data sheet states a development time.' },
    { name: 'Hard bake', done: v => (v.hbt > 0 ? `${fmt.num(v.hbT, 0)} °C, ${fmt.num(v.hbt, 0)} s` : 'skipped'),
      text: 'A bake after development stabilises the resist for the etch. Too hot, and the resist cross-links so far that a solvent no longer strips it. Set the time to 0 s to skip the bake.' },
    { name: 'Aluminium etch', done: v => `${G.ETCH[v.etT].T} °C, ${fmt.num(v.tet, 1)} s`,
      text: `The etchant (phosphoric, nitric and acetic acid) removes aluminium in all directions at the same rate, so it also etches sideways under the resist. Look up the etch rate in the <a href="${G.ETCH_URL}" target="_blank" rel="noopener">data of the etchant</a> (Type A). The film is ${O.h0} nm thick at the wafer centre and about 5 % thinner at the edge. The mask designer expects ${fmt.num(O.wTarget, 1)} µm of electrical line width after the etch.` },
    { name: 'Strip and test', done: () => 'resist stripped, 69 dies probed',
      text: 'The resist is stripped in a solvent and every die is probed: contact through both pads, then the resistance of the meander against the target.' },
  ];
  const STATE = ['aluminium film, no resist', 'coated', 'soft-baked', 'mask aligned', 'exposed (latent image shown)', 'developed', 'hard-baked', 'etched', 'stripped and tested'];
  const CLS = { pass: 'within ±10 %', high: 'resistance too high', low: 'resistance too low', short: 'short circuit', open: 'open circuit', nocontact: 'no contact at the pads' };

  let memoKey = null, memo = null;
  function compute(v) {
    const rc = { resist: v.resist, rpm: v.rpm, sbT: v.sbT, sbt: v.sbt, ax: v.ax, ay: v.ay, ath: v.ath, mode: v.mode, gap: v.gap, texp: v.texp,
      dev: v.dev, tdev: v.tdev, hbT: v.hbT, hbt: v.hbt, etT: v.etT, tet: v.tet };
    const key = JSON.stringify(rc) + [v.ox, v.oy, v.oth].join();
    if (key !== memoKey) { memo = { rc, res: G.run(rc, { ox: v.ox, oy: v.oy, oth: v.oth }) }; memoKey = key; }
    return { ...memo, st: Math.max(0, Math.min(8, Math.round(v.stage))) };
  }
  const interp = (arr, x, h) => { const q = Math.min(arr.length - 1, Math.max(0, x / h)), i = Math.min(arr.length - 2, Math.floor(q)); return arr[i] + (arr[i + 1] - arr[i]) * (q - i); };
  const cdText = L => (L.stick ? 'pattern lost: the resist stuck to the mask' : L.notOpen ? 'spaces not open' : L.gone ? 'lines washed away' : um(L.cd));

  const widget = MFW.widget('#app', {
    title: 'Lithography run: aluminium meander resistor',
    alt: v => `Process game, ${v.st} of 8 stations done: ${STATE[v.st]}.${v.st >= 1 ? ` Resist ${um(v.res.L.d)}.` : ''}${v.st >= 5 ? ` Resist line ${cdText(v.res.L)}.` : ''}${v.st >= 8 ? ` Test: ${v.res.count.pass} of ${v.res.n} dies pass, mean resistance ${ohm(v.res.Rmean)}, target ${ohm(G.R_TARGET)}.` : ''}`,
    source: 'Every station uses the model of its lesson: soft bake (residual solvent, decomposition of the photoactive compound), contact and proximity image, exposure and development (Dill; Mack with the rate parameters of AZ 1350J in AZ Developer 1:1 as a stand-in for AZ 1500), linear overlay with thermal run-out, cosine law for the thickness of the evaporated film, isotropic etch front, four-point probe factor π/ln 2. Product data: Merck data sheet of the AZ 1500 series (spin curve read from the graph), MicroChemicals application notes, Transene data of aluminium etchant Type A, Williams et al. 2003. Resistances use the bulk resistivity of aluminium (Desai et al. 1984) and are lower bounds for a thin film. The cross-section is drawn with an enlarged vertical scale; the alignment marks are to scale in their frames.',
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
      texp: { value: 5, min: 1, max: 60, step: 0.5, label: 'Exposure time', unit: 's', digits: 1, when: at(3) },
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

    draw(p, v, w) {
      const res = v.res, L = res.L, st = v.st;
      // ======================================================== cross-section of two lines (vertical scale enlarged)
      const X0 = -6.9, X1 = -0.55, XW = X1 - X0, XC = (X0 + X1) / 2, TOP = 3.05, BOT = -2.75;
      const kx = XW / 20, d = L.d, hAl = O.h0 / 1000, hOx = 0.3;
      const ky = w.smooth('ky', Math.min(3 * kx, (TOP - BOT - 1.0) / (d + hAl + hOx)), { log: true });
      const ySi = BOT + 0.55, yOx = ySi + hOx * ky, yAl = yOx + hAl * ky, yRes = yAl + d * ky;
      const sx = u => XC + u * kx, hx = O.line / (G.NX - 1);
      const fold = u => { const q = ((u + 5) % 10 + 10) % 10; return O.line - Math.abs(q - 5); };   // 0 = space centre, 5 = line centre
      const us = M.linspace(-10, 10, 321);
      const lost = L.stick && st >= 4;                                        // the resist came off with the mask
      const resist = st >= 1 && st < 8 && !lost;
      const depthAt = u => (st >= 5 ? interp(L.prof, fold(u), hx) : 0);
      p.text('cross-section of two meander lines, wafer centre', X0, 3.62, { size: 0.2, color: C.greyA });
      p.text(`now: ${STATE[st]}`, X0, 3.3, { size: 0.19, color: C.text });
      p.clip(X0, BOT, X1, TOP, () => {
        p.material('si', X0, BOT, X1, ySi, { stroke: null });
        p.material('sio2', X0, ySi, X1, yOx, { stroke: null });
        p.box(X0, yOx, X1, yAl, { fill: MAT.metal.fill, stroke: null });
        if (st >= 7) {                                                        // what the etch removed
          const rr = res.rEtch, h = O.h0, deep = Math.min(h, rr), open = (10 - L.cd) * 1000;
          if (lost || L.gone) p.box(X0, yAl - deep / 1000 * ky, X1, yAl + 0.02, { fill: C.bg, stroke: null });
          else if (!L.notOpen) {
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
          if (st >= 4) for (let a = 0; a < us.length - 4; a += 4) {            // latent image
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
          p.path(us.map(u => [sx(u), yRes - Math.min(depthAt(u), d) * ky]), { color: MAT.resist.stroke, width: 2, noOcc: true });
        }
      });
      if (lost && st < 8) p.text('the resist stuck to the mask and came off with it', XC, yAl + 0.45, { size: 0.19, align: 'center', color: C.red });
      let lx = X0;
      [['resist', MAT.resist.fill, MAT.resist.stroke], ['Al', MAT.metal.fill, MAT.metal.stroke], ['SiO₂', MAT.sio2.fill, MAT.sio2.stroke], ['Si', MAT.si.fill, MAT.si.stroke]].forEach(([lab, fill, stroke]) => {
        p.rect(lx, BOT - 0.33, 0.24, 0.16, { fill, stroke, width: 1, noOcc: true });
        p.text(lab, lx + 0.32, BOT - 0.25, { size: 0.17, color: C.text });
        lx += 0.32 + p.measure(lab, 0.17) + 0.3;
      });
      p.line(X1 - 5 * kx, BOT - 0.25, X1, BOT - 0.25, { color: C.white, width: 3 });
      p.text('5 µm', X1 - 5 * kx - 0.1, BOT - 0.25, { size: 0.17, align: 'right', color: C.text });
      p.text('vertical scale enlarged; oxide thickness schematic', X0, BOT - 0.62, { size: 0.16, color: C.muted });

      // ======================================================== the two alignment marks (to scale, 12 µm field)
      const view = (x0, title, dd, rd) => {
        const y0 = 1.25, S = 2.0, u = S / 12, xc = x0 + S / 2, yc = y0 + S / 2;
        p.text(title, x0, y0 + S + 0.2, { size: 0.18, color: C.greyA });
        p.rect(x0, y0, S, S, { fill: C.greyE, stroke: C.axis, width: 1.5, noOcc: true });
        p.clip(x0, y0, x0 + S, y0 + S, () => {
          p.rect(xc - 4.5 * u, yc - 4.5 * u, 9 * u, 9 * u, { fill: MAT.sio2.fill, stroke: MAT.sio2.stroke, width: 1.5, noOcc: true });
          p.rect(xc - 3 * u, yc - 3 * u, 6 * u, 6 * u, { fill: C.greyE, stroke: MAT.sio2.stroke, width: 1.5, noOcc: true });
          if (st >= 2) p.rect(xc + (dd.dx - 2) * u, yc + (dd.dy - 2) * u, 4 * u, 4 * u, { fill: MAT.chrome.fill, fillAlpha: 0.85, stroke: MAT.chrome.stroke, width: 1.5, noOcc: true });
        });
        p.text(st >= 2 ? `Δx ${sg(rd[0])}, Δy ${sg(rd[1])} µm` : 'mask not loaded', x0, y0 - 0.2, { size: 0.18, color: C.text });
      };
      view(0.25, 'left alignment mark', res.mk.left, [res.read.lx, res.read.ly]);
      view(2.6, 'right alignment mark', res.mk.right, [res.read.rx, res.read.ry]);
      p.text('vernier readings', 4.95, 2.95, { size: 0.17, color: C.muted });
      p.text('in 0.5 µm steps;', 4.95, 2.7, { size: 0.17, color: C.muted });
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
        st >= 4 && ['exposure dose', 'E', `${fmt.sig(L.E, 3)} mJ/cm²`, undefined, { f: `${G.LAMP} mW/cm² · t` }],
        st >= 5 && ['resist line at the aluminium (inspection)', '', cdText(L), undefined, { note: `mask ${O.line} µm`, warn: L.stick || L.notOpen || L.gone }],
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
  const textBox = el('p', 'pg-text'); widget.explainEl.after(textBox);
  const qBox = el('div', 'pg-qs'); panel.insertBefore(qBox, pbox);
  const actions = el('div', 'pg-actions'); pbox.after(actions);
  const runBtn = el('button', 'pg-run', actions); runBtn.type = 'button';
  const againBtn = el('button', 'pg-again', actions); againBtn.type = 'button';
  const msg = el('p', 'pg-msg', null); msg.setAttribute('aria-live', 'polite'); actions.after(msg);
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
      el('span', 'pg-q-t', row, q.text);
      const box = el('span', 'pg-q-in', row), inp = el('input', null, box);
      inp.type = 'number'; inp.step = 'any'; inp.inputMode = 'decimal'; inp.dataset.q = q.id; inp.setAttribute('aria-label', `${q.text} (${q.unit})`);
      el('span', 'pg-q-u', box, q.unit);
      if (g) { inp.value = g.given === undefined ? '' : g.given; inp.disabled = true; el('span', 'pg-q-v', row, g.ok ? '✓ matches the document' : `✗ the document gives ${num3(g.want)} ${q.unit}`); }
    }
    qBox.hidden = !qBox.children.length;
  }
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
    runBtn.textContent = st < 8 ? (st === 7 ? 'Strip the resist and test' : `Run station ${st + 1}`) : 'Tested';
    runBtn.disabled = st >= 8;
    againBtn.hidden = st === 0;
    againBtn.textContent = st >= 7 ? 'Start a new wafer (−10 points)' : 'Strip and recoat (−5 points)';
    pbox.hidden = st >= 7 && !SHOW_ALL;
    textBox.innerHTML = st < 8 ? STATIONS[st].text : 'The map shows every die, and the report with your score is below the figure. If the result is off, decide which station caused it and run another wafer.';
    renderQs(); renderLog();
    if (st >= 8) renderReport(); else if (report) report.hidden = true;
  }
  runBtn.addEventListener('click', () => {
    const v = widget.values, st = v.st;
    if (st >= 8) return;
    gradeStation(st);
    state.log.push(`<b>${STATIONS[st].name}:</b> ${STATIONS[st].done(v)}`);
    widget.set({ stage: st + 1 });
    const after = widget.values, L = after.res.L;
    if (st === 7) {                                                           // tested: the run counts for the reader's progress
      const gr = grades(), sc = G.score(after.res, gr, state.reworks, state.scraps);
      MFW.progress.emit({ type: 'game', score: sc.total, reworks: state.reworks, scraps: state.scraps, docs: gr.every(g => g.ok) });
    }
    msg.textContent = st === 0 ? `Coated: ${um(L.d)} of resist.` : st === 4 ? `Developed. Inspection: ${cdText(L)}.` : st === 7 ? '' : `${STATIONS[st].name} done.`;
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
        ${row('Exposure', STATIONS[3].done(v), `${fmt.sig(r.L.E, 3)} mJ/cm² at 365 nm`)}
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
