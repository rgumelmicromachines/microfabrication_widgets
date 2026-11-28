/* Four-point probe and van der Pauw: sheet resistance, geometric corrections, resistivity and doping.
   Topic: characterization. */
(function () {
  const { C, M, fmt } = MFW;
  const P = MFW_4PP;
  const NAME = { B: 'boron (p-type)', P: 'phosphorus (n-type)' };
  const conc = c => `${fmt.sci(c, 1)} cm⁻³`;
  const ohmcm = r => (r >= 1 ? `${fmt.sig(r, 3)} Ω·cm` : `${fmt.sig(r * 1000, 3)} mΩ·cm`);
  const ohmsq = r => (r >= 1000 ? `${fmt.sig(r / 1000, 3)} kΩ/□` : `${fmt.sig(r, 3)} Ω/□`);
  const lenS = um => (um >= 1000 ? `${fmt.sig(um / 1000, 3)} mm` : um >= 1 ? `${fmt.sig(um, 3)} µm` : `${fmt.sig(um * 1000, 3)} nm`);
  const volts = v => (v >= 1 ? `${fmt.sig(v, 3)} V` : v >= 1e-3 ? `${fmt.sig(v * 1e3, 3)} mV` : `${fmt.sig(v * 1e6, 3)} µV`);
  const amps = a => (a >= 1e-3 ? `${fmt.sig(a * 1e3, 2)} mA` : `${fmt.sig(a * 1e6, 2)} µA`);

  MFW.widget('#app', {
    title: 'Sheet resistance and the four-point probe',
    alt: v => `Four-point probe, spacing ${fmt.num(v.s, 2)} mm, on a ${fmt.num(v.d, 0)} mm sample: ${NAME[v.dop]} ${conc(v.N)}, layer ${lenS(v.w)} thick. ρ = ${ohmcm(v.rho)}, R_s = ${ohmsq(v.Rs)}, measured ${volts(v.V)} at ${amps(v.I)}.`,
    source: 'Thin sheet R_s = (π/ln 2)·V/I and the circular-slice correction C(d/s) after F. M. Smits (1958); thickness correction F(w/s) after A. Uhlir (1955, reproduces Smits Table III); van der Pauw equation (1958). Resistivity of Si at 300 K vs boron or phosphorus density: fits of Thurber et al., NBS SP 400-64 (1981), the basis of ASTM F723. Uniform doping over the layer thickness, non-conducting bottom (e.g. a junction-isolated layer), probe in the centre of the sample, point contacts, no heating or carrier injection.',
    freeText: v => `Explore – change the layer, the sample size and the probe. How large is the error if you use 4.532·V/I on a ${fmt.num(v.d, 0)} mm sample?`,

    params: {
      dop: { value: 'B', label: 'Dopant', options: { B: 'Boron (p-type)', P: 'Phosphorus (n-type)' } },
      N: { value: 1e16, min: 1e14, max: 1e20, log: true, label: 'Doping <i>N</i> (uniform in the layer)', format: conc },
      w: { value: 525, min: 0.1, max: 1000, log: true, label: 'Layer thickness <i>w</i>', format: lenS },
      d: { value: 100, min: 8, max: 300, log: true, label: 'Sample diameter <i>d</i>', format: x => `${fmt.sig(x, 3)} mm` },
      s: { value: 1.59, min: 0.5, max: 2.5, step: 0.01, label: 'Probe spacing <i>s</i>', format: x => `${fmt.num(x, 2)} mm`, group: 'Probe and van der Pauw' },
      I: { value: 1e-3, min: 1e-6, max: 0.1, log: true, label: 'Test current <i>I</i>', format: amps, group: 'Probe and van der Pauw' },
      r: { value: 1, min: 1, max: 10, step: 0.1, label: 'Van der Pauw: ratio R_A/R_B of the irregular sample', format: x => fmt.num(x, 1), group: 'Probe and van der Pauw' },
    },
    layers: { thick: false, vdp: false },
    explore: { show: ['thick', 'vdp'] },

    derived: v => {
      const m = P.measure(v), pair = P.vdpPair(m.Rs, v.r);
      return { ...m, ...pair, vdpNaive: Math.PI * (pair.RA + pair.RB) / (2 * Math.LN2), Nback: P.dopingFor(v.dop, m.rho) };
    },

    tex: [
      { at: [0, 3.42], tex: 'R_s = \\frac{\\rho}{w} = C\\,F\\,\\frac{V}{I},\\qquad C = {{C:3}},\\quad F = {{F:3}}\\qquad (\\text{thin, infinite sheet: } C = \\pi/\\ln 2 = 4.532)', size: 0.31 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- top view: sample and probe (spacing enlarged if too small)
      const cx = -4.4, cy = 1.6, R = 1.05;
      p.circle(cx, cy, R, { fill: MFW.MAT.si.fill, stroke: MFW.MAT.si.stroke, width: 1.5 });
      const sp = Math.max(R * 2 * v.s / v.d, 0.13), toScale = sp <= R * 2 * v.s / v.d + 1e-9;
      const px = [-1.5, -0.5, 0.5, 1.5].map(k => cx + k * sp);
      // current flow lines between the outer probes (schematic)
      for (const f of [0.35, 0.7, 1.1]) {
        const pts = M.linspace(0, Math.PI, 30).map(a => [cx + 1.5 * sp * Math.cos(a), cy + f * 1.5 * sp * Math.sin(a)]);
        p.clip(cx - R, cy - R, cx + R, cy + R, () => { p.path(pts, { color: C.blue, width: 1.2, alpha: 0.7, noOcc: true }); p.path(pts.map(([x, y]) => [x, 2 * cy - y]), { color: C.blue, width: 1.2, alpha: 0.7, noOcc: true }); });
      }
      px.forEach((x, i) => p.circle(x, cy, 0.055, { fill: i === 0 || i === 3 ? C.red : C.yellow, stroke: null }));
      p.text(`d = ${fmt.sig(v.d, 3)} mm,  d/s = ${fmt.sig(v.ds, 3)}`, cx, cy - R - 0.22, { size: 0.19, align: 'center', color: C.text });
      p.text(toScale ? 'top view, to scale' : 'top view, probe spacing enlarged', cx, cy + R + 0.2, { size: 0.17, align: 'center', color: C.muted });
      p.text('I (outer)', -2.45, cy + 0.35, { size: 0.18, color: C.red });
      p.text('V (inner)', -2.45, cy + 0.05, { size: 0.18, color: C.yellow });

      // ---------------------------------------------------------- cross-section: thickness relative to spacing (to scale)
      const X0 = -6.7, X1 = -3.95, Ys = -1.05, k = (X1 - X0 - 0.3) / (3 * v.s);            // units per mm
      const wd = v.w * 1e-3 * k, hMax = 1.6, cut = wd > hMax, hd = Math.min(wd, hMax);
      p.box(X0, Ys - 1.9, X1, Ys - hd, { fill: C.grid, stroke: null });
      p.material(v.dop === 'B' ? 'pdoped' : 'ndoped', X0, Ys - hd, X1, Ys, { stroke: null });
      p.material('si', X0, Ys - hd, X1, Ys, { stroke: null, fillAlpha: 0.55 });
      if (cut) p.text('layer continues ↓', X1 - 0.05, Ys - hd + 0.15, { size: 0.16, align: 'right', color: C.text, bg: true });
      else p.text('insulating below', X1 - 0.05, Ys - hd - 0.22, { size: 0.16, align: 'right', color: C.muted });
      const pxs = [0, 1, 2, 3].map(i => X0 + 0.15 + i * v.s * k);
      pxs.forEach((x, i) => p.polygon([[x - 0.06, Ys + 0.5], [x + 0.06, Ys + 0.5], [x, Ys]], { fill: i === 0 || i === 3 ? C.red : C.yellow, stroke: null }));
      p.dim(pxs[0], Ys + 0.66, pxs[1], Ys + 0.66, '');
      p.text('s', (pxs[0] + pxs[1]) / 2, Ys + 0.84, { size: 0.2, align: 'center', color: C.greyA });
      if (!cut && hd > 0.25) { p.dim(X1 + 0.15, Ys, X1 + 0.15, Ys - hd, ''); p.text('w', X1 + 0.27, Ys - hd / 2, { size: 0.2, color: C.greyA }); }
      p.text(`cross-section, w and s to scale: w/s = ${fmt.sig(v.ws, 3)}`, X0, Ys - 2.2, { size: 0.18, color: C.text });

      // ---------------------------------------------------------- van der Pauw sample (irregular shape, contacts on the edge)
      p.layer('vdp', () => {
        const ox = -1.95, oy = -1.95, st = 1 + 0.025 * (v.r - 1), rr = t => 0.8 + 0.18 * Math.sin(3 * t + 0.6) + 0.1 * Math.cos(5 * t);
        const shape = M.linspace(0, 2 * Math.PI, 90).map(t => [ox + rr(t) * Math.cos(t) * st, oy + rr(t) * Math.sin(t)]);
        p.polygon(shape, { fill: MFW.MAT.si.fill, stroke: MFW.MAT.si.stroke, width: 1.5 });
        ['A', 'B', 'C', 'D'].forEach((n, i) => {
          const t = Math.PI / 4 + i * Math.PI / 2, x = ox + rr(t) * Math.cos(t) * st, y = oy + rr(t) * Math.sin(t);
          p.circle(x, y, 0.06, { fill: C.yellow, stroke: null });
          p.text(n, x + (Math.cos(t) > 0 ? 0.12 : -0.12), y + (Math.sin(t) > 0 ? 0.12 : -0.12), { size: 0.18, align: Math.cos(t) > 0 ? 'left' : 'right', color: C.text });
        });
        p.text('van der Pauw', ox, oy + 1.25, { size: 0.18, align: 'center', color: C.greyA });
      });

      // ---------------------------------------------------------- correction factor C(d/s)
      const ax = p.axes({ x: 1.0, y: 0.6, w: 5.6, h: 2.1, xr: [3, 300], xlog: true, yr: [0, 5], grid: true, size: 0.19,
        xticks: [2, 5, 10, 20, 50, 100, 200], xfmt: x => String(x), yticks: [0, 1, 2, 3, 4, 5], xlabel: 'd/s (log)', ylabel: 'C', ylabelOffset: 0.55 }).draw();
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        ax.hline(P.K_INF, { color: C.muted, dash: [0.06, 0.06] });
        ax.plot(x => P.cCircle(x), { color: C.yellow, width: 3.5, samples: 160 });
      });
      if (v.ds >= 3 && v.ds <= 300) ax.dot(v.ds, v.C, { r: 0.08 });
      ax.place('π/ln 2 = 4.532 (infinite sheet)', [[ax.x + ax.w - 0.1, ax.Y(P.K_INF) + 0.12, 'right', 'bottom'], [ax.x + ax.w - 0.1, ax.Y(P.K_INF) - 0.12, 'right', 'top']], { color: C.muted, size: 0.17, key: 'kinf' });
      if (v.ds >= 3 && v.ds <= 300) ax.place(`C = ${fmt.num(v.C, 3)}`, ax.around(v.ds, v.C, 0.15).concat(ax.around(v.ds, v.C, 0.4)), { color: C.yellow, size: 0.18, key: 'cdot' });

      // ---------------------------------------------------------- resistivity vs doping
      const bx = p.axes({ x: 1.0, y: -2.75, w: 5.6, h: 2.45, xr: [1e14, 1e20], xlog: true, yr: [1e-4, 1e3], ylog: true, grid: true, size: 0.19,
        xticks: [1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20], yticks: [1e-4, 1e-2, 1, 1e2], xlabel: 'dopant density (cm⁻³)', ylabel: 'ρ (Ω·cm)', ylabelOffset: 0.75 }).draw();
      p.clip(bx.x, bx.y, bx.x + bx.w, bx.y + bx.h, () => {
        bx.plot(N => P.rho('B', N), { color: C.red, width: v.dop === 'B' ? 3.5 : 2, samples: 120, alpha: v.dop === 'B' ? 1 : 0.5 });
        bx.plot(N => P.rho('P', N), { color: C.blue, width: v.dop === 'P' ? 3.5 : 2, samples: 120, alpha: v.dop === 'P' ? 1 : 0.5 });
      });
      bx.dot(v.N, v.rho, { r: 0.08 });
      bx.legend([{ label: 'boron (p)', color: C.red, width: 3 }, { label: 'phosphorus (n)', color: C.blue, width: 3 }], { corner: 'bl', size: 0.16 });
      bx.place(ohmcm(v.rho), bx.around(v.N, v.rho, 0.15).concat(bx.around(v.N, v.rho, 0.4), [[bx.x + bx.w - 0.1, bx.y + bx.h - 0.1, 'right', 'top'], [bx.x + bx.w - 0.1, bx.y + bx.h * 0.6, 'right']]), { color: C.yellow, size: 0.18, key: 'rdot' });
    },

    readout: v => {
      const err = (v.naive - v.Rs) / v.Rs, curWarn = v.I > 3 * v.rec || v.I < v.rec / 3;
      return MFW.chars([
        ['resistivity (Thurber et al., 300 K)', 'ρ', ohmcm(v.rho)],
        ['sheet resistance', 'R<sub>s</sub>', ohmsq(v.Rs), undefined, { hl: true, f: 'ρ/w' }],
        ['measured voltage', 'V', volts(v.V), undefined, { f: `at I = ${amps(v.I)}` }],
        ['correction factors', 'C · F', `${fmt.num(v.C, 3)} · ${fmt.num(v.F, 4)}`, '', { f: 'C(d/s), F(w/s)' }],
        ['naive estimate', '', ohmsq(v.naive), undefined, { f: '4.532·V/I', note: `${err >= 0 ? '+' : '−'}${fmt.sig(Math.abs(100 * err), 2)} %` }],
        ['doping recovered from ρ', '', conc(v.Nback)],
        ['recommended current (ASTM F84-68T)', '', amps(v.rec), undefined, { note: curWarn ? '<span class="warn">yours is far off</span>' : '' }],
        ['van der Pauw resistances', 'R<sub>A</sub> / R<sub>B</sub>', `${fmt.sig(v.RA, 3)} / ${fmt.sig(v.RB, 3)} Ω`],
        ['van der Pauw, simple average', '', ohmsq(v.vdpNaive), undefined, { f: 'π(R<sub>A</sub>+R<sub>B</sub>)/(2 ln 2)', note: `+${fmt.sig(100 * (v.vdpNaive / v.Rs - 1), 2)} %` }]]);
    },

    steps: [
      { name: 'Why four probes?', caption: 'Current through the outer pair, voltage across the inner pair', set: { dop: 'B', N: 1e16, w: 0.5, d: 300, s: 1.59, I: 1e-3, r: 1 }, duration: 1,
        text: v => `A current I flows between the two outer probes; a voltmeter that draws almost no current reads V between the two inner ones. The contact resistances of the probes therefore do not enter the result. For a thin, large sheet R<sub>s</sub> = (π/ln 2)·V/I = 4.532·V/I (Smits 1958). Here: ${volts(v.V)} at ${amps(v.I)} → ${ohmsq(v.Rs)}.` },
      { name: 'Sheet resistance', caption: 'R_s = ρ/w in Ω/□ – the resistance of any square of the layer', set: { w: 2 }, duration: 2,
        ask: { q: 'The layer is made four times thicker, 2 µm instead of 0.5 µm, with the same doping. What happens to its sheet resistance?',
          options: ['It stays the same: the material has not changed', 'It drops to a half', 'It drops to a quarter'], correct: 2 },
        text: v => `A layer of resistivity ρ and thickness w has a sheet resistance R<sub>s</sub> = ρ/w. Its unit Ω/□ ("ohms per square") says that a square of the layer has this resistance between two opposite edges, whatever its size: a line 100 squares long has 100·R<sub>s</sub>. For diffused and implanted layers R<sub>s</sub> is the natural quantity – it integrates the doping profile. With ρ = ${ohmcm(v.rho)} and w = ${lenS(v.w)} the layer has ${ohmsq(v.Rs)}.` },
      { name: 'Small samples', caption: 'Near the edge less area is available for the current: C(d/s) < 4.532', set: { w: 2, d: 8 }, duration: 2,
        ask: { q: 'The same layer is now measured on a small sample, 8 mm across – only five probe spacings. The current is unchanged. Compared with the large wafer, the voltage between the inner probes is …',
          options: ['larger', 'the same: only the layer matters', 'smaller'], correct: 0 },
        text: v => `The factor 4.532 assumes an infinite sheet. On a sample only ${fmt.sig(v.ds, 2)} probe spacings across, the edge confines the current and V is larger, so R<sub>s</sub> = C·V/I with Smits' factor C(d/s) = ${fmt.num(v.C, 3)}. Using 4.532 would overestimate R<sub>s</sub> by ${fmt.sig(100 * (v.naive / v.Rs - 1), 2)} %. For d/s ≳ 40 the error is below 1 %.` },
      { name: 'Thick samples', caption: 'w comparable to s: the thickness correction F(w/s)', set: { d: 300, w: 1000 }, show: ['thick'], duration: 2,
        task: 'The layer is now a whole wafer, 1 mm thick, and the thickness factor F (in the formula above the figure) is still close to 1. What counts is w relative to s: open <b>Probe and van der Pauw</b> and reduce the <b>Probe spacing <i>s</i></b> until F falls below 0.9.',
        goal: v => v.F <= 0.9, solution: { s: 0.8 },
        text: v => `For a layer much thinner than the probe spacing the current spreads in two dimensions. A whole wafer is not thin: here w/s = ${fmt.sig(v.ws, 2)} and the thickness factor is F = ${fmt.num(v.F, 3)} (Uhlir 1955; Smits Table III). For w ≪ s, F → 1; for a very thick block the formula turns into ρ = 2πs·V/I. Below w/s ≈ 0.5 the correction is under 0.3 %.` },
      { name: 'From resistivity to doping', caption: 'ρ(N) depends on the mobility – boron and phosphorus differ', set: { w: 525, d: 100, N: 1e16 }, duration: 2,
        task: 'A boron-doped wafer is specified by its resistivity, for example 10 Ω·cm. Which doping is that? Change the <b>Doping <i>N</i></b> until ρ = 10 Ω·cm (yellow dot in the lower plot).',
        goal: v => Math.abs(v.rho - 10) <= 1.5, solution: { N: 1.38e15 },
        text: v => `The resistivity of a uniformly doped wafer gives its doping through the measured ρ–N curves (Thurber et al. 1981, ASTM F723): ${ohmcm(v.rho)} means ${conc(v.N)} of ${NAME[v.dop]}. Holes are less mobile than electrons, so boron-doped silicon is about 2.5–3× more resistive than phosphorus-doped silicon at the same density up to about 10¹⁷ cm⁻³ (only about 1.5× above 10¹⁹ cm⁻³, where both mobilities are limited by the dopant ions).` },
      { name: 'The test current', caption: 'Large enough for a clean signal, small enough to avoid heating', duration: 1,
        text: v => `The standard recommends a current by resistivity range – ${amps(v.rec)} for ${ohmcm(v.rho)} (ASTM F84, after NBS TN 555). At ten times the recommended current the probes can heat the wafer measurably and the resistivity of silicon changes with temperature; at a tenth the signal gets noisy. Carrier injection at the probes can also distort high-resistivity readings.` },
      { name: 'Van der Pauw', caption: 'Any shape, four contacts on the edge: exp(−πR_A/R_s) + exp(−πR_B/R_s) = 1', set: { r: 4 }, show: ['vdp'], duration: 2,
        ask: { q: 'Van der Pauw’s method uses four contacts on the edge of a flat sample of any shape and two four-terminal resistances, R<sub>A</sub> and R<sub>B</sub>. On a symmetric sample R<sub>A</sub> = R<sub>B</sub> = R and R<sub>s</sub> = (π/ln 2)·R. On an irregular sample R<sub>A</sub> = 4·R<sub>B</sub>. Does the simple average, R<sub>s</sub> = (π/ln 2)·(R<sub>A</sub> + R<sub>B</sub>)/2, still give the sheet resistance?',
          options: ['Yes: the average of the two is what counts', 'No: it gives too high a value', 'No: it gives too low a value'], correct: 1 },
        text: v => `For test structures of arbitrary shape van der Pauw (1958) showed that two four-terminal resistances – current through A–B and voltage across C–D, then rotated by one contact – fix the sheet resistance through exp(−πR<sub>A</sub>/R<sub>s</sub>) + exp(−πR<sub>B</sub>/R<sub>s</sub>) = 1. The sample must be uniform, without holes, with small contacts on its edge. Here R<sub>A</sub>/R<sub>B</sub> = ${fmt.num(v.r, 1)}: simply averaging would give ${ohmsq(v.vdpNaive)} instead of ${ohmsq(v.Rs)}, ${fmt.sig(100 * (v.vdpNaive / v.Rs - 1), 2)} % too high. Now switch to <b>Explore</b>.` },
    ],
  });
}());
