/* Physics model – image reversal of a DNQ/novolak resist: first exposure, reversal bake, flood exposure, development.
   Usable in the browser and in Node tests. Units: µm, s, mJ/cm² (dose at 365 nm). Needs the development model
   (Dill exposure, Mack development rate, fast-sweeping development front) of the lesson "Development".

   Process (MicroChemicals GmbH, application note "Image reversal resists and their processing"): the first exposure
   through the mask exposes the areas that are to stay; the reversal bake makes the exposed resist insoluble in the
   developer while the unexposed resist stays photoactive; the flood exposure without a mask then exposes everything
   that is still photoactive, and the developer removes it. Because the light of the first exposure is absorbed on
   its way down, the resist near the substrate is less exposed, less of it is converted, and it dissolves faster:
   the sidewall is undercut.

   Bookkeeping per volume element, three fractions that add up to 1:
     p  photoactive compound (PAC) still intact,   a  exposed, soluble product,   c  product converted by the bake
   first exposure  (Dill, reduced equation, no substrate reflection):  p = m₁(x, z),  a = 1 − m₁
   reversal bake:  c = η·(1 − m₁),  a = (1 − η)·(1 − m₁)          η = share of the exposed product the bake converts
   flood exposure: ∂I/∂z = −(A·p + B)·I,  ∂p/∂E = −C·I·p, marched in dose for every column (the PAC now varies with depth)
   development:    Mack rate r(m) with the inhibitor fraction m = c + p, front from |∇T| = 1/r

   ASSUMPTIONS OF THIS PAGE, not measured data:
     – the converted product inhibits dissolution exactly as intact PAC does (m = c + p in Mack's rate law). No rate
       model for a reversed resist was found in the sources;
     – η is a free parameter. The application note gives the trend (a hotter or longer bake converts more, also the
       weakly exposed resist near the substrate; typical 110–130 °C for a few minutes) but no kinetics;
     – thermal decomposition of the PAC during the reversal bake (Fig. 105 of the note) is left out;
     – Dill parameters of the AZ 1500 series and Mack parameters of AZ 1350J (prebake 100 °C) stand in for an image
       reversal resist such as AZ 5214E, for which neither set was found. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../development/model.js'));
  else root.MFW_IRV = factory(root.MFW_DEV);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (DV) {
  'use strict';
  const D = DV.DILL, S = DV.MACK.pb100;

  /** Flood exposure of one column: p0[j] = PAC fraction at depth j·hz before the flood; returns the fractions after the dose E2. */
  function flood(p0, E2, hz, steps = 60) {
    const n = p0.length, p = Float64Array.from(p0), dE = E2 / steps;
    for (let s = 0; s < steps && E2 > 0; s++) {
      let I = 1;                                                              // relative intensity, 1 at the surface
      for (let j = 0; j < n; j++) {
        const pj = p[j];
        p[j] = pj * Math.exp(-D.C * I * dE);
        I *= Math.exp(-(D.A * pj + D.B) * hz);
      }
    }
    return p;
  }

  /**
   * o: { I (relative intensity of the first exposure at nx columns from x = 0, centre of the exposed area, to x = X,
   *      centre of the dark area), X, d, E1, eta, E2, nz, mode: 'reversal' | 'positive' }.
   * 'positive' skips bake and flood: the resist then develops like an ordinary positive resist. For that mode pass
   * the image the other way round (x = 0 the centre of the dark area), so that the resist again stays at x = 0.
   * Returns the fields p, a, c (index j·nx + i) after each step, the inhibitor m and the arrival time T of the developer.
   */
  function process(o) {
    const nx = o.I.length, nz = o.nz || 32, hx = o.X / (nx - 1), hz = o.d / nz, N = nx * (nz + 1);
    const m1 = new Float64Array(N), c = new Float64Array(N), a = new Float64Array(N), p = new Float64Array(N), m = new Float64Array(N);
    const T = new Float64Array(N).fill(Infinity), f = new Float64Array(N);
    const rev = o.mode !== 'positive', eta = rev ? o.eta : 0;
    for (let i = 0; i < nx; i++) {
      const col = DV.pacProfile(o.E1 * Math.max(0, o.I[i]), o.d, nz);
      const after = rev ? flood(col, o.E2, hz) : col;
      for (let j = 0; j <= nz; j++) {
        const k = j * nx + i;
        m1[k] = col[j]; c[k] = eta * (1 - col[j]); p[k] = after[j]; a[k] = 1 - c[k] - p[k];
        m[k] = c[k] + p[k]; f[k] = 1 / DV.rate(m[k], S);
      }
      T[i] = 0;
    }
    DV.sweep(T, f, nx, nz, hx, hz);
    return { m1, p, a, c, m, T, nx, nz, hx, hz, X: o.X, d: o.d };
  }

  /** Resist edge in every row after the development time t: the resist reaches from x = 0 to edge[j] (0 = row gone). */
  function edges(R, t) {
    const out = new Float64Array(R.nz + 1);
    for (let j = 0; j <= R.nz; j++) {
      const row = j * R.nx;
      if (!(R.T[row] > t)) { out[j] = 0; continue; }
      let i = 0;
      while (i < R.nx - 1 && R.T[row + i + 1] > t) i++;
      if (i === R.nx - 1) { out[j] = R.X; continue; }
      const t0 = R.T[row + i], t1 = R.T[row + i + 1];
      out[j] = R.hx * (i + (isFinite(t0) ? (t0 - t) / (t0 - t1) : 1));
    }
    return out;
  }

  /** Numbers that describe the profile after the development time t. */
  function measure(R, t, positive = false) {
    const e = R.edges ? R.edges(t) : edges(R, t), nz = R.nz;                 // a model with a sharp boundary brings its own edge finder
    let jTip = -1, tip = 0;
    for (let j = 0; j <= nz; j++) if (e[j] > tip) { tip = e[j]; jTip = j; }
    const foot = e[nz];
    const tClear = R.T[nz * R.nx + R.nx - 1];                                 // developer reaches the substrate in the middle of the opening
    // resist left in the middle of the line: first row from the top that is still there
    let j0 = 0; while (j0 <= nz && !(R.T[j0 * R.nx] > t)) j0++;
    const left = j0 > nz ? 0 : R.d - R.hz * Math.max(0, j0 - (j0 > 0 ? (R.T[j0 * R.nx] - t) / (R.T[j0 * R.nx] - R.T[(j0 - 1) * R.nx]) : 0));
    // positive slope (the foot is the widest row): compare the foot with the edge two rows below the resist surface
    const jTop = Math.min(nz, j0 + 2), sloped = positive && jTip === nz && j0 < nz - 2 && foot < R.X && e[jTop] < foot;
    const height = jTip < 0 ? 0 : sloped ? (nz - jTop) * R.hz : (nz - jTip) * R.hz;
    const under = jTip < 0 ? 0 : sloped ? e[jTop] - foot : tip - foot;
    return { e, tip, foot, jTip, under, height, left, loss: R.d - left, tClear, open: tClear <= t, lifted: jTip >= 0 && foot <= 0,
      gone: jTip < 0, gamma: height > 0 ? Math.atan(under / height) * 180 / Math.PI : 0, over: tClear <= t ? (t - tClear) / t : 0,
      wTop: 2 * (R.X - tip), wFoot: 2 * (R.X - foot) };
  }

  return { D, S, flood, process, edges, measure };
}));
