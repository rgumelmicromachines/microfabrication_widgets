/* Physics model – aerial image of an equal line/space chrome mask.
   Scalar Fourier optics (Kirchhoff mask, no polarisation, no resist optics), usable in the browser and in Node tests.
   Units: µm. All dimensions are at wafer scale (projection reduction is already divided out). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_LITHO = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  /** Exposure wavelengths (µm). Hg lines from NIST; excimer lasers. */
  const LAMBDA = { g: 0.4358, h: 0.4047, i: 0.3650, krf: 0.248, arf: 0.193 };
  const LNAME = { g: 'g-line 436 nm', h: 'h-line 405 nm', i: 'i-line 365 nm', krf: 'KrF 248 nm', arf: 'ArF 193 nm' };

  /** Fourier coefficient of a 50 % duty line/space mask (clear space centred at x = 0). */
  const coef = m => (m === 0 ? 0.5 : Math.sin(Math.PI * m / 2) / (Math.PI * m));

  /** Points uniformly filling a disk of radius r (sunflower pattern), plus the centre when n = 1. */
  function diskSamples(r, n) {
    if (r <= 0 || n <= 1) return [[0, 0]];
    const out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) { const rr = r * Math.sqrt((i + 0.5) / n), a = i * ga; out.push([rr * Math.cos(a), rr * Math.sin(a)]); }
    return out;
  }

  /**
   * Aerial image I(x) normalised to the open-frame intensity (1 = no mask).
   * o: { mode: 'projection'|'proximity', lambda, hp (line = space width), xs (positions),
   *      projection: NA, sigma, defocus;  proximity: gap, resist (thickness d, image taken at gap + d/2), collimation (half-angle, deg) }
   */
  function aerialImage(o) {
    const p = 2 * o.hp, lam = o.lambda, xs = o.xs, I = new Float64Array(xs.length);
    let src, M, z = 0;
    const fc = 1 / lam;                                                      // free-space cut-off frequency
    if (o.mode === 'projection') {
      src = diskSamples(o.sigma * o.NA / lam, o.sigma > 0 ? 61 : 1);
      M = Math.ceil((1 + o.sigma) * o.NA / lam * p) + 1;
    } else {
      z = o.gap + o.resist / 2;
      src = diskSamples(Math.sin(o.collimation * Math.PI / 180) / lam, o.collimation > 0 ? 41 : 1);
      M = Math.min(160, Math.ceil(p / lam * 1.2) + 12);                       // all propagating orders + some evanescent ones
    }
    const re = new Float64Array(xs.length), im = new Float64Array(xs.length), n = xs.length;
    // uniformly spaced xs: e^{i(k·x_j + φ)} by repeated rotation instead of cos/sin per point (same result, ~5× faster)
    const dx = n > 1 ? (xs[n - 1] - xs[0]) / (n - 1) : 0;
    const uniform = n > 2 && xs.every((x, j) => Math.abs(x - (xs[0] + j * dx)) <= 1e-9 * (Math.abs(dx) + 1e-30) * n);
    for (const [sx, sy] of src) {
      re.fill(0); im.fill(0);
      for (let m = -M; m <= M; m++) {
        const c = coef(m);
        if (c === 0) continue;
        const fx = sx + m / p, f2 = fx * fx + sy * sy;
        let amp = c, ph = 0;
        if (o.mode === 'projection') {
          if (f2 > (o.NA / lam) ** 2) continue;                               // blocked by the pupil
          ph = 2 * Math.PI * o.defocus * (Math.sqrt(fc * fc - f2) - fc);       // defocus aberration (exact scalar)
        } else if (f2 <= fc * fc) {
          ph = 2 * Math.PI * z * (Math.sqrt(fc * fc - f2) - fc);               // free-space propagation over the gap
        } else {
          amp = c * Math.exp(-2 * Math.PI * z * Math.sqrt(f2 - fc * fc));      // evanescent order
          if (Math.abs(amp) < 1e-9) continue;
        }
        const k = 2 * Math.PI * m / p;
        if (uniform) {
          let cr = Math.cos(k * xs[0] + ph), ci = Math.sin(k * xs[0] + ph);
          const rr = Math.cos(k * dx), ri = Math.sin(k * dx);
          for (let j = 0; j < n; j++) { re[j] += amp * cr; im[j] += amp * ci; const t = cr * rr - ci * ri; ci = cr * ri + ci * rr; cr = t; }
        } else {
          for (let j = 0; j < n; j++) { const a = k * xs[j] + ph; re[j] += amp * Math.cos(a); im[j] += amp * Math.sin(a); }
        }
      }
      for (let j = 0; j < xs.length; j++) I[j] += re[j] * re[j] + im[j] * im[j];
    }
    for (let j = 0; j < xs.length; j++) I[j] /= src.length;
    return I;
  }

  /** Width of the region around x = 0 where I ≥ thr (printed space width for a positive resist), from a sampled image. */
  function clearedWidth(xs, I, thr) {
    const j0 = xs.reduce((b, x, j) => (Math.abs(x) < Math.abs(xs[b]) ? j : b), 0);
    if (I[j0] < thr) return 0;
    let a = j0, b = j0;
    while (a > 0 && I[a - 1] >= thr) a--;
    while (b < xs.length - 1 && I[b + 1] >= thr) b++;
    if (a === 0 || b === xs.length - 1) return Infinity;                      // everything cleared
    const xa = xs[a - 1] + (thr - I[a - 1]) / (I[a] - I[a - 1]) * (xs[a] - xs[a - 1]);
    const xb = xs[b] + (thr - I[b]) / (I[b + 1] - I[b]) * (xs[b + 1] - xs[b]);
    return xb - xa;
  }

  /** Rules of thumb. */
  const rayleigh = (k1, lam, NA) => k1 * lam / NA;
  const dof = (lam, NA) => lam / (NA * NA);                                   // total range, i.e. ±0.5 λ/NA²
  /** Smallest pitch whose ±1st order can still pass the pupil together with the 0th order. */
  const minPitch = (lam, NA, sigma) => lam / (NA * (1 + sigma));
  /** Smallest line width for proximity/contact printing of a grating (Madou 2011 / DTU notes): b = 1.5 √(λ (s + d/2)). */
  const proximityLimit = (lam, gap, d) => 1.5 * Math.sqrt(lam * (gap + d / 2));

  return { LAMBDA, LNAME, coef, aerialImage, clearedWidth, rayleigh, dof, minPitch, proximityLimit };
}));
