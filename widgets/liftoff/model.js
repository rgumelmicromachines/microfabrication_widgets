/* Physics model – lift-off: deposition into the opening of a resist mask, seen in cross-section (2-D, a long line).
   Usable in the browser and in Node tests. Lengths in µm, angles in degrees.

   Geometry: resist of thickness h, opening of width w at the top edges. The sidewalls are tilted by γ from the
   vertical: γ > 0 is an undercut (the opening widens towards the substrate by u = h·tan γ on each side, as with
   image-reversal and lift-off negative resists), γ < 0 a positive slope (the foot of the resist reaches into the
   opening, as with ordinary positive resists).
   Transport: line of sight, every arriving atom sticks where it lands (as in the shadowing model of M. Ohring,
   The Materials Science of Thin Films, Academic Press 1992, §3.3.3). Directions are measured from the wafer normal;
   the atoms arrive with equal intensity from all directions within ±ψ of the mean direction θ₀ (θ₀ > 0: the source
   lies towards +x). ψ → 0 is a small distant source, tan θ₀ = r/H at wafer radius r under a source at distance H;
   ψ = 90° is arrival from the whole half-space, the limit of a deposition without preferred direction.
   A surface element whose normal makes the angle φn with the wafer normal and which sees the vapour between the
   directions a and b collects, relative to an open flat surface,
       f = [sin(hi − φn) − sin(lo − φn)] / [sin(θ₀ + ψ) − sin(θ₀ − ψ)],
       lo = max(a, φn − 90°, θ₀ − ψ),  hi = min(b, φn + 90°, θ₀ + ψ)        (cosine law of incidence, integrated)
   The opening is the only window: a point (x, z) below the resist surface sees the directions between
   atan[(0 − x)/(h − z)] and atan[(w − x)/(h − z)].
   Consequences used on the page: the deposit is shifted by −h·tan θ₀; a sidewall stays bare when γ ≥ ψ + θ₀ (wall
   on the side away from the source) or γ ≥ ψ − θ₀ (wall on the source side); with ψ = 90° the top of a vertical
   sidewall receives half the flat thickness.
   Not modelled: the growing film changes the geometry (the deposit on the resist edges slowly narrows the opening –
   MicroChemicals, "Image reversal resists and their processing", Fig. 107), re-emission and surface diffusion,
   heating and rounding of the resist, and what happens in the solvent. Qualitative statements on the page about
   sputtering, fences and resists follow MicroChemicals GmbH, application note "Lift-off". */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MFW_LIFT = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RAD = Math.PI / 180, sin = d => Math.sin(d * RAD), atan = x => Math.atan(x) / RAD;
  const clampDir = d => Math.max(-90, Math.min(90, d));

  /** Undercut at the substrate on each side (µm); negative for a positive slope. */
  const undercut = (h, gamma) => h * Math.tan(gamma * RAD);
  /** Relative thickness on a surface with normal direction phin that sees the vapour between directions a and b. */
  function flux(a, b, phin, th0, psi) {
    const c0 = clampDir(th0 - psi), c1 = clampDir(th0 + psi);
    const lo = Math.max(a, phin - 90, c0), hi = Math.min(b, phin + 90, c1);
    if (!(hi > lo)) return 0;
    return (sin(hi - phin) - sin(lo - phin)) / (sin(c1) - sin(c0));
  }
  /** Directions under which the opening is seen from (x, z), z < h. */
  const windowOf = (x, z, g) => [atan((0 - x) / (g.h - z)), atan((g.w - x) / (g.h - z))];
  /** Relative thickness on the substrate at x (0 under the resist feet and outside the opening). */
  function onSubstrate(x, g) {
    const u = undercut(g.h, g.gamma);
    if (x < -u || x > g.w + u) return 0;
    const [a, b] = windowOf(x, 0, g);
    return flux(a, b, 0, g.th0, g.psi);
  }
  /** Relative thickness (measured normal to the wall) on a sidewall; side −1 left, +1 right; s = 0 top edge … 1 foot. */
  function onWall(side, s, g) {
    const u = undercut(g.h, g.gamma), z = g.h * (1 - s);
    const x = side < 0 ? -u * s : g.w + u * s;
    const [a, b] = windowOf(x, z, g);
    return flux(a, b, side < 0 ? 90 + g.gamma : -(90 + g.gamma), g.th0, g.psi);
  }
  /** Is a sidewall free of deposit? Exact condition from the geometry. */
  const wallBare = (side, g) => (side < 0 ? g.th0 + g.psi : g.psi - g.th0) <= g.gamma + 1e-9;
  /** Smallest undercut angle that keeps both sidewalls bare. */
  const gammaClean = g => g.psi + Math.abs(g.th0);

  /** Everything the page shows for one geometry g = { h, w, gamma, t, psi, th0 }. */
  function state(g) {
    const u = undercut(g.h, g.gamma), N = 241;
    const x0 = Math.min(0, -u), x1 = Math.max(g.w, g.w + u);
    const xs = [], f = [];
    for (let i = 0; i < N; i++) { const x = x0 + (x1 - x0) * i / (N - 1); xs.push(x); f.push(onSubstrate(x, g)); }
    let fMax = 0; for (const y of f) fMax = Math.max(fMax, y);
    // edges of the line at half of its own maximum, and the 10–90 % width of each edge
    const cross = (level, fromLeft) => {
      for (let k = 0; k < N - 1; k++) {
        const i = fromLeft ? k : N - 1 - k, j = fromLeft ? i + 1 : i - 1;
        if (f[i] >= level) return xs[i];
        if (f[j] >= level) return xs[i] + (xs[j] - xs[i]) * (level - f[i]) / (f[j] - f[i]);
      }
      return NaN;
    };
    const closed = g.w + 2 * u <= 0 || !(fMax > 0);                         // the feet of a positive slope meet: nothing reaches the substrate
    const xL = closed ? g.w / 2 : cross(0.5 * fMax, true), xR = closed ? g.w / 2 : cross(0.5 * fMax, false);
    const blur = closed ? 0 : Math.max(cross(0.9 * fMax, true) - cross(0.1 * fMax, true), cross(0.1 * fMax, false) - cross(0.9 * fMax, false));
    // sidewalls: profile, thinnest and thickest point of the deposit
    const walls = [-1, 1].map(side => {
      const pr = []; let mn = Infinity, mx = 0;
      for (let i = 0; i <= 40; i++) { const s = 0.01 + 0.98 * i / 40, y = onWall(side, s, g); pr.push([s, y]); mn = Math.min(mn, y); mx = Math.max(mx, y); }
      const bare = wallBare(side, g);
      return { side, profile: pr, min: bare ? 0 : mn, max: bare ? 0 : mx, bare };
    });
    const coated = walls.filter(wl => !wl.bare);
    const buried = g.t * fMax >= g.h;                                        // the deposit in the opening reaches the resist surface
    return { u, xs, f, fMax, xL, xR, cd: xR - xL, centre: (xL + xR) / 2 - g.w / 2, blur, walls,
      nCoated: coated.length, sideMax: coated.reduce((m, wl) => Math.max(m, wl.max), 0), sideMin: coated.reduce((m, wl) => Math.max(m, wl.min), 0),
      shift: -g.h * Math.tan(g.th0 * RAD), gClean: gammaClean(g), buried, closed, clean: coated.length === 0 && !buried && !closed, ratio: g.h / g.t };
  }

  return { undercut, flux, windowOf, onSubstrate, onWall, wallBare, gammaClean, state };
}));
