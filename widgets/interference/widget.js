/* Interference colours of a transparent film on silicon and the reflectance spectrum behind them
   (basis of reflectometry). Topic: characterization. */
(function () {
  const { C, M, fmt, MAT } = MFW;
  const TF = MFW_TF, OX = MFW_OX;
  const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const nmS = x => `${fmt.num(x, 0)} nm`;
  const deg = x => `${fmt.num(x, 0)}°`;
  const pct = x => `${fmt.num(100 * x, 1)} %`;
  const LAM = M.linspace(400, 700, 151);
  /** Screen colour of monochromatic light (CIE 1931 → sRGB, normalised, out-of-gamut parts clipped) – for the rainbow bar only. */
  const spectral = l => {
    const X = OX.cmf.xbar(l), Y = OX.cmf.ybar(l), Z = OX.cmf.zbar(l);
    const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z].map(u => Math.max(0, u));
    const m = Math.max(...lin, 1e-6);
    return lin.map(u => Math.round(255 * (u / m) ** (1 / 2.2)));
  };
  const RAINBOW = M.linspace(400, 700, 76).map(l => css(spectral(l)));

  // colour strips are recomputed only when what they depend on changes
  const D_MAX = 1000, N_D = 251, TH_MAX = 75, N_TH = 76;
  let chartKey = '', chart = [], angKey = '', ang = [];
  const chartFor = (film, theta) => { const k = film + theta; if (k !== chartKey) { chartKey = k; chart = M.linspace(0, D_MAX, N_D).map(d => css(TF.rgb(film, d, theta))); } return chart; };
  const angFor = (film, d) => { const k = film + d; if (k !== angKey) { angKey = k; ang = M.linspace(0, TH_MAX, N_TH).map(t => css(TF.rgb(film, d, t))); } return ang; };

  MFW.widget('#app', {
    title: 'Interference colours of thin films',
    alt: v => `${nmS(v.d)} of ${TF.FILMS[v.film].name} on silicon viewed at ${deg(v.theta)}: reflectance spectrum between 400 and 700 nm with ${v.ex.min.length} minima${v.ex.min.length ? ' (at ' + v.ex.min.map(e => nmS(e.lambda)).join(', ') + ')' : ''}; the film looks ${v.hex}.`,
    source: 'Reflectance of air / film / silicon from the Airy summation with Fresnel coefficients for both polarisations (Born &amp; Wolf, <i>Principles of Optics</i>; Hecht, <i>Optics</i>), unpolarised light. Optical constants: SiO₂ – Malitson 1965; Si₃N₄ – Sellmeier fit of Bååk 1982 to the data of Philipp 1973; Si (n, k) – Green 2008. Colour: CIE 1931 observer (fit of Wyman et al. 2013), daylight, shown brightened as a camera would; screen colours are approximate. The ray sketch is schematic.',
    freeText: v => `Explore – grow the film and watch the colour run through the chart, then tilt the wafer. At ${nmS(v.d)} the path difference at 550 nm is ${fmt.num(v.opd / 550, 2)} wavelengths.`,

    params: {
      film: { value: 'sio2', label: 'Film', options: { sio2: 'SiO₂ (n ≈ 1.46)', si3n4: 'Si₃N₄ (n ≈ 2.0)' } },
      d: { value: 100, min: 0, max: D_MAX, step: 1, label: 'Film thickness <i>d</i>', format: nmS },
      theta: { value: 0, min: 0, max: TH_MAX, step: 1, label: 'Viewing angle <i>θ</i>₀ (from the normal)', format: deg },
    },
    layers: { orders: false, bare: false },
    explore: { show: ['orders', 'bare'] },

    derived(v) {
      const n550 = TF.FILMS[v.film].n(550), st = TF.stack(v.film, v.d, 550, v.theta);
      const rgb = TF.rgb(v.film, v.d, v.theta);
      return {
        n550, cos1: st.cos1, opd: 2 * n550 * v.d * st.cos1, R550: st.R,
        Rs: LAM.map(l => TF.reflectance(v.film, v.d, l, v.theta)), R0: LAM.map(l => TF.reflectance(v.film, 0, l, v.theta)),
        ex: TF.extrema(v.film, v.d, v.theta), rgb, hex: '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join(''),
        Ylum: OX.xyzOf(l => TF.reflectance(v.film, v.d, l, v.theta))[1],
        period: 550 / (2 * n550 * st.cos1), qw: TF.quarterWave(v.film, 550),
      };
    },

    tex: [
      { at: [3.75, 3.42], tex: '\\text{minima of } R:\\quad 2\\,n_1 d\\cos\\theta_1 = \\left(m+\\tfrac12\\right)\\lambda', size: 0.3 },
    ],

    draw(p, v) {
      const name = TF.FILMS[v.film].name;
      // ---------------------------------------------------------- ray sketch (schematic)
      const bx0 = -6.85, bx1 = -3.55, yF = 1.95, yI = 1.45, yS = 1.0;
      p.text(`two reflections interfere (schematic), θ_0 = ${deg(v.theta)}`, bx0, 3.5, { size: 0.2, color: C.muted });
      p.material('si', bx0, yS, bx1, yI, { stroke: null });
      p.material(v.film, bx0, yI, bx1, yF, { stroke: null });
      p.line(bx0, yF, bx1, yF, { color: MAT[v.film].stroke, width: 1.5 });
      p.line(bx0, yI, bx1, yI, { color: MAT.si.stroke, width: 1.5 });
      p.text(name, bx0 + 0.1, (yF + yI) / 2, { size: 0.2, color: C.text });
      p.text('Si', bx0 + 0.1, (yI + yS) / 2, { size: 0.2, color: C.text });
      const thD = Math.max(v.theta, 10) * Math.PI / 180;                    // drawn with a small tilt at normal incidence, so the rays do not coincide
      const s0 = Math.sin(thD), c0 = Math.cos(thD), t1 = Math.asin(s0 / v.n550), L = 1.2, xa = -5.65;
      const xb = xa + (yF - yI) * Math.tan(t1), xc = xa + 2 * (yF - yI) * Math.tan(t1);
      p.arrow(xa - L * s0, yF + L * c0, xa, yF, { color: C.text, width: 2.5, head: 0.16 });
      p.arrow(xa, yF, xa + L * s0, yF + L * c0, { color: C.yellow, width: 2.5, head: 0.16 });
      p.path([[xa, yF], [xb, yI], [xc, yF]], { color: C.teal, width: 2.5 });
      p.arrow(xc, yF, xc + L * s0, yF + L * c0, { color: C.teal, width: 2.5, head: 0.16 });
      p.line(xa, yF, xa, yF + 0.75, { color: C.muted, width: 1, dash: [0.04, 0.05] });
      p.text('1', xa + (L - 0.12) * s0 - 0.17 * c0, yF + (L - 0.12) * c0 + 0.17 * s0, { size: 0.2, color: C.yellow, align: 'center' });   // beside the tip, on the outer side of each ray
      p.text('2', xc + (L - 0.12) * s0 + 0.17 * c0, yF + (L - 0.12) * c0 - 0.17 * s0, { size: 0.2, color: C.teal, align: 'center' });

      // ---------------------------------------------------------- the wafer as the eye sees it
      const cx = -2.15, cy = 2.3, R = 1.15, ry = R * Math.cos(v.theta * Math.PI / 180);
      p.ellipse(cx, cy, R, ry, { fill: css(v.rgb), stroke: C.greyB, width: 2 });
      p.text(`${nmS(v.d)} ${name} at ${deg(v.theta)}`, cx, cy - R - 0.2, { size: 0.2, align: 'center', color: C.text });

      // ---------------------------------------------------------- colour chart: thickness
      const sx0 = -6.75, sx1 = -0.85, sw = sx1 - sx0;
      const strip = (cols, y0, y1, frac, ticks, tfmt, title) => {
        const dx = sw / cols.length;
        cols.forEach((c, i) => p.box(sx0 + i * dx, y0, Math.min(sx1, sx0 + (i + 1.6) * dx), y1, { fill: c, stroke: null, noOcc: true }));
        p.box(sx0, y0, sx1, y1, { stroke: C.axis, width: 1.2 });
        for (const t of ticks) {
          const x = sx0 + sw * t.u;
          p.line(x, y0, x, y0 - 0.07, { color: C.axis, width: 1.2 });
          p.text(tfmt(t.v), x, y0 - 0.22, { size: 0.17, align: 'center', color: C.muted });
        }
        const xm = sx0 + sw * frac;
        p.polygon([[xm, y1 + 0.02], [xm - 0.09, y1 + 0.17], [xm + 0.09, y1 + 0.17]], { fill: C.text, stroke: null });
        p.line(xm, y0, xm, y1, { color: C.text, width: 1.5, noOcc: true });
        p.text(title, sx0, y1 + 0.33, { size: 0.19, color: C.muted });
      };
      strip(chartFor(v.film, v.theta), -0.3, 0.3, v.d / D_MAX, [0, 200, 400, 600, 800, 1000].map(x => ({ u: x / D_MAX, v: x })), x => (x === 1000 ? '1000 nm' : String(x)),
        `colour chart: ${name} thickness, viewed at ${deg(v.theta)}`);
      strip(angFor(v.film, v.d), -2.0, -1.4, v.theta / TH_MAX, [0, 15, 30, 45, 60, 75].map(x => ({ u: x / TH_MAX, v: x })), x => `${x}°`,
        `this film (${nmS(v.d)}) tilted from 0° to 75°`);
      p.text('colours for daylight, brightened; screens differ', sx0, -2.95, { size: 0.18, color: C.muted });

      // ---------------------------------------------------------- reflectance spectrum
      const ax = p.axes({ x: 1.05, y: -2.6, w: 5.45, h: 4.55, xr: [400, 700], yr: [0, 0.6], grid: true, size: 0.22,
        xticks: [400, 450, 500, 550, 600, 650, 700], yticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
        xlabel: 'wavelength λ (nm)', ylabel: 'reflectance R', ylabelOffset: 0.75 }).draw();
      const rb = ax.w / RAINBOW.length;
      RAINBOW.forEach((c, i) => p.box(ax.x + i * rb, ax.y + ax.h + 0.06, Math.min(ax.x + ax.w, ax.x + (i + 1.6) * rb), ax.y + ax.h + 0.2, { fill: c, stroke: null, noOcc: true }));
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        p.layer('bare', () => ax.curve(LAM, v.R0, { color: C.grey, width: 2.5, dash: [0.1, 0.07] }));
        ax.curve(LAM, v.Rs, { color: C.yellow, width: 4 });
      });
      p.layer('orders', () => {
        v.ex.min.slice(0, 6).forEach((e, i) => {
          const r = TF.reflectance(v.film, v.d, e.lambda, v.theta);
          const yd = ax.Y(Math.min(r, 0.6));
          p.line(ax.X(e.lambda), yd, ax.X(e.lambda), ax.y + ax.h, { color: C.teal, width: 1.2, dash: [0.04, 0.05] });
          ax.dot(e.lambda, Math.min(r, 0.6), { r: 0.07, color: C.teal });
          p.text(`m = ${e.m}`, Math.min(Math.max(ax.X(e.lambda), ax.x + 0.25), ax.x + ax.w - 0.25), ax.y + ax.h + 0.36, { color: C.teal, size: 0.17, align: 'center' });
        });
      });
      // legend above the plot (no curve can pass there)
      const ly = ax.y + ax.h + 0.66;
      p.line(ax.x, ly, ax.x + 0.4, ly, { color: C.yellow, width: 4 });
      p.text(`${name} on Si`, ax.x + 0.5, ly, { size: 0.19, color: C.text });
      p.alpha(p.vis('bare'), () => {
        p.line(ax.x + 2.0, ly, ax.x + 2.4, ly, { color: C.grey, width: 2.5, dash: [0.1, 0.07] });
        p.text('bare Si', ax.x + 2.5, ly, { size: 0.19, color: C.text });
      });
      p.alpha(p.vis('orders'), () => {
        p.dot(ax.x + 3.75, ly, { r: 0.07, color: C.teal });
        p.text('minima, order m', ax.x + 3.9, ly, { size: 0.19, color: C.text });
      });
    },

    readout: v => MFW.chars([
      ['colour on screen (sRGB)', '', `<span style="display:inline-block;width:1.1em;height:1.1em;vertical-align:-0.2em;border:1px solid currentColor;background:${v.hex}"></span> ${v.hex}`, '', { hl: true }],
      ['film index at 550 nm', 'n<sub>1</sub>', fmt.num(v.n550, 3)],
      ['angle inside the film', 'θ<sub>1</sub>', `${fmt.num(Math.acos(v.cos1) * 180 / Math.PI, 1)}°`, '', { f: 'sin θ<sub>0</sub> = n<sub>1</sub> sin θ<sub>1</sub>' }],
      ['path difference at 550 nm', '2n<sub>1</sub>d·cos θ<sub>1</sub>', nmS(v.opd), undefined, { note: `${fmt.num(v.opd / 550, 2)} λ` }],
      ['reflectance minima, 400–700 nm', '', v.ex.min.length ? v.ex.min.map(e => fmt.num(e.lambda, 0)).join(', ') + ' nm' : 'none', v.ex.min.length ? undefined : ''],
      ['reflectance maxima, 400–700 nm', '', v.ex.max.length ? v.ex.max.map(e => fmt.num(e.lambda, 0)).join(', ') + ' nm' : 'none', v.ex.max.length ? undefined : ''],
      ['reflectance at 550 nm', 'R', pct(v.R550)],
      ['reflected daylight (luminous)', 'Y', pct(v.Ylum)],
      ['same phase again after', 'Δd', nmS(v.period), undefined, { f: 'λ/(2n<sub>1</sub>cos θ<sub>1</sub>) at 550 nm' }],
      ['quarter-wave thickness, 550 nm', '', nmS(v.qw), undefined, { f: 'λ/(4n<sub>1</sub>)' }]]),

    steps: [
      { name: 'Why a clear film has a colour', caption: 'Light reflected at the top and at the bottom of the film interferes', set: { film: 'sio2', d: 100, theta: 0 }, duration: 1.5,
        text: v => `SiO₂ is as transparent as window glass, yet a wafer with ${nmS(v.d)} of oxide looks violet-blue. Part of the light is reflected at the surface of the film (ray 1), part at the silicon underneath (ray 2). Ray 2 travels an extra optical path 2·n₁·d = ${nmS(v.opd)}. Where the two rays are in step they add; where they are half a wave apart they cancel – for some colours more than for others.` },
      { name: 'The spectrum behind the colour', caption: 'Minima where the path difference is (m + ½)·λ', show: ['orders', 'bare'], set: { d: 300 }, duration: 2,
        text: v => `Both reflections are at a denser medium, so both flip the phase and the flips cancel out: the reflectance is lowest where 2·n₁·d = (m + ½)·λ, here at ${v.ex.min.map(e => nmS(e.lambda)).join(' and ')}. The maxima touch the curve of bare silicon (dashed) – a transparent film on a denser substrate can only remove light, never add any. This film takes out the yellow-orange, so the wafer looks blue.` },
      { name: 'Growing the film', caption: 'The colours repeat – each time a little paler', set: { d: 900 }, duration: 6,
        text: v => `As the film grows the minima move to longer wavelengths and new ones enter from the violet side: the colour runs through the chart and comes back about every ${nmS(v.period)} (Δd = λ/2n₁). At ${nmS(v.d)} there are already ${v.ex.min.length} minima in the visible range. With many narrow fringes every colour is removed a little, and the film turns pale pink and green – a single colour never identifies a thickness uniquely.` },
      { name: 'Tilting the wafer', caption: v => `At ${deg(v.theta)} the path difference shrinks by cos θ₁ – the colour shifts`, set: { d: 300, theta: 60 }, duration: 4,
        text: v => `Seen at an angle the extra path is 2·n₁·d·cos θ₁ – shorter, not longer, because the two rays leave the film at different points. Inside the film the light travels at only ${fmt.num(Math.acos(v.cos1) * 180 / Math.PI, 0)}° to the normal (Snell’s law), so the shift is moderate: the minima move towards the blue, as if the film were ${nmS(v.d * v.cos1)} thick. Colour charts are therefore read looking straight down.` },
      { name: 'A denser film', caption: 'Si₃N₄, n ≈ 2.0: colours cycle faster and are more vivid', set: { film: 'si3n4', d: 300, theta: 0 }, duration: 1.5,
        text: v => `Silicon nitride has n₁ = ${fmt.num(v.n550, 2)}. The same ${nmS(v.d)} now hold ${fmt.num(v.opd / 550, 1)} wavelengths of path difference instead of ${fmt.num(2 * TF.FILMS.sio2.n(550) * v.d / 550, 1)} in the oxide, so the colours repeat every ${nmS(v.period)}. The minima are also much deeper: the two reflected rays are nearly equal in strength when n₁ ≈ √n<sub>Si</sub> ≈ 2, and equal waves cancel completely.` },
      { name: 'Antireflection coating', caption: 'A quarter-wave nitride film: almost no reflection in the middle of the spectrum', set: { film: 'si3n4', d: 75, theta: 0 }, duration: 2.5,
        text: v => `At d = λ/(4n₁) the first minimum (m = 0) sits in the middle of the visible range: ${nmS(v.d)} of nitride reflects only ${pct(v.R550)} at 550 nm, where bare silicon reflects ${pct(TF.reflectance('si3n4', 0, 550))}. Only blue and deep red are still reflected – this is why silicon solar cells, which carry a silicon-nitride antireflection coating (Aberle 2001), look dark blue.` },
      { name: 'Reflectometry', caption: 'Measure the spectrum, count the fringes, get the thickness', set: { film: 'sio2', d: 1000, theta: 0 }, duration: 3,
        text: v => { const e = v.ex.min; return `A reflectometer turns this around: it measures R(λ) and finds the thickness that reproduces it. Two neighbouring minima are enough, because their orders differ by one: d = λ₁λ₂/[2(n₂λ₁ − n₁λ₂)]. Here the minima at ${e.length > 1 ? nmS(e[0].lambda) + ' and ' + nmS(e[1].lambda) : '…'} give ${e.length > 1 ? nmS(TF.thicknessFromPair(v.film, e[0].lambda, e[1].lambda)) : '…'}. The thicker the film, the more fringes and the better the fit; below about 70 nm of oxide no minimum is left in the visible range and the method has to rely on the absolute reflectance.`; } },
    ],
  });
}());
