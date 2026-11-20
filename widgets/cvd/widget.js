/* CVD / epitaxial growth rate: surface reaction vs gas-phase mass transport (Grove model).
   Topic: thin-film deposition. */
(function () {
  const { C, fmt } = MFW;
  const G = MFW_CVD;
  const invT = TC => 1000 / (TC + 273.15);                       // 10³/T in K⁻¹
  const cms = x => (x >= 100 ? `${fmt.sig(x, 3)} cm/s` : `${fmt.sig(x, 2)} cm/s`);
  const rateStr = V => (V >= 0.1 ? `${fmt.sig(V, 3)} µm/min` : `${fmt.sig(V * 1000, 3)} nm/min`);
  const regime = r => (r < 0.25 ? 'reaction-limited' : r > 4 ? 'transport-limited' : 'mixed (both matter)');
  const FAMILY = [1, 5, 10, Infinity];                             // h_G values of Grove's figure (1967)

  MFW.widget('#app', {
    title: 'CVD growth rate: reaction vs transport limit',
    alt: v => `Grove model at ${fmt.num(v.T, 0)} °C, h_G = ${cms(v.hG)}, Y = ${fmt.num(100 * v.Y, 2)} %: k_S = ${cms(v.ks)}, growth rate ${rateStr(v.V)}, ${regime(v.ratio)}.`,
    source: 'Grove model of CVD and epitaxial growth: two fluxes in series, F₁ = h_G(C_G − C_S) through the stagnant boundary layer and F₂ = k_S·C_S at the surface (A. S. Grove 1967). Surface reaction k_S = 1×10⁷ cm/s · exp(−1.9 eV/kT) for SiCl₄ + H₂ epitaxy (A. S. Grove, <i>Physics and Technology of Semiconductor Devices</i>, Wiley 1967). N₁ = 5×10²² Si atoms/cm³. C_T = p/kT, ideal gas at 1 atm and the substrate temperature. With these values the model reproduces Grove’s growth-rate curves for h_G = 1, 5, 10 cm/s and ∞ at Y = 0.005. h_G is taken as independent of temperature, as in Grove’s figure. SiCl₄ growth vs mole fraction: H. C. Theuerer, <i>J. Electrochem. Soc.</i> 108 (1961) 649.',
    freeText: v => `Explore – the slower of the two steps sets the rate. Here k_S = ${cms(v.ks)} and h_G = ${cms(v.hG)}: the process is <b>${regime(v.ratio)}</b>.`,

    params: {
      T: { value: 1150, min: 820, max: 1330, step: 5, label: 'Deposition temperature <i>T</i>', unit: '°C', digits: 0 },
      hG: { value: 5, min: 0.5, max: 50, log: true, label: 'Gas-phase mass-transfer coefficient <i>h</i>_G = <i>D</i>_G/δ', format: cms },
      Y: { value: 0.005, min: 0.001, max: 0.03, log: true, label: 'Mole fraction of the precursor <i>Y</i>', format: y => `${fmt.sig(100 * y, 2)} %` },
    },
    layers: { limits: false, family: false, tstar: false },
    explore: { show: ['limits', 'tstar'] },

    derived: v => G.growth(v),

    tex: [
      { at: [0, 3.42], tex: 'V = \\dfrac{k_S\\,h_G}{k_S + h_G}\\,\\dfrac{C_T\\,Y}{N_1},\\qquad k_S = {{ks:auto}}\\ \\mathrm{cm/s},\\quad h_G = {{hG:auto}}\\ \\mathrm{cm/s}', size: 0.33 },
    ],

    draw(p, v) {
      // ---------------------------------------------------------- reactor cross-section (schematic)
      const X0 = -6.8, X1 = -1.3, ys = -0.95;                                 // surface of the wafer
      const dH = 0.35 + 1.55 * (Math.log10(50) - Math.log10(v.hG)) / 2;        // boundary-layer height: δ = D_G/h_G (schematic)
      const yTop = 2.45;
      p.text('reactor cross-section (schematic)', (X0 + X1) / 2, 2.78, { size: 0.21, align: 'center', color: C.muted });
      // gas and boundary layer
      p.rect(X0, ys, X1 - X0, dH, { fill: C.blue, fillAlpha: 0.13, stroke: null });
      p.line(X0, ys + dH, X1, ys + dH, { color: C.blue, width: 1.5, dash: [0.08, 0.07] });
      for (let i = 0; i < 3; i++) {
        const y = Math.min(yTop - 0.12 - i * 0.32, yTop - 0.12);
        if (y > ys + dH + 0.12) p.arrow(X0 + 0.15, y, X0 + 1.05, y, { color: C.blue, width: 2, head: 0.13 });
      }
      p.text('gas flow', X0 + 1.15, yTop - 0.12, { size: 0.2, color: C.blue });
      // wafer and film
      p.material('si', X0, ys - 0.75, X1, ys - 0.1, { stroke: null });
      p.box(X0, ys - 0.1, X1, ys, { fill: C.gold, stroke: null });
      p.text('growing film', X1 - 0.1, ys - 0.32, { size: 0.19, align: 'right', color: C.gold });
      p.text('Si wafer', X0 + 0.12, ys - 0.45, { size: 0.21, color: C.text });
      // precursor concentration: C_G in the gas, linear drop across the boundary layer to C_S at the surface
      const xc = c => X0 + 0.5 + (X1 - X0 - 1.9) * c / v.CG;                 // horizontal position ∝ concentration
      const xG = xc(v.CG), xS = xc(v.CS);
      p.line(xG, yTop - 0.95, xG, ys + dH, { color: C.red, width: 3 });
      p.line(xG, ys + dH, xS, ys, { color: C.red, width: 3 });
      p.text('C_G', xG + 0.1, yTop - 0.95, { size: 0.24, color: C.red, baseline: 'bottom' });
      p.place('C_S', [[xS + 0.12, ys + 0.2, 'left'], [xS - 0.12, ys + 0.2, 'right']], { size: 0.24, color: C.red, key: 'cs' });
      // boundary layer thickness and fluxes
      p.dim(X1 + 0.2, ys, X1 + 0.2, ys + dH, '');
      p.text('δ', X1 + 0.32, ys + dH / 2, { size: 0.26, color: C.greyA });
      const xf = X1 - 0.55;
      p.arrow(xf, ys + dH - 0.05, xf, ys + 0.06, { color: C.purple, width: 3, head: 0.15 });
      p.place('F₁', [[xf + 0.12, ys + dH / 2, 'left'], [xf - 0.12, ys + dH / 2, 'right']], { size: 0.24, color: C.purple, key: 'f1' });
      p.text('F₂ = k_S·C_S', X1 - 0.1, ys - 0.62, { size: 0.19, align: 'right', color: C.purple });

      // ---------------------------------------------------------- bottleneck: which step is slower?
      const bx0 = X0, bx1 = X1, lo = -2, hi = 3, bw = x => bx0 + 2.0 + (bx1 - bx0 - 2.0) * (Math.log10(x) - lo) / (hi - lo);
      const by = [-2.55, -3.05];
      p.text('step conductance (log scale, cm/s)', bx0, -2.12, { size: 0.19, color: C.muted });
      [[v.ks, 'surface reaction k_S', C.teal], [v.hG, 'gas transport h_G', C.blue]].forEach(([val, lab, colr], i) => {
        const slower = (i === 0) === (v.ks < v.hG);
        p.text(lab, bx0, by[i], { size: 0.2, color: slower ? C.white : C.muted, bold: slower });
        p.box(bw(10 ** lo), by[i] - 0.13, bx1, by[i] + 0.13, { fill: C.grid, stroke: null });
        p.box(bw(10 ** lo), by[i] - 0.13, Math.max(bw(10 ** lo) + 0.02, Math.min(bw(val), bx1)), by[i] + 0.13, { fill: colr, stroke: null, fillAlpha: slower ? 1 : 0.45 });
      });
      p.text(v.ratio < 1 ? 'the surface reaction is the bottleneck' : 'gas transport is the bottleneck', bx1, -3.45, { size: 0.2, align: 'right', color: C.gold, bold: true });

      // ---------------------------------------------------------- Arrhenius plot of the growth rate
      const ax = p.axes({ x: 1.05, y: -2.75, w: 5.55, h: 5.05, xr: [0.62, 0.92], yr: [1e-4, 10], ylog: true, grid: true, size: 0.22,
        xticks: [0.65, 0.7, 0.75, 0.8, 0.85, 0.9], xfmt: x => fmt.num(x, 2), yticks: [1e-4, 1e-3, 1e-2, 0.1, 1, 10],
        yfmt: y => (y >= 1 ? String(y) : String(+y.toPrecision(1))),
        xlabel: '10³/T  (K⁻¹)', ylabel: 'growth rate (µm/min, log scale)', ylabelOffset: 1.0 }).draw();
      // temperature scale on top
      for (const tc of [850, 950, 1050, 1150, 1250]) {
        const X = ax.X(invT(tc));
        p.line(X, ax.y + ax.h, X, ax.y + ax.h + 0.06, { color: C.axis, width: 1.5 });
        p.text(`${tc}`, X, ax.y + ax.h + 0.18, { size: 0.2, align: 'center', color: C.muted });
      }
      p.text('°C', ax.x + ax.w + 0.08, ax.y + ax.h + 0.18, { size: 0.2, color: C.muted });
      const fT = x => 1000 / x - 273.15;                                       // 10³/T → °C
      const DASH_R = [0.12, 0.08], DASH_T = [0.04, 0.07];
      p.clip(ax.x, ax.y, ax.x + ax.w, ax.y + ax.h, () => {
        p.layer('family', () => FAMILY.forEach(h => ax.plot(x => G.rate(fT(x), h, v.Y), { color: C.grey, width: 1.8 })));
        p.layer('limits', () => {
          ax.plot(x => G.growth({ T: fT(x), hG: v.hG, Y: v.Y }).Vreact, { color: C.teal, width: 2.5, dash: DASH_R });
          ax.plot(x => G.growth({ T: fT(x), hG: v.hG, Y: v.Y }).Vtrans, { color: C.blue, width: 2.5, dash: DASH_T });
        });
        p.layer('tstar', () => { if (v.Tstar > fT(0.92) && v.Tstar < fT(0.62)) ax.vline(invT(v.Tstar), { color: C.muted, from: G.rate(v.Tstar, v.hG, v.Y) }); });
        ax.plot(x => G.rate(fT(x), v.hG, v.Y), { color: C.yellow, width: 4.5 });
      });
      ax.dot(invT(v.T), v.V, { r: 0.11 });
      ax.legend([
        { label: `growth rate V (h_G = ${cms(v.hG)})`, color: C.yellow, width: 4 },
        { label: 'reaction limit  k_S·C_T·Y/N₁', color: C.teal, dash: DASH_R, alpha: p.vis('limits') },
        { label: 'transport limit  h_G·C_T·Y/N₁', color: C.blue, dash: DASH_T, alpha: p.vis('limits') },
        { label: `h_G = 1, 5, 10 cm/s, ∞ (bottom → top), Y = ${fmt.sig(100 * v.Y, 2)} %`, color: C.grey, textColor: C.greyA, alpha: p.vis('family') },
      ], { corner: 'bl', size: 0.18 });
      p.layer('tstar', () => {
        if (v.Tstar > fT(0.92) && v.Tstar < fT(0.62)) {
          const X = ax.X(invT(v.Tstar));
          const ys2 = [5, 0.03, 0.012, 2.2, 0.3];
          ax.place(`k_S = h_G (${fmt.num(v.Tstar, 0)} °C)`, ys2.flatMap(y => [[X + 0.08, ax.Y(y), 'left'], [X - 0.08, ax.Y(y), 'right']]),
            { size: 0.19, color: C.muted, key: 'tstar' });
        }
      });
    },

    readout: v => `<table>
      <tr><td>surface reaction k<sub>S</sub> = k₀·e<sup>−Ea/kT</sup></td><td>${cms(v.ks)}</td></tr>
      <tr><td>gas transport h<sub>G</sub> = D<sub>G</sub>/δ</td><td>${cms(v.hG)}</td></tr>
      <tr><td>k<sub>S</sub>/h<sub>G</sub></td><td>${fmt.sig(v.ratio, 2)} – ${regime(v.ratio)}</td></tr>
      <tr><td>surface concentration C<sub>S</sub>/C<sub>G</sub> = 1/(1 + k<sub>S</sub>/h<sub>G</sub>)</td><td>${fmt.num(v.CS / v.CG, 2)}</td></tr>
      <tr><td>precursor in the gas C<sub>G</sub> = Y·p/kT</td><td>${fmt.sci(v.CG, 2)} cm⁻³</td></tr>
      <tr><td>growth rate V</td><td><b class="hl">${rateStr(v.V)}</b></td></tr>
      <tr><td>time for a 10 µm epitaxial layer</td><td>${v.V > 0 ? fmt.hours(10 / v.V / 60) : '–'}</td></tr>
      <tr><td>regime boundary k<sub>S</sub> = h<sub>G</sub></td><td>${fmt.num(v.Tstar, 0)} °C</td></tr></table>`,

    steps: [
      { name: 'Two steps in series', caption: 'Transport through the boundary layer, then reaction at the surface', set: { T: 1150, hG: 2, Y: 0.01 }, duration: 1.5,
        text: v => `The gas flowing over the wafer leaves a stagnant boundary layer of thickness δ. The precursor must first diffuse through it, F₁ = h<sub>G</sub>(C<sub>G</sub> − C<sub>S</sub>) with h<sub>G</sub> = D<sub>G</sub>/δ, and then react at the surface, F₂ = k<sub>S</sub>·C<sub>S</sub>. In steady state F₁ = F₂, so the surface concentration settles at C<sub>S</sub> = C<sub>G</sub>/(1 + k<sub>S</sub>/h<sub>G</sub>) = ${fmt.num(v.CS / v.CG, 2)}·C<sub>G</sub>, and the film grows at V = ${rateStr(v.V)}.` },
      { name: 'Reaction-limited (low T)', caption: v => `${fmt.num(v.T, 0)} °C: k_S ≪ h_G, the surface reaction is the bottleneck`, set: { T: 900 }, show: ['limits'], duration: 2.5,
        text: v => `At ${fmt.num(v.T, 0)} °C the surface reaction is slow (k<sub>S</sub> = ${cms(v.ks)} vs h<sub>G</sub> = ${cms(v.hG)}). The gas delivers more than the surface can use, C<sub>S</sub> ≈ C<sub>G</sub>, and V ≈ k<sub>S</sub>·C<sub>T</sub>Y/N₁ follows the Arrhenius law with E<sub>a</sub> = 1.9 eV – a straight line on this plot. Here uniformity is set by the <b>temperature</b>: this is where LPCVD furnaces work, with many wafers stacked close together.` },
      { name: 'Transport-limited (high T)', caption: v => `${fmt.num(v.T, 0)} °C: k_S ≈ ${fmt.sig(v.ratio, 2)}·h_G, gas transport is the bottleneck`, set: { T: 1320 }, duration: 2.5,
        text: v => `At ${fmt.num(v.T, 0)} °C the surface consumes the precursor almost as fast as it arrives (k<sub>S</sub> = ${cms(v.ks)}, ${fmt.sig(v.ratio, 2)}× h<sub>G</sub>): C<sub>S</sub> drops to ${fmt.num(v.CS / v.CG, 2)}·C<sub>G</sub> and V = ${rateStr(v.V)} approaches the transport limit h<sub>G</sub>·C<sub>T</sub>Y/N₁ = ${rateStr(v.Vtrans)}, which hardly depends on temperature. Now uniformity is set by the <b>gas flow</b> over each wafer – the regime of APCVD and epitaxial reactors.` },
      { name: 'The regime boundary', caption: v => `k_S = h_G at ${fmt.num(v.Tstar, 0)} °C`, set: { T: 1150 }, show: ['tstar'], duration: 2,
        text: v => `The two regimes meet where k<sub>S</sub> = h<sub>G</sub>, i.e. at T* = E<sub>a</sub>/(k·ln(k₀/h<sub>G</sub>)) = ${fmt.num(v.Tstar, 0)} °C for h<sub>G</sub> = ${cms(v.hG)}. There the rate is half of either limit. Note the dashed limits: the real rate is always below the lower one – like two resistors in series, 1/V ∝ 1/k<sub>S</sub> + 1/h<sub>G</sub>.` },
      { name: 'Gas flow and h_G', caption: 'Faster gas → thinner boundary layer → larger h_G', set: { hG: 10, T: 1250, Y: 0.005 }, show: ['family'], duration: 2.5,
        text: v => `The boundary layer thins as the gas velocity U grows: its mean thickness is (2/3)·L/√Re<sub>L</sub>, so h<sub>G</sub> = (3/2)(D<sub>G</sub>/L)√Re<sub>L</sub> ∝ √U. A larger h<sub>G</sub> raises the transport limit and pushes the regime boundary to ${fmt.num(v.Tstar, 0)} °C. The grey curves are h<sub>G</sub> = 1, 5, 10 cm/s and ∞ at Y = 0.5 % – the classic figure of Grove (1967) for SiCl₄ epitaxy, which this model reproduces.` },
      { name: 'Mole fraction Y', caption: 'In this model the rate is proportional to Y', set: { Y: 0.01 }, duration: 2,
        text: v => `Both limits are proportional to the precursor concentration C<sub>G</sub> = Y·C<sub>T</sub>, so doubling Y from 0.5 % to 1 % doubles the rate to ${rateStr(v.V)} (Y ≈ 1 % is typical for industrial SiCl₄ epitaxy). This holds only for dilute gas: for SiCl₄ the measured rate peaks near Y ≈ 0.1 and turns into etching above Y ≈ 0.28 (Theuerer 1961) – chemistry this model does not include. Now switch to <b>Explore</b>.` },
    ],
  });
}());
