/* Physical vapour deposition: line-of-sight transport, thickness uniformity, mean free path, shadowing and lift-off.
   Topic: thin-film deposition. */
(function () {
  const { C, M, fmt } = MFW;
  const PV = MFW_PVD;
  const SRC = { point: { n: 0, name: 'point source (isotropic)' }, knudsen: { n: 1, name: 'small surface source (cos φ)' } };
  const cm = x => (x >= 100 ? `${fmt.sig(x / 100, 3)} m` : x >= 1 ? `${fmt.sig(x, 3)} cm` : x >= 0.1 ? `${fmt.sig(x * 10, 3)} mm` : `${fmt.sig(x * 1e4, 3)} µm`);
  const pa = p => `${fmt.sci(p, 1)} Pa`;
  const um = x => (x >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.sig(x * 1000, 3)} nm`);
  const pct = x => `${fmt.sig(100 * x, 2)} %`;
  // fixed pseudo-random numbers for the drawn molecule paths: the picture changes smoothly with λ, never jumps
  const RNG = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const RAYS = Array.from({ length: 9 }, () => ({ u: [RNG(), RNG(), RNG(), RNG()], a: [RNG(), RNG(), RNG(), RNG()] }));

  MFW.widget('#app', {
    title: 'PVD: evaporation, mean free path and shadowing',
    alt: v => `Evaporation from a ${SRC[v.src].name} at ${cm(v.h)} onto a ${v.D} mm wafer: edge thickness ${pct(v.tEdge)} of the centre. At ${pa(v.p)} of ${v.gas} the mean free path is ${cm(v.lam)} and ${pct(v.f0)} of the atoms arrive without a collision.`,
    source: 'Thickness distribution for a small source and a flat substrate parallel to it: point source t/t₀ = [1+(r/h)²]^(−3/2), small surface source [1+(r/h)²]^(−2) (M. Ohring, <i>The Materials Science of Thin Films</i>, 1992, eqs. 3-16 to 3-19; R. Glang in Maissel &amp; Glang, <i>Handbook of Thin Film Technology</i>, 1970). Mean free path λ = kT/(√2·π·d²·p) with viscosity diameters d(air) = 3.74 Å, d(Ar) = 3.67 Å (Glang, Table 3); air at 0.1 Pa → 6.6 cm (J. F. O’Hanlon, <i>A User’s Guide to Vacuum Technology</i>, 2003). Shadowing: line of sight, every atom sticks. The scattered paths in the chamber and the coverage of the lift-off step are schematic.',
    freeText: v => `Explore – find the source distance that keeps the thickness within 5 % over a ${v.D} mm wafer, then raise the pressure to sputtering conditions and watch the directionality disappear.`,

    params: {
      src: { value: 'knudsen', label: 'Evaporation source', options: { knudsen: 'Small surface source – cos φ emission', point: 'Point source – isotropic emission' } },
      h: { value: 40, min: 10, max: 100, step: 1, label: 'Source–wafer distance <i>h</i>', format: cm },
      D: { value: '100', label: 'Wafer diameter', options: { 100: '100 mm', 150: '150 mm', 200: '200 mm' } },
      p: { value: 1e-4, min: 1e-5, max: 3, log: true, label: 'Chamber pressure <i>p</i>', format: pa },
      gas: { value: 'air', label: 'Gas in the chamber', options: { air: 'Air (residual gas)', Ar: 'Ar (sputtering gas)' } },
      rpos: { value: 0.9, min: 0, max: 1, step: 0.01, label: 'Position of the zoomed step (fraction of the wafer radius)', format: x => `${fmt.num(100 * x, 0)} %`, group: 'Lift-off step' },
      s: { value: 2, min: 0.5, max: 5, step: 0.1, label: 'Resist step height <i>s</i>', format: um, group: 'Lift-off step' },
    },
    layers: { other: false, rays: true },
    explore: { show: ['other'] },

    derived: v => {
      const n = SRC[v.src].n, R = +v.D / 20;                                    // wafer radius in cm
      const lam = PV.meanFreePath(v.p, PV.GAS[v.gas].d);
      const r = v.rpos * R;
      return { n, R, lam, f0: PV.unscattered(v.h, lam), tEdge: PV.thickness(R, v.h, n), nonU: PV.nonUniformity(R, v.h, n),
        h5: PV.distanceFor(R, n, 0.95), lamTxt: lam >= 100 ? `${fmt.sig(lam / 100, 2)}\\ \\mathrm{m}` : lam >= 1 ? `${fmt.sig(lam, 2)}\\ \\mathrm{cm}` : `${fmt.sig(lam * 10, 2)}\\ \\mathrm{mm}`,
        collected: R * R / (R * R + v.h * v.h), theta: PV.incidence(r, v.h), off: PV.shadow(v.s, r, v.h), rz: r };
    },

    tex: [
      { at: [0, 3.42], tex: '\\frac{t(r)}{t(0)} = \\left[1 + (r/h)^2\\right]^{-(n+3)/2},\\qquad \\lambda = \\frac{k_B T}{\\sqrt2\\,\\pi d^2 p} = {{lamTxt}}', size: 0.33 },
    ],

    draw(p, v, w) {
      // ---------------------------------------------------------- chamber, to scale
      const CX = -4.0, Ybot = -2.75, Ytop = 2.6, Wmax = 4.2;
      const k = Math.min((Ytop - Ybot - 0.75) / v.h, w.smooth('kD', Wmax / (2 * v.R), { log: true }));   // units per cm; the wafer never leaves the chamber
      const ySrc = Ybot + 0.35, yW = ySrc + v.h * k, half = v.R * k;
      p.box(CX - 2.75, Ybot, CX + 2.75, Ytop + 0.05, { stroke: C.greyB, width: 2, radius: 0.1 });
      p.text('vacuum chamber (to scale)', CX - 2.65, Ytop - 0.16, { size: 0.19, color: C.muted });
      // wafer and holder
      p.box(CX - half, yW, CX + half, yW + 0.07, { fill: MAT_SI(), stroke: null });
      p.text(`wafer: ${v.D} mm`, CX + 2.65, Ytop - 0.16, { size: 0.19, align: 'right', color: C.text });
      // source
      p.box(CX - 0.28, ySrc - 0.22, CX + 0.28, ySrc, { fill: C.greyD, stroke: C.greyB, width: 1.5 });
      p.ellipse(CX, ySrc, 0.22, 0.05, { fill: C.gold, stroke: null });
      p.text(v.src === 'point' ? 'point source' : 'crucible', CX + 0.4, ySrc - 0.1, { size: 0.19, color: C.text });
      // distance h
      p.dim(CX - half - 0.35, ySrc, CX - half - 0.35, yW, '');
      p.place(`h = ${cm(v.h)}`, [[CX - half - 0.45, (ySrc + yW) / 2, 'right'], [CX - half - 0.25, (ySrc + yW) / 2, 'left'], [CX - half - 0.25, ySrc + 0.3, 'left'], [CX - half - 0.45, ySrc + 0.3, 'right']], { size: 0.2, color: C.greyA, within: [CX - 2.75, Ybot, CX + 2.75, Ytop], key: 'hdim' });
      // molecule paths: straight between collisions, free paths −λ·ln u (fixed u), random new directions
      p.layer('rays', () => p.clip(CX - 2.73, Ybot + 0.02, CX + 2.73, yW, () => {
        RAYS.forEach((ray, i) => {
          const xt = CX + half * (i / (RAYS.length - 1) * 2 - 1);
          let x = CX, y = ySrc, dx = xt - CX, dy = yW - ySrc;
          const L0 = Math.hypot(dx, dy); dx /= L0; dy /= L0;
          const pts = [[x, y]];
          let left = L0 / k;                                                     // cm to the wafer along the straight path
          for (let j = 0; j < 4; j++) {
            const free = -v.lam * Math.log(ray.u[j]);
            if (free >= left) { pts.push([x + dx * left * k, y + dy * left * k]); break; }
            x += dx * free * k; y += dy * free * k; pts.push([x, y]);
            const a = ray.a[j] * 2 * Math.PI; dx = Math.cos(a); dy = Math.sin(a); left = 1e9;   // after a collision: anywhere
            if (j === 3) pts.push([x + dx * v.lam * k, y + dy * v.lam * k]);
          }
          p.path(pts, { color: C.gold, width: 1.6, alpha: 0.75, noOcc: true });
        });
      }));
      p.text(`${PV.GAS[v.gas].name} at ${pa(v.p)}: λ = ${cm(v.lam)}`, CX, Ybot - 0.25, { size: 0.2, align: 'center', color: C.text });

      // ---------------------------------------------------------- thickness across the wafer
      const ax = p.axes({ x: 1.05, y: 0.55, w: 5.55, h: 2.2, xr: [-v.R, v.R], yr: [0, 1.05], grid: true, size: 0.2, nticks: 5,
        yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: y => fmt.num(y, 2), xlabel: 'position on the wafer r (cm)', ylabel: 't / t(0)', ylabelOffset: 0.75 }).draw();
      const other = v.src === 'point' ? 1 : 0;
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        p.layer('other', () => ax.plot(r => PV.thickness(Math.abs(r), v.h, other), { color: C.grey, width: 2.2, dash: [0.1, 0.07] }));
        ax.hline(1, { color: C.muted, dash: [0.04, 0.07] });
        ax.plot(r => PV.thickness(Math.abs(r), v.h, v.n), { color: C.yellow, width: 4 });
      });
      ax.dot(v.rz, PV.thickness(v.rz, v.h, v.n), { r: 0.08 });
      const legRows = p.vis('other') > 0.01 ? 2 : 1, legW = 0.66 + Math.max(...[SRC.point.name, SRC.knudsen.name].map(t => p.measure(t, 0.17))), legH = 0.24 + 0.2465 * legRows - 0.0595;
      ax.legend([
        { label: SRC[v.src].name, color: C.yellow, width: 4 },
        { label: SRC[v.src === 'point' ? 'knudsen' : 'point'].name, color: C.grey, textColor: C.greyA, dash: [0.1, 0.07], alpha: p.vis('other') },
      ], { at: [ax.x + (ax.w - legW) / 2, ax.y + 0.08 + legH], size: 0.17 });

      ax.place(`edge: ${pct(v.tEdge)}`, [[ax.X(v.R) - 0.08, ax.Y(v.tEdge) - 0.12, 'right', 'top'], [ax.X(v.R) - 0.08, ax.Y(v.tEdge) + 0.12, 'right', 'bottom'], [ax.X(-v.R) + 0.08, ax.Y(v.tEdge) - 0.12, 'left', 'top'], [ax.X(v.R) - 0.08, ax.y + 0.1, 'right', 'bottom'], [ax.X(-v.R) + 0.08, ax.y + 0.1, 'left', 'bottom']],
        { color: C.yellow, size: 0.19, key: 'edge' });

      // ---------------------------------------------------------- zoom: lift-off step at position r
      const ZX0 = 1.05, ZX1 = 6.6, ZYs = -2.15, sk = 0.24;                  // substrate surface, units per µm (5 µm step → 1.2)
      const zTop = -0.55;
      p.text(`lift-off resist step at r = ${cm(v.rz)} (zoomed; step and offset to scale)`, ZX0, -3.1, { size: 0.19, color: C.greyA });
      p.material('si', ZX0, -2.85, ZX1, ZYs, { stroke: null });
      const rh = v.s * sk, gap0 = 3.0, gap1 = 4.6, uc = 0.22;                // opening, undercut of the lower layer
      // resist: upper layer overhangs a recessed lower layer (bilayer lift-off profile)
      for (const [a, b, sgn] of [[ZX0, gap0, 1], [gap1, ZX1, -1]]) {
        const edge = sgn > 0 ? b : a;
        p.materialPoly('resist', [[a, ZYs + rh * 0.45], [a, ZYs + rh], [b, ZYs + rh], [b, ZYs + rh * 0.45]], { stroke: null });
        const inner = edge - sgn * uc;
        p.materialPoly('resist', sgn > 0 ? [[a, ZYs], [a, ZYs + rh * 0.45], [inner, ZYs + rh * 0.45], [inner, ZYs]] : [[inner, ZYs], [inner, ZYs + rh * 0.45], [b, ZYs + rh * 0.45], [b, ZYs]], { stroke: null });
      }
      // deposit: directional part shifted by the shadow offset; scattered part also coats the sidewalls
      const tf = 0.12, offU = v.off * sk;                                    // film thickness drawn, offset in units
      const film = { fill: MAT_METAL(), stroke: null };
      p.box(ZX0, ZYs + rh, gap0, ZYs + rh + tf, film); p.box(gap1, ZYs + rh, ZX1, ZYs + rh + tf, film);
      const x0 = Math.max(gap0 - uc, gap0 + offU), x1 = Math.min(gap1 + uc, gap1 + offU);
      if (x1 > x0) p.box(x0, ZYs, x1, ZYs + tf, film);
      const fs = 1 - v.f0;                                                    // scattered fraction → sidewall coverage
      if (fs > 0.02) p.alpha(Math.min(1, fs * 1.2), () => {
        p.box(gap0 - uc - 0.001, ZYs, gap0 - uc + 0.05, ZYs + rh * 0.45, film); p.box(gap1 + uc - 0.05, ZYs, gap1 + uc + 0.001, ZYs + rh * 0.45, film);
        p.box(gap0, ZYs + rh * 0.45, gap0 + 0.05, ZYs + rh, film); p.box(gap1 - 0.05, ZYs + rh * 0.45, gap1, ZYs + rh, film);
        p.box(gap0 - uc, ZYs, x0, ZYs + tf, film); p.box(x1, ZYs, gap1 + uc, ZYs + tf, film);
      });
      // incoming direction
      const th = v.theta * Math.PI / 180, ax0 = (gap0 + gap1) / 2;
      const yB = ZYs + rh + tf + 0.1, yA = yB + 0.6;
      p.arrow(ax0 - Math.tan(th) * (yA - yB), yA, ax0, yB, { color: C.gold, width: 2.5, head: 0.14 });
      p.place(`θ = ${fmt.num(v.theta, 1)}°, shadow ${um(v.off)}`, [[ZX1 - 0.08, -0.45, 'right'], [ZX1 - 0.08, -0.75, 'right'], [ZX0 + 0.08, -0.45, 'left']], { size: 0.19, color: C.gold, key: 'theta' });
      p.text(fs < 0.05 ? 'film breaks at the overhang – lift-off works' : fs < 0.5 ? 'sidewalls partly coated – lift-off at risk' : 'sidewalls coated – lift-off fails',
        ZX0 + 0.08, -2.62, { size: 0.19, color: fs < 0.05 ? C.green : fs < 0.5 ? C.gold : C.red, bold: true, bg: true });
    },

    readout: v => MFW.chars([
      ['edge thickness', 't(R)/t(0)', pct(v.tEdge), undefined, { hl: true, note: `non-uniformity ${pct(v.nonU)}` }],
      ['distance for ±5 % (edge ≥ 95 %)', '', cm(v.h5)],
      [`mean free path (${PV.GAS[v.gas].name}, 20 °C)`, 'λ', cm(v.lam)],
      ['atoms arriving without a gas collision', '', pct(v.f0), undefined, { f: 'e<sup>−h/λ</sup>' }],
      ['angle of incidence at the zoomed step', 'θ', fmt.num(v.theta, 1), '°'],
      ['shadow offset', '', um(v.off), undefined, { f: 's·tan θ' }]]),

    steps: [
      { name: 'Line of sight', caption: 'In a high vacuum atoms fly straight from the source to the wafer', set: { src: 'knudsen', h: 40, D: '100', p: 1e-4, gas: 'air', rpos: 0.9, s: 2 }, duration: 1.5,
        text: v => `In an evaporator the source material is heated (resistively or by an electron beam) until it evaporates, and the vapour condenses on the wafer above it. At ${pa(v.p)} the mean free path of the gas molecules is λ = ${cm(v.lam)} – far longer than the ${cm(v.h)} to the wafer, so ${pct(v.f0)} of the atoms arrive without a single collision, along straight lines from the source.` },
      { name: 'Thinner towards the edge', caption: 't/t(0) = [1 + (r/h)²]⁻² for a small surface source', set: { h: 15 }, duration: 2.5,
        text: v => `A point on the wafer at radius r is farther from the source and sees it at a slant, so it collects less: for a small flat source that emits ∝ cos φ (Knudsen's cosine law) t/t(0) = [1 + (r/h)²]⁻². With the wafer only ${cm(v.h)} above the source the edge of a ${v.D} mm wafer gets just ${pct(v.tEdge)} of the centre thickness.` },
      { name: 'Point or surface source', caption: 'The emission pattern changes the exponent', show: ['other'], duration: 1,
        text: v => `An ideal point source emits equally in all directions and gives t/t(0) = [1 + (r/h)²]^(−3/2) – a little more uniform than the cosine source (dashed grey). Real crucibles and e-beam hearths are closer to the cosine source or even more forward-directed.` },
      { name: 'Distance buys uniformity', caption: 'Larger h → more uniform, but most of the vapour misses the wafer', set: { h: 60 }, duration: 2.5,
        text: v => `Moving the wafer away flattens the distribution: at ${cm(v.h)} the edge gets ${pct(v.tEdge)}; ±5 % needs h ≥ ${cm(v.h5)}. The price: a cosine source sends only R²/(R² + h²) = ${pct(v.collected)} of its vapour onto the wafer. Production evaporators therefore put many wafers on a large spherical dome (planetary): with the source on the same sphere, the cosine law gives the same thickness everywhere on it (Knudsen; Ohring eq. 3-20).` },
      { name: 'Pressure and mean free path', caption: 'λ = kT/(√2·π·d²·p): at sputtering pressures atoms collide on the way', set: { p: 0.5, gas: 'Ar' }, duration: 2.5,
        text: v => `The mean free path is inversely proportional to the pressure. Sputtering runs a glow discharge in argon at a few to 100 mTorr (about 0.5–13 Pa; Ohring 1992); at ${pa(v.p)} λ = ${cm(v.lam)}, much shorter than the ${cm(v.h)} path, and only ${pct(v.f0)} of the atoms arrive without a collision. They reach the wafer from many directions – the deposition is no longer line of sight.` },
      { name: 'Shadowing and lift-off', caption: 'Directional deposition leaves the resist sidewalls bare', set: { p: 1e-4, gas: 'air', rpos: 1, h: 40 }, duration: 2,
        text: v => `For lift-off the metal is evaporated onto a patterned resist with an overhanging (undercut) edge, and the resist is then dissolved, taking the metal on top with it. That works only if the film is interrupted at the resist edge – line-of-sight evaporation does that. At the wafer edge the atoms arrive at θ = ${fmt.num(v.theta, 1)}°, so the deposit is shifted by s·tan θ = ${um(v.off)} behind a ${um(v.s)} step. Raise the pressure (or think of sputtering): scattered atoms coat the sidewalls too, and lift-off fails.` },
      { name: 'Your turn', caption: 'Find a geometry that is both uniform and directional', duration: 1,
        text: 'Switch to <b>Explore</b>: choose the source, the distance and the wafer size for ±5 % uniformity, then check how low the pressure must be for straight-line transport, and how large the shadow is at the wafer edge.' },
    ],
  });

  function MAT_SI() { return MFW.MAT.si.fill; }
  function MAT_METAL() { return MFW.MAT.gold.fill; }
}());
