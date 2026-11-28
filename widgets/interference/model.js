/* Physics model – interference colours and reflectance of a transparent film on silicon (basis of reflectometry).
   Usable in the browser (needs ../oxidation/model.js loaded first: Si optical constants, SiO₂ index, colour
   conversion) and in Node tests. Units: nm, degrees.

   Reflectance of air / film (real index n₁, thickness d) / Si (complex index N₂) at the angle of incidence θ₀
   (Airy summation of the multiple reflections; M. Born, E. Wolf, Principles of Optics, 7th ed., §1.6.4 and §14.4;
   E. Hecht, Optics, 5th ed., §9.6–9.7):
     r = (r₀₁ + r₁₂·e^{2iβ}) / (1 + r₀₁·r₁₂·e^{2iβ}),   β = 2π·n₁·d·cos θ₁ / λ,   sin θ₀ = n₁·sin θ₁
   with the Fresnel coefficients of each interface for s and p polarisation; unpolarised light: R = (|r_s|² + |r_p|²)/2.
   Both reflections are at an optically denser medium (n₀ < n₁ < n₂), so the reflectance has minima where
   2·n₁·d·cos θ₁ = (m + ½)·λ and maxima where it equals m·λ. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../oxidation/model.js'));
  else root.MFW_TF = factory(root.MFW_OX);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (OX) {
  'use strict';
  /** Si₃N₄: single-term Sellmeier fit n² = 1 + 2.8939·λ²/(λ² − 0.13967²), λ in µm, 0.207–1.24 µm
      (T. Bååk, Appl. Opt. 21 (1982) 1069, fitted to the data of H. R. Philipp, J. Electrochem. Soc. 120 (1973) 295;
      stoichiometric CVD nitride, absorption negligible in the visible). */
  const nSi3N4 = lnm => { const l2 = (lnm / 1000) ** 2; return Math.sqrt(1 + 2.8939 * l2 / (l2 - 0.13967 ** 2)); };
  const FILMS = {
    sio2: { name: 'SiO₂', n: OX.nSiO2 },            // Malitson 1965 (see the oxidation model)
    si3n4: { name: 'Si₃N₄', n: nSi3N4 },
  };

  // complex helpers on [re, im]
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]], csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const csqrt = a => { const m = Math.hypot(a[0], a[1]), re = Math.sqrt((m + a[0]) / 2), im = Math.sqrt(Math.max(0, (m - a[0]) / 2)); return [re, a[1] < 0 ? -im : im]; };
  const abs2 = a => a[0] * a[0] + a[1] * a[1];

  /** Reflectance (0…1) of air / film / Si. film: key of FILMS; d in nm; λ in nm; θ₀ in degrees; unpolarised.
      Returns { R, Rs, Rp, cos1 }. */
  function stack(film, d, lnm, theta = 0) {
    const n1 = FILMS[film].n(lnm), [n2, k2] = OX.nkSi(lnm);
    const s0 = Math.sin(theta * Math.PI / 180), c0 = Math.cos(theta * Math.PI / 180);
    const cos1 = Math.sqrt(1 - (s0 / n1) ** 2);
    const N2 = [n2, k2], q2 = csqrt(csub(cmul(N2, N2), [s0 * s0, 0]));           // N₂·cos θ₂ (complex)
    const a0 = [c0, 0], a1 = [n1 * cos1, 0];
    const ph = 4 * Math.PI * n1 * d * cos1 / lnm, e = [Math.cos(ph), Math.sin(ph)];
    const airy = (r01, r12) => { const x = cmul(r12, e); return abs2(cdiv(cadd(r01, x), cadd([1, 0], cmul(r01, x)))); };
    // s: r_ij = (q_i − q_j)/(q_i + q_j) with q = N·cos θ
    const Rs = airy(cdiv(csub(a0, a1), cadd(a0, a1)), cdiv(csub(a1, q2), cadd(a1, q2)));
    // p: r_ij = (N_j²·q_i − N_i²·q_j)/(N_j²·q_i + N_i²·q_j)
    const e1 = [n1 * n1, 0], e2 = cmul(N2, N2);
    const p01 = cdiv(csub(cmul(e1, a0), a1), cadd(cmul(e1, a0), a1));
    const p12 = cdiv(csub(cmul(e2, a1), cmul(e1, q2)), cadd(cmul(e2, a1), cmul(e1, q2)));
    const Rp = airy(p01, p12);
    return { R: (Rs + Rp) / 2, Rs, Rp, cos1 };
  }
  const reflectance = (film, d, lnm, theta = 0) => stack(film, d, lnm, theta).R;

  /** sRGB triplet (0…255) of the film on Si in daylight (same colour pipeline as the oxidation page). */
  const rgb = (film, d, theta = 0, exposure = 1.6) => OX.rgbOf(l => reflectance(film, d, l, theta), exposure);

  /** Wavelengths (nm) of the reflectance minima and maxima between lmin and lmax from the interference condition
      2·n₁(λ)·d·cos θ₁(λ) = (m + ½)·λ (minima) or m·λ (maxima); solved by bisection (dispersion included). */
  function extrema(film, d, theta = 0, lmin = 400, lmax = 700) {
    const s0 = Math.sin(theta * Math.PI / 180), n = FILMS[film].n;
    const order = l => { const n1 = n(l); return 2 * d * Math.sqrt(n1 * n1 - s0 * s0) / l; };   // optical path difference / λ, falls with λ
    const out = { min: [], max: [] };
    const hi = order(lmin), lo = order(lmax);
    for (let h = Math.ceil(2 * lo); h <= Math.floor(2 * hi); h++) {
      if (h < 1) continue;
      const target = h / 2;
      let a = lmin, b = lmax;
      for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (order(m) > target) a = m; else b = m; }
      (h % 2 ? out.min : out.max).push({ m: Math.floor(target), lambda: (a + b) / 2 });
    }
    return out;
  }
  /** Reflectometry without knowing the order: two neighbouring minima (or maxima) at λ₁ > λ₂ give
      d = λ₁·λ₂ / (2·(n₂·λ₁ − n₁·λ₂)) at normal incidence, with n₁ = n(λ₁), n₂ = n(λ₂). */
  const thicknessFromPair = (film, l1, l2) => { const n = FILMS[film].n; return l1 * l2 / (2 * (n(l2) * l1 - n(l1) * l2)); };
  /** Quarter-wave thickness λ/(4n) – the thinnest film with a reflectance minimum at λ. */
  const quarterWave = (film, lnm) => lnm / (4 * FILMS[film].n(lnm));

  return { FILMS, nSi3N4, stack, reflectance, rgb, extrema, thicknessFromPair, quarterWave };
}));
