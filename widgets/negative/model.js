/* Physics model – cross-linking negative resist: exposure without bleaching, post-exposure bake, development.
   Usable in the browser and in Node tests. Lengths in µm; doses in units of the gel dose; times in units of the time
   the developer needs to clear an unexposed film of the same thickness.

   Process and trends (MicroChemicals GmbH, application notes "Processing of AZ negative resists", "Post exposure
   bake" and "Composition and properties of AZ and TI photoresists"): the exposure forms an acid that cross-links
   the resin in the post-exposure bake (PEB, typically 110–125 °C for 1–2 minutes); without the bake the exposed
   resist dissolves about as fast as the unexposed one. The cross-linked resist stays, the rest is developed away.
   These resists do not bleach, so the light falls off exponentially with depth: penetration depth 1–2 µm at the
   i-line for the AZ nLOF 2000 series. Resist near the substrate that is not cross-linked stays soluble, which gives
   the undercut used for lift-off.

   Model of this page:
     local dose          E(x, z) = E·I(x)·exp(−z/δ)        Beer–Lambert law, δ = penetration depth, I = mask image
     after the bake      the resist is cross-linked (insoluble) where κ·E(x, z) ≥ 1, soluble elsewhere
     development         the front moves at the rate of the unexposed resist through soluble resist and does not
                         enter cross-linked resist (eikonal equation, same solver as the lesson "Development")
     depth of cross-linking under a large exposed area:  z_x = δ·ln(κ·E)

   ASSUMPTIONS, not measured data:
     – one sharp threshold, the gel dose, separates soluble from insoluble resist. Real resists pass through partly
       cross-linked states that erode slowly; that erosion is not modelled;
     – κ (0…1) is a free parameter for how completely the bake carries out the cross-linking. The notes give the trend
       with temperature and time but no kinetics. Thermal cross-linking of unexposed resist in a bake that is too hot
       is left out;
     – no gel dose in mJ/cm² and no development rate were found for a specific resist, hence the relative units. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../development/model.js'), require('../imagereversal/model.js'));
  else root.MFW_NEG = factory(root.MFW_DEV, root.MFW_IRV);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (DV, IRV) {
  'use strict';
  const BLOCK = 1e7;                                                          // slowness of cross-linked resist: the front does not get through

  /** Depth to which a large exposed area is cross-linked (µm); 0 if not even the surface is. */
  const depthX = (E, kappa, delta) => (kappa * E > 1 ? delta * Math.log(kappa * E) : 0);
  /** Dose (in gel doses) that cross-links a large area down to the depth d. */
  const doseFor = (d, kappa, delta) => Math.exp(d / delta) / kappa;

  /**
   * o: { I (relative intensity at nx columns from x = 0, centre of the exposed line, to x = X, centre of the dark space),
   *      X, d, E, kappa, delta, nz }. Returns the local dose field e (index j·nx + i, in gel doses, before the bake factor),
   *      the cross-linked flag g, and the arrival "time" T of the developer in µm of unexposed resist dissolved.
   */
  function process(o) {
    const nx = o.I.length, nz = o.nz || 32, hx = o.X / (nx - 1), hz = o.d / nz, N = nx * (nz + 1);
    const e = new Float64Array(N), g = new Uint8Array(N), f = new Float64Array(N), T = new Float64Array(N).fill(Infinity);
    for (let j = 0; j <= nz; j++) {
      const att = Math.exp(-j * hz / o.delta);
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        e[k] = o.E * Math.max(0, o.I[i]) * att;
        g[k] = o.kappa * e[k] >= 1 ? 1 : 0;
        f[k] = g[k] ? BLOCK : 1;
      }
    }
    for (let i = 0; i < nx; i++) T[i] = g[i] ? Infinity : 0;                    // the developer starts on the soluble part of the surface
    DV.sweep(T, f, nx, nz, hx, hz);
    for (let k = 0; k < N; k++) if (T[k] > 1e5) T[k] = Infinity;                // behind cross-linked resist: never reached
    const R = { e, g, T, nx, nz, hx, hz, X: o.X, d: o.d, kappa: o.kappa };
    R.edges = t => edges(R, t);
    return R;
  }
  /** Resist edge in every row after the development "time" t (µm): the resist reaches from x = 0 to edge[j].
      Where the edge is the boundary of the cross-linked resist it is placed on the contour κ·E = 1 between two
      columns; where the developer is still on its way through soluble resist, by its arrival time. */
  function edges(R, t) {
    const out = new Float64Array(R.nz + 1);
    for (let j = 0; j <= R.nz; j++) {
      const row = j * R.nx;
      if (!(R.T[row] > t)) { out[j] = 0; continue; }
      let i = 0;
      while (i < R.nx - 1 && R.T[row + i + 1] > t) i++;
      if (i === R.nx - 1) { out[j] = R.X; continue; }
      const a = R.kappa * R.e[row + i], b = R.kappa * R.e[row + i + 1];
      if (R.g[row + i] && !R.g[row + i + 1]) out[j] = R.hx * (i + (a - 1) / (a - b));
      else { const t0 = R.T[row + i], t1 = R.T[row + i + 1]; out[j] = R.hx * (i + (isFinite(t0) ? (t0 - t) / (t0 - t1) : 1)); }
    }
    return out;
  }
  /** Profile numbers after the development time tau (in units of d: the time to clear an unexposed film). */
  const measure = (R, tau) => IRV.measure(R, tau * R.d);

  return { depthX, doseFor, process, edges, measure };
}));
