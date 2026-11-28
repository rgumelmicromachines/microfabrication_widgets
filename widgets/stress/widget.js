/* Thin-film stress and wafer bow: intrinsic + thermal-mismatch stress, Stoney equation, curvature measurement.
   Topic: thin films. */
(function () {
  const { C, M, fmt } = MFW;
  const S = MFW_STRESS;
  const mpa = s => (Math.abs(s) >= 1000 ? `${fmt.sig(s / 1000, 3)} GPa` : `${fmt.num(s, 0)} MPa`);
  const um = x => (Math.abs(x) >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.sig(x * 1000, 3)} nm`);
  const metres = r => (!isFinite(r) ? '∞' : Math.abs(r) >= 1000 ? `${fmt.sig(r / 1000, 2)} km` : `${fmt.sig(r, 3)} m`);
  const kind = s => (Math.abs(s) < 5 ? 'practically stress-free' : s > 0 ? 'tensile' : 'compressive');
  const FILM_OPTS = { sio2: 'Thermal SiO₂', si3n4: 'LPCVD Si₃N₄ (stoichiometric)', lsn: 'LPCVD SiNₓ (Si-rich, low-stress)', al: 'Evaporated Al', cr: 'Evaporated Cr', au: 'Evaporated Au' };

  let widget = null;
  widget = MFW.widget('#app', {
    title: 'Thin-film stress and wafer bow',
    alt: v => `${v.f.name}, ${um(v.hf)} on a ${v.D} mm wafer (${v.hs} µm): intrinsic ${mpa(v.sigI)}, thermal ${mpa(v.sigTh)}, total ${mpa(v.sig)} ${kind(v.sig)}; radius of curvature ${metres(v.R)}, bow ${um(Math.abs(v.bow))}.`,
    source: 'Thermal-mismatch stress σ_th = E_f/(1−ν_f)·∫(α_s − α_f)dT and Stoney equation 1/R = 6σh_f/(M_s h_s²) (M. Ohring, <i>The Materials Science of Thin Films</i>, 1992, eqs. 9-13 and 9-17; G. G. Stoney 1909). Si(100) biaxial modulus M_s = 180 GPa from C₁₁, C₁₂ (Brantley 1973; data reviewed by George 1999); α_Si(T) after Okada &amp; Tokumaru (1984). Film data and default intrinsic stresses: see the references below the widget. Elastic film, small deflection, uniform stress, no plastic flow or creep.',
    freeText: 'Explore – change the film, its thickness and the deposition temperature, and watch the stress during cool-down and the bow of the wafer. Tension makes the film side concave, compression convex.',
    onInput: (w, name, value) => {
      if (name !== 'film') return;
      const f = S.FILMS[value];
      w.P.Tdep = f.Tdep; w.P.sigI = Math.round(S.defaultIntrinsic(value));
      w.dirty = true; w._syncControls(true);
    },

    params: {
      film: { value: 'si3n4', label: 'Film', options: FILM_OPTS },
      hf: { value: 0.1, min: 0.01, max: 2, log: true, label: 'Film thickness <i>h</i>_f', format: um },
      Tdep: { value: 750, min: 25, max: 1200, step: 5, label: 'Deposition temperature', unit: '°C', digits: 0 },
      sigI: { value: Math.round(S.defaultIntrinsic('si3n4')), min: -1500, max: 1500, step: 10, label: 'Intrinsic stress (+ tensile)', format: x => `${fmt.num(x, 0)} MPa` },
      D: { value: '100', label: 'Wafer', options: { 100: '100 mm, 525 µm', 150: '150 mm, 675 µm', 200: '200 mm, 725 µm', 300: '300 mm, 775 µm' } },
    },
    layers: { thermal: false, laser: false },
    explore: { show: ['thermal'] },

    derived: v => S.state(v),

    tex: [
      { at: [0, 3.42], tex: '\\sigma = \\sigma_{int} + \\frac{E_f}{1-\\nu_f}\\!\\int_{T_{dep}}^{T}\\!(\\alpha_s - \\alpha_f)\\,dT,\\qquad \\frac{1}{R} = \\frac{6\\,\\sigma\\,h_f}{M_s\\,h_s^2},\\qquad \\delta = \\frac{r^2}{2R}', size: 0.32 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- bowed wafer (side view, bow exaggerated)
      const X0 = -6.6, X1 = -0.9, xc = (X0 + X1) / 2, half = (X1 - X0) / 2, y0 = 0.95;
      const bowU = Math.abs(v.bow), shown = w.smooth('bowdraw', M.clamp(Math.abs(v.bow) > 0.05 ? 0.75 : 0.75 * Math.abs(v.bow) / 0.05, 0, 0.75));
      const sgn = v.sig >= 0 ? 1 : -1, ex = bowU > 1e-6 ? shown / (bowU * 1e-6 / (v.D / 2 * 1e-3) * half) : 1;
      // centre line y(x) = y0 + sgn·shown·(x/half)²  (tensile: edges up → concave on the film side)
      const yAt = x => y0 - sgn * shown / 2 + sgn * shown * ((x - xc) / half) ** 2;
      const th = 0.32, tf = 0.1, N = 48, top = [], bot = [], ftop = [];
      for (let i = 0; i <= N; i++) { const x = X0 + (X1 - X0) * i / N, y = yAt(x); top.push([x, y]); bot.push([x, y - th]); ftop.push([x, y + tf]); }
      p.materialPoly('si', [...top, ...bot.reverse()], { stroke: null });
      p.polygon([...ftop, ...top.slice().reverse()], { fill: v.film.startsWith('si') || v.film === 'lsn' ? MFW.MAT.si3n4.fill : v.film === 'sio2' ? MFW.MAT.sio2.fill : MFW.MAT.metal.fill, stroke: null });
      const yHi = Math.max(yAt(X0), yAt(xc)) + tf;                                          // highest point of the film
      p.text(`${v.f.name}, ${um(v.hf)}`, X0, 2.62, { size: 0.2, color: C.text });
      p.text(`${kind(v.sig)} film`, X1, 2.62, { size: 0.21, align: 'right', color: Math.abs(v.sig) < 5 ? C.muted : v.sig > 0 ? C.red : C.blue, bold: true });
      p.text(`Si wafer ${v.D} mm, ${v.hs} µm`, xc, y0 - 0.375 - th - 0.25,   // below the lowest position of the wafer: the label stays put when the bow changes sign
        { size: 0.19, align: 'center', color: C.text });
      // stress arrows above the film: tensile pulls inward (→ ←), compressive pushes outward (← →)
      if (Math.abs(v.sig) >= 5) for (const xa of [X0 + 0.75, X1 - 0.75]) {
        const inward = (xa < xc ? 1 : -1) * (v.sig > 0 ? 1 : -1), y = yHi + 0.45;
        p.arrow(xa - inward * 0.35, y, xa + inward * 0.35, y, { color: v.sig > 0 ? C.red : C.blue, width: 3, head: 0.15 });
      }
      // bow: height difference between the wafer edge and the centre, measured just right of the wafer
      const yEdge = yAt(X1) + tf, yCent = yAt(xc) + tf, xd = X1 + 0.22;
      if (shown > 0.12) {
        p.line(xc, yCent, xd + 0.1, yCent, { color: C.greyB, width: 1.5, dash: [0.06, 0.06] });
        p.dim(xd, yCent, xd, yEdge, '');
        p.text('δ', xd + 0.12, (yEdge + yCent) / 2, { size: 0.22, color: C.yellow, bold: true });
      }
      p.text(Math.abs(v.bow) > 0.05 ? `bow exaggerated about ${fmt.sig(ex, 2)}×` : 'bow too small to show', X0, -0.55, { size: 0.18, color: C.muted });
      p.text(`δ = ${um(bowU)},  R = ${metres(Math.abs(v.R))}`, X1, -0.55, { size: 0.2, align: 'right', color: C.yellow, bold: true });

      // ---------------------------------------------------------- measurement: laser beam reflected at two points
      p.layer('laser', () => {
        p.text('curvature measurement: the reflected beam tilts by twice the local slope', X0, -1.0, { size: 0.18, color: C.greyA });
        [xc - 1.15, xc + 1.15].forEach(x => {
          const y = yAt(x) + tf, slope = 2 * sgn * shown * (x - xc) / half ** 2, L = 2.25 - y;
          p.line(x, y + L, x, y, { color: C.green, width: 2 });
          const a = 2 * Math.atan(slope);
          p.line(x, y, x - Math.sin(a) * L, y + Math.cos(a) * L, { color: C.green, width: 2, dash: [0.08, 0.06] });
        });
      });

      // ---------------------------------------------------------- stress during cool-down
      const Tmax = 1200;
      const sigAt = T => v.sigI + S.thermalStress(v.f, v.Tdep, T);
      const lo = Math.min(-200, v.sigI, v.sig, sigAt(v.Tdep)), hi = Math.max(200, v.sigI, v.sig);
      const span = w.smooth('sspan', w.nice('sspan', [500, 1000, 1500, 2000, 3000], Math.max(Math.abs(lo), Math.abs(hi)) * 1.15), { log: true });
      const ax = p.axes({ x: 1.0, y: -2.75, w: 5.6, h: 5.15, xr: [0, Tmax], yr: [-span, span], grid: true, size: 0.21, nticks: 6,
        yfmt: y => fmt.num(y, 0), xlabel: 'temperature (°C) – cooling runs from right to left', ylabel: 'film stress (MPa), + tensile', ylabelOffset: 0.9 }).draw();
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        ax.hline(0, { color: C.axis, dash: null, width: 1.5 });
        p.layer('thermal', () => ax.hline(v.sigI, { color: C.purple, dash: [0.08, 0.07], to: v.Tdep }));
        if (v.Tdep > S.T_ROOM) ax.plot(T => (T >= S.T_ROOM && T <= v.Tdep ? sigAt(T) : NaN), { color: C.yellow, width: 4, samples: 120 });
      });
      ax.dot(S.T_ROOM, v.sig, { r: 0.1 });
      ax.dot(v.Tdep, v.sigI, { r: 0.08, color: C.purple });
      ax.place(`${mpa(v.sig)} at 25 °C`, ax.around(S.T_ROOM, v.sig, 0.16).concat(ax.around(S.T_ROOM, v.sig, 0.45), ax.around(S.T_ROOM, v.sig, 0.8), [-0.9, -1.3, 0.9, 1.3].map(d => [ax.X(S.T_ROOM) + 0.15, ax.Y(v.sig) + d, 'left', d < 0 ? 'top' : 'bottom'])), { color: C.yellow, size: 0.2, key: 'sigrt' });
      ax.place(`σ_{int} at ${fmt.num(v.Tdep, 0)} °C`, ax.around(v.Tdep, v.sigI, 0.16).concat(ax.around(v.Tdep, v.sigI, 0.45), ax.around(v.Tdep, v.sigI, 0.8)), { color: C.purple, size: 0.2, key: 'sigdep' });
      p.layer('thermal', () => {
        if (Math.abs(v.sigTh) > 20 && v.Tdep > 150) ax.place(`thermal mismatch ${v.sigTh > 0 ? '+' : '−'}${mpa(Math.abs(v.sigTh))}`, [0.3, 0.65, 1.0].flatMap(d => [[ax.X((v.Tdep + 25) / 2), ax.Y((v.sig + v.sigI) / 2) + d, 'center', 'bottom'], [ax.X((v.Tdep + 25) / 2), ax.Y((v.sig + v.sigI) / 2) - d, 'center', 'top']])
          .concat([[ax.x + 0.1, ax.y + ax.h - 0.1, 'left', 'top'], [ax.x + 0.1, ax.y + 0.1, 'left', 'bottom'], [ax.x + ax.w - 0.1, ax.y + ax.h - 0.1, 'right', 'top'], [ax.x + ax.w - 0.1, ax.y + 0.1, 'right', 'bottom']]),
          { color: C.greyA, size: 0.19, key: 'thm' });
      });
    },

    readout: v => MFW.chars([
      ['film biaxial modulus', 'E<sub>f</sub>/(1−ν<sub>f</sub>)', `${fmt.num(v.Mf, 0)} GPa`],
      ['film thermal expansion', 'α<sub>f</sub>', `${fmt.sig(v.f.a, 2)} ppm/K`],
      ['Si: mean expansion, T<sub>dep</sub> to 25 °C', 'α<sub>s</sub>', `${fmt.sig(v.aMean * 1e6, 3)} ppm/K`],
      ['intrinsic stress', 'σ<sub>int</sub>', mpa(v.sigI)],
      ['thermal-mismatch stress', 'σ<sub>th</sub>', mpa(v.sigTh)],
      ['total stress at 25 °C', 'σ', mpa(v.sig), undefined, { hl: true, note: kind(v.sig) }],
      ['force per width', 'σ·h<sub>f</sub>', `${fmt.sig(v.F, 3)} N/m`],
      ['radius of curvature', 'R', metres(Math.abs(v.R))],
      ['bow', 'δ', um(Math.abs(v.bow)), undefined, { f: 'r²/2R', note: Math.abs(v.sig) < 5 ? '' : v.sig > 0 ? 'concave' : 'convex' }],
      Math.abs(v.bow) > v.hs / 2 && { warn: 'The bow exceeds half the wafer thickness – Stoney’s small-deflection assumption becomes questionable.' }]),

    steps: [
      { name: 'A stressed film bends the wafer', caption: 'Stoney: 1/R = 6σh_f / (M_s h_s²)', set: { film: 'si3n4', hf: 0.1, Tdep: 750, sigI: Math.round(S.defaultIntrinsic('si3n4')), D: '100' }, duration: 1.5,
        text: v => `Almost every deposited film is under stress. ${um(v.hf)} of stoichiometric LPCVD nitride carries about +1 GPa of tension (Ohring, Table 4-3). The film tries to shrink, the much thicker wafer resists, and the pair bends: the curvature is 1/R = 6σh<sub>f</sub>/(M<sub>s</sub>h<sub>s</sub>²) (Stoney). Here R = ${metres(Math.abs(v.R))} – a bow of ${um(Math.abs(v.bow))} over the 100 mm wafer.` },
      { name: 'Tensile or compressive', caption: 'Tension: concave film side; compression: convex', set: { film: 'sio2', hf: 1, Tdep: 1000, sigI: 0 }, duration: 2,
        text: v => `Thermal oxide is the opposite case: ${mpa(v.sig)}, compressive. The film wants to expand, so the wafer bows the other way, with the film on the outside (dome). Measured after oxidation at 1200 °C: −310 MPa (Jaccodine &amp; Schlegel 1966) – about what thermal mismatch alone predicts (${mpa(S.thermalStress(S.FILMS.sio2, 1200))} with the bulk data used here).` },
      { name: 'Thermal mismatch', caption: 'Cooling from the deposition temperature', show: ['thermal'], duration: 1,
        text: v => `Why compressive? The oxide grows at ${fmt.num(v.Tdep, 0)} °C. Silica hardly expands (α ≈ 0.5 ppm/K), silicon does (α rises from 2.6 ppm/K at room temperature to about 4.4 ppm/K at 1000 °C, Okada &amp; Tokumaru). On cooling the wafer shrinks more than the film and squeezes it: σ<sub>th</sub> = E<sub>f</sub>/(1−ν<sub>f</sub>)·∫(α<sub>s</sub> − α<sub>f</sub>)dT = ${mpa(v.sigTh)}. The yellow line follows the stress during cool-down.` },
      { name: 'Metals on silicon', caption: 'α_Al ≈ 9 × α_Si: tension after a hot step', set: { film: 'al', hf: 1, Tdep: 300, sigI: -74 }, duration: 2,
        text: v => `For metals it is the other way round: aluminium expands about nine times more than silicon (23 vs 2.6 ppm/K). A film made or annealed at ${fmt.num(v.Tdep, 0)} °C ends up in tension at room temperature: elastically ${mpa(v.sigTh)} – more than a thin Al film can carry; real films partly yield and creep (not modelled here). Evaporated at room temperature, the same film has only its intrinsic stress, −74 MPa (Ohring, Table 9-2).` },
      { name: 'Intrinsic stress', caption: 'Growth-induced stress: up to GPa, either sign', set: { film: 'cr', hf: 0.2, Tdep: 25, sigI: 850 }, duration: 2,
        text: v => `Besides thermal mismatch, films carry <b>intrinsic</b> stress from the way they grow: evaporated Cr about +850 MPa, Au +260 MPa, Al −74 MPa (Ohring, Table 9-2); sputtered films can switch from compressive to tensile as the Ar pressure rises (Hoffman &amp; Thornton 1977). Stoichiometric LPCVD nitride owes most of its +1 GPa to intrinsic stress; making it silicon-rich lowers it to about +150 MPa (Sekimoto et al. 1981) – the standard membrane material.` },
      { name: 'Measuring stress', caption: 'Measure the curvature, invert Stoney', show: ['laser'], set: { film: 'si3n4', hf: 0.2, Tdep: 750, sigI: Math.round(S.defaultIntrinsic('si3n4')) }, duration: 2,
        text: v => `Film stress is usually measured, not calculated: a laser scans the wafer before and after deposition, and the angle of the reflected beam gives the slope and hence the curvature. Stoney then gives σ = M<sub>s</sub>h<sub>s</sub>²/(6h<sub>f</sub>)·Δ(1/R). Only the wafer's modulus and thickness and the film thickness are needed – not the elastic constants of the film. Here Δ(1/R) = ${fmt.sig(v.kappa, 3)} m⁻¹ → ${mpa(v.sig)}.` },
      { name: 'Why it matters', caption: 'Bow, cracking, peeling – and thinner wafers bow more', set: { D: '150' }, duration: 1,
        text: v => `The bow grows with σ·h<sub>f</sub> and with r²/h<sub>s</sub>²: the same film bows a 150 mm wafer to ${um(Math.abs(v.bow))}. Too much tension cracks a film, too much compression makes it buckle and peel; bowed wafers cause focus and chucking problems in lithography. Switch to <b>Explore</b> and design a film stack.` },
    ],
  });
}());
