/* Physics model – exposure and development of a positive DNQ/novolak photoresist.
   Pure functions, usable in the browser and in Node tests. Units: µm, s, mJ/cm² (dose at 365 nm).

   Exposure (F. H. Dill, W. P. Hornberger, P. S. Hauge, J. M. Shaw, IEEE Trans. Electron Devices ED-22 (1975) 445):
     ∂I/∂z = −(A·m + B)·I,   ∂m/∂t = −C·I·m        m = fraction of the photoactive compound (PAC) still intact
   Without a reflection from the substrate the two equations reduce to one ordinary differential equation in depth,
     dm/dz = m·[A·(1 − m) − B·ln m],   m(0) = exp(−C·E)
   (S. V. Babu, E. Barouch, IEEE Electron Device Lett. EDL-7 (1986) 252; derivation: put u = −ln m, then
   ∂u/∂t = C·I and ∂/∂z(∂u/∂t) = −(A·e^(−u) + B)·∂u/∂t, integrate over t from u = 0). E is the dose that enters the
   resist surface.
   Dill parameters of the AZ 1500 series at 365 nm: A = 1.0133 /µm, B = 0.2177 /µm, C = 0.0239 cm²/mJ
   (MicroChemicals GmbH, application note "Optical parameters of photoresists").

   Development (C. A. Mack, "Development of positive photoresists", J. Electrochem. Soc. 134 (1987) 148):
     r(m) = r_max·(a + 1)·(1 − m)^n / (a + (1 − m)^n) + r_min,   a = (n + 1)/(n − 1)·(1 − m_TH)^n
   Parameter sets of Table I there, measured for AZ 1350J resist in AZ Developer diluted 1:1 – NOT an AZ 1500 resist:
     prebake 70 °C:   r_max = 55 nm/s, n = 6, m_TH = 0.61, r_min = 0.15 nm/s
     prebake 100 °C:  r_max = 21 nm/s, n = 5, m_TH = 0.61, r_min = 2 nm/s
   No Mack parameter set and no dark-erosion rate were found for an AZ 1500 resist; the page says so.

   The developer front moves along its normal at the local rate r, so its arrival time T obeys the eikonal equation
   |∇T| = 1/r(m(x, z)). In one dimension (large open area) that is T(z) = ∫ dz/r; in the cross-section of a line it is
   solved on a grid with the fast sweeping method (H. Zhao, Math. Comp. 74 (2005) 603).

   Attack of aqueous-alkaline developers on aluminium (nm/min):
     AZ Developer (metasilicate/phosphate based): no attack ("AZ Developer", Merck technical data sheet; MicroChemicals,
       application note "Development of photoresists")
     0.26 N TMAH (AZ 726 MIF, AZ 300 MIF): about 10 nm/min (Merck, "AZ MIF Developers" technical data sheet) against
       about 70 nm/min (MicroChemicals product information) – the two sources disagree
     AZ 351B (NaOH based), AZ 400K (KOH based): "several 10 to over 100 nm/min" (MicroChemicals) – no single number;
       only the quoted 100 nm/min is used, as a reference rate. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_DEV = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DILL = { A: 1.0133, B: 0.2177, C: 0.0239, lambda: 0.365 };          // /µm, /µm, cm²/mJ, µm (MicroChemicals)
  const MACK = {                                                             // µm/s (Mack 1987, Table I, AZ 1350J)
    pb70: { name: 'prebake 70 °C', T: 70, rmax: 0.055, n: 6, mth: 0.61, rmin: 0.00015 },
    pb100: { name: 'prebake 100 °C', T: 100, rmax: 0.021, n: 5, mth: 0.61, rmin: 0.002 },
  };
  const DEVELOPERS = {                                                       // attack on Al, nm/min [low, high]; null = not quantified
    azdev: { name: 'AZ Developer 1:1', al: [0, 0] },
    mif: { name: 'AZ 726 MIF (0.26 N TMAH)', al: [10, 70] },
    naoh: { name: 'AZ 351B 1:4 or AZ 400K 1:4', al: [null, 100] },
  };

  /** PAC fraction at the resist surface after the dose E. */
  const mSurface = (E, D = DILL) => Math.exp(-D.C * E);
  /** PAC profile m(z) at nz + 1 equally spaced depths 0…d for the surface dose E (RK4 on the reduced Dill equation). */
  function pacProfile(E, d, nz = 40, D = DILL) {
    const f = m => (m >= 1 ? 0 : m * (D.A * (1 - m) - D.B * Math.log(m)));
    const out = new Float64Array(nz + 1), h = d / nz;
    let m = mSurface(E, D);
    out[0] = m;
    for (let j = 1; j <= nz; j++) {
      const k1 = f(m), k2 = f(m + h * k1 / 2), k3 = f(m + h * k2 / 2), k4 = f(m + h * k3);
      m = Math.min(1, m + h * (k1 + 2 * k2 + 2 * k3 + k4) / 6);
      out[j] = m;
    }
    return out;
  }
  /** The same profile by stepping Dill's two equations through the exposure (independent check, slow). */
  function pacBrute(E, d, nz = 200, nt = 4000, D = DILL) {
    const m = new Float64Array(nz + 1).fill(1), h = d / nz, dE = E / nt;
    for (let s = 0; s < nt; s++) {
      let I = 1;                                                             // relative intensity entering the surface
      for (let j = 0; j <= nz; j++) {
        const mj = m[j];
        m[j] = mj * Math.exp(-D.C * I * dE);
        I *= Math.exp(-(D.A * mj + D.B) * h);
      }
    }
    return m;
  }
  /** Development rate (µm/s) for the PAC fraction m. */
  function rate(m, S) {
    const a = (S.n + 1) / (S.n - 1) * (1 - S.mth) ** S.n, x = Math.max(0, 1 - m) ** S.n;
    return S.rmax * (a + 1) * x / (a + x) + S.rmin;
  }
  /** Large open area: arrival times of the developer front at the nz + 1 depths (trapezoidal ∫ dz/r). */
  function arrival(E, d, S, nz = 80) {
    const m = pacProfile(E, d, nz), T = new Float64Array(nz + 1), h = d / nz;
    for (let j = 1; j <= nz; j++) T[j] = T[j - 1] + h * 0.5 * (1 / rate(m[j - 1], S) + 1 / rate(m[j], S));
    return T;
  }
  /** Time (s) to develop through a film of thickness d in a large open area. */
  const clearTime = (E, d, S, nz = 80) => arrival(E, d, S, nz)[nz];
  /** Depth (µm) developed after t seconds in a large open area. */
  function depth(E, d, t, S, nz = 80) {
    const T = arrival(E, d, S, nz), h = d / nz;
    if (T[nz] <= t) return d;
    let j = 0;
    while (T[j + 1] <= t) j++;
    return h * (j + (t - T[j]) / (T[j + 1] - T[j]));
  }
  /** Dose to clear (mJ/cm²): smallest dose that develops through d within t (bisection in log E). */
  function doseToClear(d, t, S) {
    if (d / S.rmin <= t) return 0;                                           // the dark erosion alone removes the film
    if (clearTime(1e5, d, S) > t) return Infinity;
    let lo = Math.log(0.01), hi = Math.log(1e5);
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (clearTime(Math.exp(mid), d, S) > t) lo = mid; else hi = mid; }
    return Math.exp(hi);
  }
  /** Contrast γ = −d(thickness left / d)/d(log₁₀ E) at the dose to clear, and D₀ where that tangent reaches the full
      thickness: γ = 1/log₁₀(D_c/D₀). */
  function contrast(d, t, S) {
    const Dc = doseToClear(d, t, S);
    if (!(Dc > 0) || !isFinite(Dc)) return { Dc, gamma: NaN, D0: NaN };
    const eps = 0.01, left = 1 - depth(Dc * 10 ** -eps, d, t, S) / d;
    const gamma = left / eps;
    return { Dc, gamma, D0: Dc / 10 ** (1 / gamma) };
  }

  /**
   * Cross-section of a feature. o: { I: relative intensity at nx equally spaced columns across the width X (µm),
   * E (open-frame dose), d (thickness), S (Mack set), nz }. The whole resist surface touches the developer at t = 0.
   * Returns { T: arrival time at node (i, j) = T[j·nx + i], m, nx, nz, hx, hz, rounds }.
   */
  function develop2D(o) {
    const nx = o.I.length, nz = o.nz || 32, hx = o.X / (nx - 1), hz = o.d / nz, S = o.S;
    const N = nx * (nz + 1), T = new Float64Array(N).fill(Infinity), f = new Float64Array(N), m = new Float64Array(N);
    for (let i = 0; i < nx; i++) {
      const col = pacProfile(o.E * Math.max(0, o.I[i]), o.d, nz);
      for (let j = 0; j <= nz; j++) { m[j * nx + i] = col[j]; f[j * nx + i] = 1 / rate(col[j], S); }
      T[i] = 0;
    }
    const ax = 1 / (hx * hx), az = 1 / (hz * hz);
    const update = (i, j) => {
      const k = j * nx + i;
      const a = Math.min(i > 0 ? T[k - 1] : Infinity, i < nx - 1 ? T[k + 1] : Infinity);      // mirror walls left and right
      const b = Math.min(T[k - nx], j < nz ? T[k + nx] : Infinity);
      const fk = f[k];
      let t;
      if (a === Infinity) t = b + hz * fk;
      else if (b === Infinity) t = a + hx * fk;
      else {
        // (t − a)²/hx² + (t − b)²/hz² = f²; fall back to the one-sided update where the front comes from one side only
        const A2 = ax + az, B2 = -2 * (a * ax + b * az), C2 = a * a * ax + b * b * az - fk * fk, disc = B2 * B2 - 4 * A2 * C2;
        t = disc >= 0 ? (-B2 + Math.sqrt(disc)) / (2 * A2) : Infinity;
        if (!(t >= Math.max(a, b))) t = Math.min(a + hx * fk, b + hz * fk);
      }
      if (t < T[k]) { const ch = T[k] - t; T[k] = t; return ch; }
      return 0;
    };
    let rounds = 0;
    for (; rounds < 12; rounds++) {
      let change = 0;
      for (const [si, sj] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        for (let jj = 0; jj < nz; jj++) {
          const j = sj > 0 ? jj + 1 : nz - jj;
          for (let ii = 0; ii < nx; ii++) { const c = update(si > 0 ? ii : nx - 1 - ii, j); if (c > change && isFinite(c)) change = c; }
        }
      }
      if (change < 1e-6) { rounds++; break; }
    }
    return { T, m, nx, nz, hx, hz, X: o.X, d: o.d, rounds };
  }
  /** Developed depth in every column after t seconds (first node from the top that the front has not reached). */
  function profile(R, t) {
    const out = new Float64Array(R.nx);
    for (let i = 0; i < R.nx; i++) {
      let j = 0;
      while (j < R.nz && R.T[(j + 1) * R.nx + i] <= t) j++;
      if (j === R.nz) { out[i] = R.d; continue; }
      const t0 = R.T[j * R.nx + i], t1 = R.T[(j + 1) * R.nx + i];
      out[i] = R.hz * (j + (isFinite(t1) ? Math.max(0, (t - t0) / (t1 - t0)) : 0));
    }
    return out;
  }
  /** Edge of the resist at the substrate after t seconds. The columns run from the centre of the clear space (x = 0)
      to the centre of the line (x = X). Returns the x where the resist foot begins: 0 = nothing cleared at the
      substrate, X = the line is gone. */
  function footEdge(R, t) {
    const row = R.nz * R.nx, n = R.nx;
    if (R.T[row + n - 1] <= t) return R.X;
    let i = n - 1;
    while (i > 0 && R.T[row + i - 1] > t) i--;
    if (i === 0) return 0;
    const a = R.T[row + i - 1], b = R.T[row + i];
    return R.hx * (i - 1 + (t - a) / (b - a));
  }
  /** Aluminium removed (nm) [low, high] after the film has been open to the developer for tOpen seconds. */
  function alLoss(dev, tOpen) {
    const al = DEVELOPERS[dev].al, s = Math.max(0, tOpen) / 60;
    return [al[0] === null ? null : al[0] * s, al[1] * s];
  }
  return { DILL, MACK, DEVELOPERS, mSurface, pacProfile, pacBrute, rate, arrival, clearTime, depth, doseToClear, contrast,
    develop2D, profile, footEdge, alLoss };
}));
