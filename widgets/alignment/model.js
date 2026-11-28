/* Physics model – overlay of a mask pattern on a pattern that is already on the wafer (contact / proximity aligner).
   Pure functions, usable in the browser and in Node tests.
   Units: positions on the wafer in mm, overlay errors in µm, rotation in µrad, run-out in ppm, temperatures in K.

   Standard linear overlay model: the new pattern is shifted by (T_x, T_y), rotated by the small angle θ about the
   wafer centre and scaled by 1 + M against the pattern on the wafer (run-out, magnification error):
     Δx = T_x − θ·y + M·x,    Δy = T_y + θ·x + M·y
   This is the first-order expansion of a rigid rotation (x·cos θ − y·sin θ ≈ x − θ·y) plus a uniform change of
   scale; it leaves out different scales in x and y, skew and all higher-order distortion. With the complex numbers
   Δ = Δx + iΔy, z = x + iy it reads Δ = T + (M + iθ)·z, so on a wafer of radius R the largest error is
   |T| + R·√(M² + θ²), reached at the edge.

   Two alignment marks at (−L/2, 0) and (+L/2, 0): the operator sees the four residuals Δx, Δy at the marks. Their
   means give T_x, T_y; the difference of the Δy gives θ = (Δy_R − Δy_L)/L, the difference of the Δx gives
   M = (Δx_R − Δx_L)/L. An aligner can remove T and θ, not M.

   Thermal run-out: a pattern on a body with the expansion coefficient α grows by α·ΔT. If mask and wafer are both
   ΔT warmer than when the first layer was printed, M = (α_mask − α_Si)·ΔT.
     fused silica  0.54 × 10⁻⁶ /K  (MicroChemicals GmbH, application note "Glass wafers: borosilicate", Table 2)
     borosilicate  3.25 × 10⁻⁶ /K  (SCHOTT BOROFLOAT 33, technical data, mean value 20–300 °C; the MicroChemicals
                                   table gives a rounded 3)
     soda-lime     9.06 × 10⁻⁶ /K  (SCHOTT technical glass data, mean value 20–300 °C)
     silicon       2.6 × 10⁻⁶ /K   (Y. Okada, Y. Tokumaru, J. Appl. Phys. 56 (1984) 314, at room temperature)

   Vernier: a main scale of pitch p on one layer and a scale of pitch p − r on the other. With the offset n·r the
   n-th pair of bars lines up, so the offset is read in steps of r (geometry). Verniers on contact aligners are
   typically read to ±0.5 µm (University of Washington, EE 527 Microfabrication, notes on photolithography).

   Design rule: a pad that overlaps a contact window by the enclosure e on every side still covers the window while
   |Δx| ≤ e and |Δy| ≤ e. Scalable λ rules use a contact of 2λ with a surround of 1λ (R. F. Lyon, "Simplified design
   rules for VLSI layouts", Lambda magazine, first quarter 1981).

   Independent random contributions σ_i add as variances: σ = √(Σ σ_i²) (root sum of squares). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_ALN = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ALPHA_SI = 2.6;                                                     // ppm/K (Okada & Tokumaru 1984)
  const MASKS = {                                                           // ppm/K
    soda: { name: 'Soda-lime glass', alpha: 9.06 },
    boro: { name: 'Borosilicate glass', alpha: 3.25 },
    fs: { name: 'Fused silica', alpha: 0.54 },
  };
  const R_WAFER = 50;                                                       // mm, 100 mm wafer

  /** Overlay error (µm) at the position (x, y) in mm. o: { Tx, Ty (µm), th (µrad), M (ppm) } */
  const overlay = (x, y, o) => ({ dx: o.Tx - o.th * y * 1e-3 + o.M * x * 1e-3, dy: o.Ty + o.th * x * 1e-3 + o.M * y * 1e-3 });
  /** Run-out (ppm) when mask and wafer are both dT warmer than at the first exposure. */
  const runout = (mask, dT) => (MASKS[mask].alpha - ALPHA_SI) * dT;
  /** Largest |Δ| (µm) on a wafer of radius R (mm). */
  const maxError = (o, R = R_WAFER) => Math.hypot(o.Tx, o.Ty) + R * 1e-3 * Math.hypot(o.M, o.th);
  /** Residuals at the two marks, L mm apart on the x axis. */
  const marks = (o, L) => ({ left: overlay(-L / 2, 0, o), right: overlay(L / 2, 0, o) });
  /** The four model parameters from the residuals at the two marks (inverse of marks()). */
  function fromMarks(left, right, L) {
    return { Tx: (left.dx + right.dx) / 2, Ty: (left.dy + right.dy) / 2, th: (right.dy - left.dy) / L * 1e3, M: (right.dx - left.dx) / L * 1e3 };
  }
  /** Rotation (µrad) that can hide behind a reading error of ±delta (µm) at each of two marks L mm apart. */
  const rotationFromReading = (delta, L) => 2 * delta / L * 1e3;
  /** Vernier with resolution r (µm) and nMax bars to each side: index of the pair that lines up and the reading. */
  function vernier(offset, r = 0.5, nMax = 5) {
    const n = Math.round(offset / r);
    return { n: Math.max(-nMax, Math.min(nMax, n)), reading: Math.max(-nMax, Math.min(nMax, n)) * r, inRange: Math.abs(n) <= nMax };
  }
  /** Die sites on a square grid (pitch mm) whose centres lie within rMax of the wafer centre. */
  function sites(pitch = 10, rMax = 45) {
    const out = [], k = Math.floor(rMax / pitch);
    for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) if (Math.hypot(i, j) * pitch <= rMax + 1e-9) out.push([i * pitch, j * pitch]);
    return out;
  }
  /** Overlay at every site and whether a pad with the enclosure e (µm) still covers its window. */
  function map(o, e, list = sites()) {
    let worst = null, need = 0, ok = 0;
    const s = list.map(([x, y]) => {
      const d = overlay(x, y, o), m = Math.max(Math.abs(d.dx), Math.abs(d.dy)), it = { x, y, dx: d.dx, dy: d.dy, m, ok: m <= e + 1e-12 };
      if (it.ok) ok++;
      if (m > need) need = m;
      if (!worst || m > worst.m) worst = it;
      return it;
    });
    return { sites: s, worst, need, yield: ok / s.length, covered: ok, n: s.length };
  }
  /** Root sum of squares of independent contributions. */
  const rss = list => Math.sqrt(list.reduce((a, x) => a + x * x, 0));
  return { ALPHA_SI, MASKS, R_WAFER, overlay, runout, maxError, marks, fromMarks, rotationFromReading, vernier, sites, map, rss };
}));
