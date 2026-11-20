/* Etching a window into (100) silicon: anisotropic KOH/TMAH, isotropic wet, Bosch DRIE. Topic: etching. */
(function () {
  const { C, M, fmt } = MFW;
  const E = MFW_ETCH;
  const um = x => (x < 1 ? `${fmt.sig(x * 1000, 3)} nm` : `${fmt.sig(x, 3)} µm`);
  const mins = m => (m < 60 ? `${fmt.sig(m, 3)} min` : `${fmt.sig(m / 60, 3)} h`);
  const MASKNAME = { si3n4: 'LPCVD Si₃N₄', sio2: 'thermal SiO₂', resist: 'photoresist' };
  const ZOOM = [10, 20, 50, 100, 200, 500, 1000, 2000];

  function maskNote(v) {
    if (v.mr === null) return `${MASKNAME[v.mask]} is dissolved by ${E.ETCH[v.etch].name} – not usable as a mask`;
    if (v.mr === undefined) return `no reliable rate data for ${MASKNAME[v.mask]} in ${E.ETCH[v.etch].name} – drawn unchanged`;
    if (v.t > v.tFail) return `mask consumed after ${mins(v.tFail)} – etching beyond this is not modelled`;
    return v.mr === 0 ? `${MASKNAME[v.mask]}: not measurably etched` : `${MASKNAME[v.mask]} etches at ${fmt.sig(v.mr, 2)} nm/min – lasts ${mins(v.tFail)}`;
  }

  MFW.widget('#app', {
    title: 'Etching silicon through a mask window',
    alt: v => `${E.ETCH[v.etch].name} through a ${um(v.W)} window in ${MASKNAME[v.mask]} for ${mins(v.t)}: depth ${um(v.depth)}, undercut ${um(v.undercut)}. ${maskNote(v)}.`,
    source: 'Geometric etch-front model of a long window aligned to a &lt;110&gt; direction on a (100) wafer; no loading, aspect-ratio or agitation effects. Rates: K. R. Williams, K. Gupta, M. Wasilik, <i>J. MEMS</i> 12 (2003) 761 (KOH 30 %, isotropic HNO₃/H₂O/NH₄F – an HNA-type etch, Bosch DRIE); activation energies and (100):(111) ratio after H. Seidel et al., <i>J. Electrochem. Soc.</i> 137 (1990) 3612; TMAH after O. Tabata, <i>Sensors and Materials</i> 13 (2001) 271. Etch rates vary with concentration, stirring and bath age by tens of per cent.',
    freeText: 'Explore – design a membrane etch: a 400 µm-wide window in KOH. How deep is the cavity after 2 h, and how thick must an oxide mask be to survive?',

    params: {
      etch: { value: 'koh', label: 'Etchant', options: { koh: 'KOH 30 wt % (anisotropic wet)', tmah: 'TMAH 25 wt % (anisotropic wet)', iso: 'Isotropic wet, HNA type (HNO₃ + fluoride)', drie: 'Bosch DRIE (deep reactive ion etching)' } },
      mask: { value: 'si3n4', label: 'Mask material', options: MASKNAME },
      tm: { value: 100, min: 20, max: 3000, log: true, label: 'Mask thickness', format: x => `${fmt.sig(x, 3)} nm` },
      W: { value: 100, min: 5, max: 1000, log: true, label: 'Window width <i>W</i>', format: um },
      t: { value: 30, min: 0, max: 480, step: 1, label: 'Etch time <i>t</i>', format: mins },
      T: { value: 80, min: 50, max: 95, step: 1, label: 'Bath temperature', unit: '°C', digits: 0, when: v => E.ETCH[v.etch].kind === 'aniso' },
      rate: { value: 2, min: 1, max: 15, step: 0.1, label: 'DRIE Si etch rate', unit: 'µm/min', digits: 1, when: v => v.etch === 'drie' },
    },
    layers: { dims: false, angle: false },
    explore: { show: ['dims'] },

    derived(v) {
      const s = E.etchState({ etch: v.etch, mask: v.mask, tm: v.tm, W: v.W, t: v.t, T: v.T, rate: v.rate });
      const extentX = (s.top + Math.max(10, 0.25 * v.W)) * 2, extentY = Math.max(s.depth, (E.ETCH[v.etch].kind === 'aniso' ? Math.min(s.dmax, 1.2 * v.W) : v.W * 0.5)) * 1.25;
      const need = Math.max(extentX / 9.2, extentY / 4.6) * 5;                    // µm per 5 scene units
      const zoom = ZOOM.find(z => z >= need) || 2000;
      return { ...s, zoom, sel: s.mr > 0 ? s.R * 1000 / s.mr : Infinity };
    },

    draw(p, v, w) {
      // ---------------------------------------------------------- cross-section (equal x and y scale)
      const zoom = w.smooth('zoom', v.zoom, { log: true });                        // glide between zoom steps
      const cx = -2.2, ys = 1.55, k = 5 / zoom;                                    // scene units per µm
      const X0 = -6.95, X1 = 2.55, Yb = -3.05;
      const sx = x => cx + x * k, sy = d => ys + d * k;
      const yBack = sy(-E.WAFER), ySi = Math.max(Yb, yBack);                       // wafer back side (visible at the largest zooms)
      const view = [X0, Yb, X1, ys + 1.2];
      // silicon with the etched cavity cut out (draw Si, then the cavity in stage colour)
      p.clip(X0, Yb, X1, ys + 1.2, () => {
        p.material('si', X0, ySi, X1, ys, { stroke: null });
        const prof = v.profile.map(([x, d]) => [sx(x), sy(d)]);
        if (v.depth > 0) {
          if (v.kind === 'drie') {                                                    // scallops (exaggerated)
            const n = Math.max(1, Math.round(v.depth * k / 0.14)), pts = [[sx(-v.W / 2), ys]];
            for (let i = 0; i < n; i++) {
              const y0 = ys - (i / n) * v.depth * k, y1 = ys - ((i + 1) / n) * v.depth * k;
              for (let j = 1; j <= 6; j++) { const a = Math.PI * j / 6; pts.push([sx(-v.W / 2) - 0.035 * Math.sin(a), y0 + (y1 - y0) * j / 6]); }
            }
            const left = pts.slice(), right = left.map(([x, y]) => [2 * cx - x, y]).reverse();
            p.polygon([...left, ...right], { fill: C.bg, stroke: MAT('si', 'stroke'), width: 1.5 });
          } else p.polygon(prof, { fill: C.bg, stroke: MAT('si', 'stroke'), width: 1.5 });
        }
        // mask on both sides of the window (overhangs where the Si below is undercut)
        const thick = Math.max(0.05, Math.min(0.3, 0.05 + Math.log10(Math.max(v.tm, 20) / 20) * 0.12));
        const left = v.maskLeft / v.tm;
        if (v.mr !== null && left > 0) {
          const mt = thick * left, mm = v.mask;
          p.material(mm, X0, ys, sx(-v.W / 2), ys + mt);
          p.material(mm, sx(v.W / 2), ys, X1, ys + mt);
        }
      });
      p.line(X0, ys, sx(-v.top), ys, { color: MAT('si', 'stroke'), width: 1.5 });
      p.line(sx(v.top), ys, X1, ys, { color: MAT('si', 'stroke'), width: 1.5 });
      if (yBack > Yb) {
        p.line(X0, yBack, X1, yBack, { color: MAT('si', 'stroke'), width: 1.5 });
        p.text(`wafer back side (${E.WAFER} µm)`, X0 + 0.1, yBack - 0.22, { size: 0.19, color: C.muted });
      }
      p.text(`${MASKNAME[v.mask]} mask (thickness not to scale)`, X0 + 0.1, ys + 0.55, { size: 0.21, color: C.muted });
      p.text('(100) Si', X0 + 0.15, ySi + 0.25, { size: 0.24, color: C.text });
      // scale bar, below the drawing
      const sb = v.zoom / 5;
      p.line(X1 - 0.2 - sb * k, Yb - 0.3, X1 - 0.2, Yb - 0.3, { color: C.white, width: 3 });
      p.text(um(sb), X1 - 0.32 - sb * k, Yb - 0.3, { size: 0.2, align: 'right', color: C.text });
      p.text('x and y to the same scale', X0 + 0.1, Yb - 0.3, { size: 0.19, color: C.muted });

      p.layer('dims', () => {
        if (v.depth > 0) {
          const xd = Math.min(sx(v.top) + 0.35, X1 - 0.1), yd = Math.max(sy(-v.depth), Yb + 0.05), ym = (ys + yd) / 2;
          p.dim(xd, ys, xd, yd, '');
          p.place(um(v.depth), [[xd + 0.12, ym, 'left'], [xd - 0.12, ym, 'right'], [xd + 0.12, ys - 0.25, 'left'], [xd - 0.12, ys - 0.25, 'right'], [xd - 0.12, yd + 0.3, 'right'], [sx(0), ym, 'center']],
            { size: 0.22, color: C.greyA, within: view, key: 'depth' });
          p.dim(sx(-v.W / 2), ys + 0.95, sx(v.W / 2), ys + 0.95, `W = ${um(v.W)}`, { size: 0.22 });
          if (v.undercut * k > 0.06) {
            const xu = sx(-v.top);
            p.place(`undercut ${um(v.undercut)}`, [[xu - 0.1, ys - 0.3, 'right'], [xu - 0.1, ys - 0.62, 'right'], [X0 + 0.1, ys - 0.3, 'left'], [X0 + 0.1, ys - 0.62, 'left'], [xu + 0.15, ys - 0.3, 'left'], [xu + 0.15, ys - 0.62, 'left']],
              { size: 0.2, color: C.gold, within: view, key: 'undercut' });
          }
        }
      });
      p.layer('angle', () => {
        if (v.kind === 'aniso' && v.depth * k > 0.5) {
          const x0 = sx(-v.top), y0 = ys, dk = v.depth * k, run = dk / Math.tan(E.ANGLE);
          p.arc(x0, y0, 0.7, -54.74, 0, { color: C.yellow, width: 2.5 });
          p.place('54.74°', [[x0 + 0.8, y0 - 0.3, 'left'], [x0 + 0.8, y0 - 0.58, 'left'], [x0 + 0.45, y0 - 0.95, 'left'], [x0 - 0.15, y0 - 0.3, 'right'], [x0 + 1.1, y0 - 0.95, 'left']], { size: 0.22, color: C.yellow, within: view, key: 'ang' });
          p.place('{111} sidewall', [0.5, 0.38, 0.62, 0.75, 0.25].map(f => [x0 + run * f - 0.17, y0 - dk * f, 'right']),
            { size: 0.2, color: C.yellow, bg: true, within: view, key: 'wall' });
        }
      });

      // ---------------------------------------------------------- depth vs time
      const tmax = 480;
      const depthAt = t => E.etchState({ etch: v.etch, mask: v.mask, tm: v.tm, W: v.W, t, T: v.T, rate: v.rate }).depth;
      const dEnd = Math.max(depthAt(tmax), v.depth) * 1.08;                         // depth never decreases with time
      const ymax = w.smooth('ymax', [10, 20, 50, 100, 200, 300, 500, 600].find(n => n >= dEnd) || 600, { log: true });
      const ax = p.axes({ x: 3.55, y: -2.55, w: 3.25, h: 4.5, xr: [0, tmax], yr: [0, ymax], grid: true, size: 0.21, nticks: 4,
        xlabel: 'etch time (min)', ylabel: 'depth (µm)', ylabelOffset: 0.8 }).draw();
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        ax.plot(depthAt, { color: C.yellow, width: 3.5, samples: 160 });
        if (isFinite(v.tFail) && v.tFail < tmax) ax.vline(v.tFail, { color: C.red });
      });
      ax.dot(Math.min(v.t, tmax), v.depth, { r: 0.09 });
      if (isFinite(v.tFail) && v.tFail < tmax) {
        const X = ax.X(v.tFail);
        ax.place('mask gone', [[X + 0.08, ax.Y(ymax * 0.93), 'left'], [X - 0.08, ax.Y(ymax * 0.93), 'right'], [X + 0.08, ax.Y(ymax * 0.7), 'left'], [X - 0.08, ax.Y(ymax * 0.7), 'right']],
          { color: C.red, size: 0.19, key: 'gone' });
      }
      const flat = v.through && v.tThrough < tmax ? { d: E.WAFER, t: v.tThrough, s: 'through the wafer' }
        : v.kind === 'aniso' && v.tClose < tmax && v.dClose < ymax ? { d: v.dClose, t: v.tClose, s: 'V-groove closed' } : null;
      if (flat) {
        const Yf = ax.Y(flat.d), Xr = ax.X(tmax) - 0.05;
        ax.place(flat.s, [[Xr, Yf - 0.14, 'right', 'top'], [ax.X(flat.t) - 0.1, Yf + 0.12, 'right', 'bottom'], [Xr, Yf + 0.14, 'right', 'bottom'], [ax.X(Math.min(tmax, flat.t + 0.5 * (tmax - flat.t))), Yf - 0.14, 'center', 'top'], [Xr, Yf + 0.5, 'right', 'bottom'], [Xr, Yf - 0.5, 'right', 'top'], [ax.X(flat.t) + 0.15, Yf - 0.08, 'left', 'top']],
          { color: C.muted, size: 0.18, key: 'flat' });
      }
      p.text(E.ETCH[v.etch].name, 3.55 + 3.25 / 2, 2.62, { size: 0.24, align: 'center', color: C.greyA });
      p.text(`Si: ${fmt.sig(v.R, 3)} µm/min`, 3.55 + 3.25 / 2, 2.3, { size: 0.21, align: 'center', color: C.muted });
      p.text(maskNote(v), (X0 + X1) / 2, 3.35, { size: 0.23, align: 'center', color: (v.mr === null || v.t > v.tFail) ? C.red : C.greyA });
    },

    readout: v => `<table>
      <tr><td>Si etch rate</td><td>${fmt.sig(v.R, 3)} µm/min</td></tr>
      <tr><td>depth</td><td><b class="hl">${um(v.depth)}</b></td></tr>
      <tr><td>undercut under the mask edge</td><td>${um(v.undercut)}</td></tr>
      ${v.kind === 'aniso' ? `<tr><td>bottom width (W' − √2·d)</td><td>${v.closed ? 'V-groove closed' : um(2 * v.bottom)}</td></tr><tr><td>V-groove closes (≈ W/√2)</td><td>${um(v.dClose)} after ${mins(v.tClose)}</td></tr>` : ''}
      ${v.kind === 'drie' ? `<tr><td>aspect ratio depth : width</td><td>${fmt.sig(v.depth / v.W, 2)} : 1</td></tr>` : ''}
      <tr><td>selectivity Si : mask</td><td>${v.mr === null ? 'mask dissolves' : v.mr === undefined ? 'no data' : isFinite(v.sel) ? fmt.sig(v.sel, 2) + ' : 1' : 'very high'}</td></tr>
      ${v.through ? `<tr><td colspan="2" class="warn">etched through the ${E.WAFER} µm wafer after ${mins(v.tThrough)}</td></tr>` : ''}
      <tr><td>mask remaining</td><td>${v.mr === undefined ? '–' : `${fmt.sig(v.maskLeft, 3)} nm`}</td></tr></table>`,

    steps: [
      { name: 'Anisotropic KOH etch', caption: 'KOH etches (100) fast and {111} very slowly', set: { etch: 'koh', mask: 'si3n4', tm: 100, W: 100, t: 30, T: 80, rate: 2 }, show: ['dims'], duration: 2.5,
        text: v => `A 100 µm window in a nitride mask on a (100) wafer, 30 min in 30 % KOH at 80 °C. The (100) bottom etches at ${fmt.sig(v.R, 2)} µm/min, but the densely bonded {111} planes are ~40× slower, so they survive as sidewalls: depth ${um(v.depth)}, and almost no undercut.` },
      { name: 'The 54.74° sidewall', caption: '{111} planes meet the (100) surface at 54.74°', show: ['angle'],
        text: 'The sidewalls are {111} crystal planes, inclined at arctan √2 = 54.74° to the (100) surface. The geometry is fixed by the crystal, not by the process: the top opening, the depth and the bottom width are linked by w<sub>bottom</sub> = W − √2·d.' },
      { name: 'Self-termination', caption: 'The groove closes at d = W/√2 and stops', set: { t: 90 }, duration: 3,
        text: v => `When the two {111} walls meet, no (100) surface is left and etching practically stops: a self-terminated V-groove of depth ≈ W/√2 = ${um(v.W / Math.SQRT2)} (${um(v.dClose)} here, because the {111} walls also recede slowly), reached after ${mins(v.tClose)}. Afterwards the groove grows only at the slow {111} rate. V-grooves align optical fibres; with wide windows the same etch makes membranes for pressure sensors.` },
      { name: 'Mask selectivity', caption: 'SiO₂ is etched by KOH – it must be thick enough', set: { mask: 'sio2', tm: 500 }, duration: 1.5,
        text: v => `A 500 nm thermal oxide mask instead of nitride: KOH etches oxide at ${fmt.sig(v.mr, 2)} nm/min (selectivity ~${fmt.sig(v.sel, 2)}:1), so the mask is gone after ${mins(v.tFail)} – before the 90 min etch is over. LPCVD nitride is not measurably etched and is the standard KOH mask; photoresist dissolves at once.` },
      { name: 'Temperature', caption: v => `${v.T} °C: KOH etching is thermally activated`, set: { mask: 'si3n4', tm: 100, T: 60, t: 90 }, duration: 2,
        text: v => `At ${v.T} °C the Si rate drops to ${fmt.sig(v.R, 2)} µm/min (E<sub>a</sub> ≈ 0.59 eV) – 3.2× slower than at 80 °C. Temperature control of the bath (±1 °C) is therefore essential for depth control.` },
      { name: 'TMAH', caption: 'TMAH: CMOS-compatible, slower, oxide hardly etched', set: { etch: 'tmah', T: 80, mask: 'sio2', tm: 100 }, duration: 1.5,
        text: v => `TMAH contains no alkali ions (K⁺ contaminates CMOS gate oxides), so it is used when circuits are on the wafer. It is slower (${fmt.sig(v.R, 2)} µm/min), has a lower (100):(111) ratio, but etches SiO₂ about four orders of magnitude slower than Si – even 100 nm of oxide survives.` },
      { name: 'Isotropic etching', caption: 'Isotropic: undercut = depth, rounded profile', set: { etch: 'iso', mask: 'sio2', tm: 1000, t: 60 }, duration: 1.5,
        text: v => `An isotropic etch of the HNA type attacks every direction equally: HNO₃ oxidises the silicon and a fluoride dissolves the oxide (HF in classic HNA = HF + HNO₃ + acetic acid; NH₄F in the recipe used here). The cavity becomes rounded and the mask is undercut by as much as the depth (${um(v.undercut)}). Useful for releasing structures and rounding corners, useless for narrow deep features.` },
      { name: 'Deep reactive ion etching', caption: 'Bosch DRIE: vertical walls, any crystal orientation', set: { etch: 'drie', mask: 'resist', tm: 2000, W: 20, t: 40, rate: 2 }, duration: 2,
        text: v => `The Bosch process alternates two short steps: C₄F₈ deposits a protective polymer everywhere; then, in the SF₆ step, ion bombardment first clears the polymer from the bottom only and fluorine etches the exposed silicon (Laermer &amp; Schilp). The walls stay vertical, with small "scallops" (exaggerated here). Depth ${um(v.depth)} in a ${um(v.W)} window – aspect ratio ${fmt.sig(v.depth / v.W, 2)}:1, independent of crystal orientation. Photoresist works as a mask (selectivity ~60:1). Explore the rest in <b>Explore</b>.` },
    ],
  });

  function MAT(name, prop) { return MFW.MAT[name][prop]; }
}());
