/* Physics model – thermal oxidation of silicon (Deal–Grove) and the interference colour of SiO2 on Si.
   Pure functions, usable in the browser and in Node tests. Units: µm, hours, °C, nm for wavelengths. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_OX = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const kB = 8.617333e-5;                                   // eV/K

  /* Deal–Grove rate constants, Plummer, Deal & Griffin, Silicon VLSI Technology (2000), Table 6-2,
     for (111) Si; for (100) Si the linear-rate prefactor C2 is divided by 1.68.
     Dry: 1 atm O2. Wet: H2O row of Table 6-2 (labelled 1 atm there; it agrees with Deal & Grove's 640-torr wet data within ~15 %). */
  const DG = {
    dry: { C1: 7.72e2, E1: 1.23, C2: 6.23e6, E2: 2.0, xi: 0.025 },   // xi: Deal–Grove initial-regime offset for dry O2
    wet: { C1: 3.86e2, E1: 0.78, C2: 1.63e8, E2: 2.05, xi: 0 },
  };
  const ORIENT = { '111': 1, '100': 1 / 1.68 };
  /** Thickness of Si consumed per unit thickness of grown oxide = (SiO₂ molecules per cm³)/(Si atoms per cm³)
      = 2.3×10²² / 5.0×10²² = 0.46 for thermal oxide (density ≈ 2.27 g/cm³, i.e. 1 µm Si → 2.17 µm SiO₂).
      Textbooks quote 0.44–0.46 depending on the oxide density they assume (2.2–2.27 g/cm³). */
  const SI_CONSUMED = 0.46;

  function rates(ambient, TC, orient) {
    const p = DG[ambient], T = TC + 273.15;
    const B = p.C1 * Math.exp(-p.E1 / (kB * T));                 // µm²/h, parabolic rate constant
    const BA = ORIENT[orient] * p.C2 * Math.exp(-p.E2 / (kB * T)); // µm/h, linear rate constant B/A
    return { B, BA, A: B / BA };
  }
  /** τ that makes x(0) = x0 (µm). */
  const tauOf = (r, x0) => (x0 * x0 + r.A * x0) / r.B;
  /** Oxide thickness (µm) after time t (h) for given rates and τ (h). */
  const thickness = (r, t, tau) => (r.A / 2) * (Math.sqrt(1 + (t + tau) / (r.A * r.A / (4 * r.B))) - 1);
  /** Time (h) to grow from the state described by τ to thickness x (µm). Negative = already thicker. */
  const timeTo = (r, x, tau) => (x * x + r.A * x) / r.B - tau;
  /** Effective starting thickness: dry O2 uses max(x0, 25 nm) (textbook convention; Deal & Grove adopted 23 nm) to absorb the fast initial regime. */
  const startThickness = (ambient, x0) => Math.max(x0, DG[ambient].xi);

  /* ---------------------------------------------------------- interference colour of SiO2 on Si */
  /** Refractive index of fused silica (Malitson 1965 Sellmeier), λ in nm. Thermal SiO2 is within ~0.01. */
  function nSiO2(lnm) {
    const l2 = (lnm / 1000) ** 2;
    return Math.sqrt(1 + 0.6961663 * l2 / (l2 - 0.0684043 ** 2) + 0.4079426 * l2 / (l2 - 0.1162414 ** 2) + 0.8974794 * l2 / (l2 - 9.896161 ** 2));
  }
  /** Complex refractive index n + ik of crystalline Si at 300 K (M. A. Green, Sol. Energy Mater. Sol. Cells 92 (2008) 1305). */
  const SI_NK = [ // λ nm, n, k – Green 2008 tabulated values (refractiveindex.info, Si/Green-2008); clamped outside 400–700 nm
    [400, 5.613, 0.296], [450, 4.691, 0.0863], [500, 4.294, 0.0442], [550, 4.077, 0.0280],
    [600, 3.940, 0.0199], [650, 3.844, 0.0144], [700, 3.772, 0.0105],
  ];
  function nkSi(lnm) {
    const t = SI_NK;
    if (lnm <= t[0][0]) return [t[0][1], t[0][2]];
    for (let i = 1; i < t.length; i++) if (lnm <= t[i][0]) {
      const u = (lnm - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
      return [t[i - 1][1] + u * (t[i][1] - t[i - 1][1]), t[i - 1][2] + u * (t[i][2] - t[i - 1][2])];
    }
    return [t[t.length - 1][1], t[t.length - 1][2]];
  }
  /** Normal-incidence reflectance of air / SiO2 (thickness d nm) / Si at wavelength λ nm (Airy formula). */
  function reflectance(dnm, lnm) {
    const n1 = nSiO2(lnm), [n2, k2] = nkSi(lnm);
    const r01 = (1 - n1) / (1 + n1);
    // r12 = (n1 - N2)/(n1 + N2), N2 = n2 + i k2
    const den = (n1 + n2) ** 2 + k2 * k2;
    const r12re = ((n1 - n2) * (n1 + n2) - k2 * k2) / den, r12im = (-k2 * (n1 + n2) - (n1 - n2) * k2) / den;
    const ph = 4 * Math.PI * n1 * dnm / lnm, c = Math.cos(ph), s = Math.sin(ph);
    const er = r12re * c - r12im * s, ei = r12re * s + r12im * c;           // r12 · e^{2iδ}
    const numRe = r01 + er, numIm = ei, denRe = 1 + r01 * er, denIm = r01 * ei;
    return (numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm);
  }
  /* CIE 1931 2° colour-matching functions – multi-lobe Gaussian fit of Wyman, Sloan & Shirley, JCGT 2 (2013) 1. */
  const g = (l, mu, s1, s2) => { const t = (l - mu) / (l < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const xbar = l => 1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2);
  const ybar = l => 0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1);
  const zbar = l => 1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8);
  /** Relative spectral power of a 6504 K black body (stand-in for daylight D65). */
  const planck = l => { const lm = l * 1e-9; return 1 / (lm ** 5 * (Math.exp(1.438777e-2 / (lm * 6504)) - 1)); };
  const LAMBDAS = []; for (let l = 380; l <= 780; l += 5) LAMBDAS.push(l);
  const WHITE = (() => { let X = 0, Y = 0, Z = 0; for (const l of LAMBDAS) { const S = planck(l); X += S * xbar(l); Y += S * ybar(l); Z += S * zbar(l); } return [X, Y, Z]; })();
  const D65 = [0.95047, 1, 1.08883];
  const gamma = u => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
  /** CIE XYZ (Y = 1 for a perfect white) of a surface with spectral reflectance R(λ), von-Kries-scaled to D65 white. */
  function xyzOf(R) {
    let X = 0, Y = 0, Z = 0;
    for (const l of LAMBDAS) { const S = planck(l) * R(l); X += S * xbar(l); Y += S * ybar(l); Z += S * zbar(l); }
    return [X / WHITE[0] * D65[0], Y / WHITE[1], Z / WHITE[2] * D65[2]];
  }
  /** sRGB colour (0..255 triplet) of SiO2 of thickness d (nm) on Si viewed at normal incidence in daylight.
      exposure > 1 brightens the image (as a camera would); hue is unaffected unless channels clip. */
  function oxideRGB(dnm, exposure = 1.6) {
    const [X, Y, Z] = xyzOf(l => reflectance(dnm, l)).map(v => v * exposure);
    const lin = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
    const m = Math.max(...lin);
    const scaled = m > 1 ? lin.map(v => v / m) : lin;                // keep hue if a channel would clip
    return scaled.map(v => Math.round(255 * gamma(Math.min(1, Math.max(0, v)))));
  }

  return { DG, ORIENT, SI_CONSUMED, rates, tauOf, thickness, timeTo, startThickness, nSiO2, nkSi, reflectance, oxideRGB };
}));
