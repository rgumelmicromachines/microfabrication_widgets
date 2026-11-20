/* Dopant segregation during Czochralski growth (Scheil / normal-freezing equation).
   Topic: substrates. */
(function () {
  const { C, M, fmt, mix } = MFW;
  const { K_SEG, NAMES, CL, CS } = MFW_SEG;

  // colour intensity of a slice / of the melt for a concentration c (in units of C0), log scale 0.01…10
  const shade = c => M.clamp(0.12 + 0.88 * ((Math.log10(c) + 2) / 3) ** 2, 0.12, 1);
  const dopColor = d => (d === 'B' ? C.red : C.blue);       // p-type red, n-type blue (site convention)

  MFW.widget('#app', {
    title: 'Dopant segregation in Czochralski growth',
    alt: v => `Czochralski growth of silicon doped with ${NAMES[v.dop]} (k = ${fmt.num(v.k, 3)}). ${fmt.num(100 * v.f, 0)} % of the melt has solidified; the melt is at ${fmt.num(v.cl, 2)} C0, the crystal now growing at ${fmt.num(v.cs, 3)} C0, i.e. ${fmt.num(v.cl, 2)} times the seed end.`,
    source: 'Scheil (normal-freezing) equation with equilibrium segregation coefficients k<sub>0</sub> at the melting point of Si: F. A. Trumbore, Bell Syst. Tech. J. 39 (1960) 205; tabulated in J. D. Plummer, M. D. Deal, P. B. Griffin, <i>Silicon VLSI Technology</i> (Prentice Hall 2000), ch. 3. Assumes a perfectly mixed melt, no evaporation and k independent of concentration. The effective k in a real puller is closer to 1 (boundary layer; Burton, Prim &amp; Slichter, J. Chem. Phys. 21 (1953) 1987). Ingot and crucible are schematic, not to scale.',
    freeText: v => `Explore – pick a dopant and drag the pull progress <i>f</i>. With ${NAMES[v.dop]} (k = ${fmt.num(v.k, 3)}) the end of the ingot is ${fmt.sig(v.cl, 2)}× more doped than the seed end at the current <i>f</i>.`,

    params: {
      dop: { value: 'P', label: 'Dopant', options: { B: 'Boron (B), k₀ = 0.8', P: 'Phosphorus (P), k₀ = 0.35', As: 'Arsenic (As), k₀ = 0.3', Sb: 'Antimony (Sb), k₀ = 0.023' } },
      f: { value: 0, min: 0, max: 0.95, step: 0.01, label: 'Solidified fraction <i>f</i> (pull progress)', digits: 2 },
    },
    layers: { reject: false, melt: false, ratio: false, others: false },
    explore: { show: ['melt', 'ratio'] },

    derived(v) {
      const k = K_SEG[v.dop];
      return { k, cl: CL(k, v.f), cs: CS(k, v.f), left: (1 - v.f) ** k };
    },

    tex: [
      { at: [0, 3.45], tex: 'C_s = k_0\\,C_0\\,(1-f)^{k_0-1}\\qquad \\frac{C_s}{C_0} = {{k:3}}\\cdot(1-{{f}})^{\\,{{k:3}}-1} = {{cs:3}}', size: 0.42 },
      { at: [3.75, 2.62], tex: '\\frac{C_s(f)}{C_s(0)} = {{cl:2}}', size: 0.34, color: 'yellow', layer: 'ratio' },
    ],

    draw(p, v) {
      const colr = dopColor(v.dop), bg = C.bg;
      const yBot = -2.45, yMelt = yBot + 2.0 * (1 - v.f);           // melt level drops as it is consumed
      // crucible
      p.box(-6.05, -2.6, -5.9, -0.15, { fill: C.greyD, stroke: C.greyB });
      p.box(-2.5, -2.6, -2.35, -0.15, { fill: C.greyD, stroke: C.greyB });
      p.box(-6.05, -2.6, -2.35, yBot, { fill: C.greyD, stroke: C.greyB });
      p.box(-5.9, yBot, -2.5, yMelt, { fill: colr, stroke: null, fillAlpha: shade(v.cl) * 0.85 });
      p.text('melt', -6.2, yBot + 0.2, { size: 0.24, color: C.greyA, align: 'right' });

      // ingot: slices coloured by the concentration they froze with
      const yTop = yMelt + 4.0 * v.f, N = 48, h = (yTop - yMelt) / N;
      for (let i = 0; i < N && v.f > 0; i++) {
        const fSlice = (i + 0.5) / N * v.f;                         // slice i froze at this f (i = 0 is the seed end)
        p.box(-4.75, yTop - i * h, -3.65, yTop - (i + 1) * h - 0.004, { fill: mix(bg, colr, shade(CS(v.k, fSlice))), stroke: null });
      }
      if (v.f > 0) p.box(-4.75, yMelt, -3.65, yTop, { stroke: C.greyB, width: 1.5 });
      p.line(-4.2, yTop, -4.2, 2.55, { color: C.greyB, width: 2 });
      p.box(-4.35, yTop, -4.05, yTop + 0.25, { fill: C.greyB, stroke: null });
      p.text('seed', -3.95, yTop + 0.13, { size: 0.22, color: C.muted });
      if (v.f > 0.12) {
        p.text('seed end', -3.5, yTop - 0.15, { size: 0.22, color: C.muted });
        p.text('tail end', -3.5, yMelt + 0.18, { size: 0.22, color: C.muted });
      }

      p.layer('reject', () => {
        p.text('rejected dopant', -1.95, yMelt + 0.05, { size: 0.24, color: C.text, align: 'left' });
        p.arrow(-4.85, yMelt - 0.12, -5.6, yMelt - 0.12, { color: C.text, width: 2 });
        p.arrow(-3.55, yMelt - 0.12, -2.8, yMelt - 0.12, { color: C.text, width: 2 });
      });

      // plot
      const ax = p.axes({ x: 1.1, y: -2.75, w: 5.3, h: 4.75, xr: [0, 1], yr: [0.01, 10], ylog: true, size: 0.26,
        xlabel: 'solidified fraction f', ylabel: 'concentration / C₀  (log scale)', grid: true, ylabelOffset: 1.0 }).draw();
      p.layer('others', () => {
        // the other dopants up to f = 0.9; labels right of the plot, spread so they never overlap, with leader lines
        const items = Object.keys(K_SEG).filter(n => n !== v.dop).map(n => ({ n, k: K_SEG[n], y: ax.Y(CS(K_SEG[n], 0.9)) }));
        items.forEach(it => ax.plot(f => CS(it.k, f), { to: 0.9, color: C.grey, width: 2, dash: [0.1, 0.08] }));
        items.sort((a, b) => a.y - b.y);
        const gap = 0.3;
        items.forEach((it, i) => { it.ly = i ? Math.max(it.y, items[i - 1].ly + gap) : it.y; });
        const over = items.length ? items[items.length - 1].ly - (ax.y + ax.h) : 0;
        if (over > 0) items.forEach(it => { it.ly -= over; });
        const xl = ax.X(0.95) + 0.17;
        items.forEach(it => {
          p.line(ax.X(0.9) + 0.05, it.y, xl - 0.05, it.ly, { color: C.grey, width: 1.2 });
          p.text(`${it.n} ${fmt.sig(CL(it.k, 0.9), 2)}×`, xl, it.ly, { color: C.muted, size: 0.2 });
        });
      });
      p.layer('melt', () => {
        ax.plot(f => CL(v.k, f), { to: v.f, color: C.teal, width: 3 });
        if (v.cl <= 10) ax.dot(v.f, v.cl, { r: 0.09, color: C.teal });
        ax.text('melt  C_L', 0.03, 6.2, { color: C.teal, size: 0.26 });
      });
      ax.plot(f => CS(v.k, f), { to: v.f, color: C.yellow, width: 4.5 });
      if (v.cs <= 10) ax.dot(v.f, v.cs, { r: 0.1 });
      ax.text('crystal  C_s', 0.03, 3.4, { color: C.yellow, size: 0.26 });
      p.layer('ratio', () => {
        ax.hline(v.k, { to: v.f, color: C.muted });
        if (v.f > 0.02) p.dim(ax.X(v.f) + 0.12, ax.Y(v.k), ax.X(v.f) + 0.12, ax.Y(v.cs), '', { color: C.yellow });
      });
    },

    readout: v => `<table>
      <tr><td>segregation coefficient k₀</td><td>${fmt.num(v.k, 3)}</td></tr>
      <tr><td>melt C<sub>L</sub>/C₀</td><td>${fmt.num(v.cl, 2)}</td></tr>
      <tr><td>crystal at interface C<sub>s</sub>/C₀</td><td><b class="hl">${fmt.num(v.cs, 3)}</b></td></tr>
      <tr><td>dopant still in the melt</td><td>${fmt.num(100 * v.left, 0)} %</td></tr>
      <tr><td>tail / seed concentration</td><td>${fmt.sig(v.cl, 3)}×</td></tr></table>`,

    // The tour never changes the dopant: pick one in the menu and the whole story is told for it.
    steps: [
      { name: 'Starting melt', caption: 'The melt holds the dopant at concentration C_0', set: { f: 0 }, duration: 1,
        text: v => `The silicon melt contains ${NAMES[v.dop]} at concentration C₀. The seed has just touched the surface; no crystal has grown yet. (Change the dopant in the menu below at any time – the tour adapts.)` },
      { name: 'The interface', caption: v => `The crystal accepts only k₀·C_L = ${fmt.num(v.k, 3)}·C_L`, set: { f: 0.05 }, show: ['reject'],
        text: v => `At the growth interface the crystal accepts only k₀ times the melt concentration – for ${NAMES[v.dop]} k₀ = ${fmt.num(v.k, 3)}, so the first slice gets ${fmt.num(v.k, 3)} C₀. The rest is <b>rejected</b> back into the melt, which is stirred by crystal and crucible rotation.` },
      { name: 'Pulling the ingot', caption: 'Each new slice is richer in dopant than the previous one', set: { f: 0.5 }, duration: 3,
        text: 'As the ingot grows, every new slice contains more dopant than the one before, while the seed end no longer changes (diffusion in the solid is negligible). Why does the crystal take up more and more dopant?' },
      { name: 'The melt', caption: 'Rejected dopant accumulates in the shrinking melt', show: ['melt'],
        text: 'The rejected dopant stays in a melt that keeps shrinking, so its concentration C<sub>L</sub> rises (teal curve). The crystal always takes k₀·C<sub>L</sub>, so on the log axis both curves run parallel – a constant distance |log k₀| apart, i.e. a constant factor k₀.' },
      { name: 'Tail of the ingot', caption: v => `At f = 0.9 the tail is ${fmt.sig(v.cl, 2)}× more doped than the seed end`, set: { f: 0.9 }, show: ['ratio'], duration: 3,
        text: v => `Near the end only 10 % of the melt is left, yet it still holds ${fmt.num(100 * v.left, 0)} % of the dopant. The tail is therefore ${fmt.sig(v.cl, 2)}× more doped than the seed end, and wafer resistivity differs by roughly the same factor – which is why wafers are sorted by resistivity along the ingot.` },
      { name: 'Compare dopants', caption: 'The smaller k₀, the stronger the rise along the ingot', show: ['others'],
        text: v => `Grey dashed: the other dopants at f = 0.9. Boron (k₀ = 0.8) rises only 1.6×, antimony (k₀ = 0.023) 9.5×. The closer k₀ is to 1, the more uniform the ingot – a practical advantage of boron for p-type CZ wafers. Now switch to <b>Explore</b> and try them yourself.` },
    ],
  });
}());
