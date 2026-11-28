/* Image reversal: first exposure, reversal bake, flood exposure and development of a DNQ resist; origin of the undercut.
   Topic: lithography. */
(function () {
  const { C, M, fmt } = MFW;
  const IR = MFW_IRV, LI = MFW_LITHO;
  const NX = 41, NZ = 32, HP = 3, TMAX = 240;                               // columns, rows, half pitch (µm), longest development (s)
  const um = x => (Math.abs(x) >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.num(x * 1000, 0)} nm`);
  const mj = x => `${fmt.num(x, 0)} mJ/cm²`;
  const sec = x => `${fmt.num(x, 0)} s`;
  const pct = x => `${fmt.num(100 * x, 0)} %`;
  const STAGES = { exp: 'After the first exposure', bake: 'After the reversal bake', flood: 'After the flood exposure', dev: 'After development' };

  let kImg = null, img = null, imgRev = null, kRun = null, run = null, curve = null;
  function compute(v) {
    const pos = v.mode === 'positive';
    if (kImg !== v.d) {
      img = LI.aerialImage({ mode: 'proximity', lambda: IR.D.lambda, hp: HP, xs: M.linspace(0, HP, NX), gap: 0, resist: v.d, collimation: 2 });
      imgRev = Float64Array.from(img).reverse(); kImg = v.d;
    }
    const kr = [v.d, v.E1, v.eta, v.E2, v.mode].join('|');
    if (kr !== kRun) {
      run = IR.process({ I: pos ? imgRev : img, X: HP, d: v.d, E1: v.E1, eta: v.eta, E2: v.E2, nz: NZ, mode: v.mode });
      curve = { t: [], left: [], tu: [], under: [] };
      for (let t = 0, alive = true; t <= TMAX; t += 6) {
        const q = IR.measure(run, t, pos); curve.t.push(t); curve.left.push(q.left);
        if (alive && (q.gone || q.lifted)) alive = false;                     // the undercut has no meaning once the line is gone or loose
        if (alive) { curve.tu.push(t); curve.under.push(q.under); }
      }
      kRun = kr;
    }
    const q = IR.measure(run, v.t, pos);
    const iE = pos ? NX - 1 : 0, k0 = iE, kb = NZ * NX + iE;                   // middle of the exposed area: surface and substrate
    return { R: run, q, curve, pos, under: q.under, gamma: q.gamma, left: q.left, loss: q.loss, tClear: q.tClear, open: q.open, over: q.over,
      lifted: q.lifted, gone: q.gone, wTop: q.wTop, wFoot: q.wFoot, iE, expS: 1 - run.m1[k0], expB: 1 - run.m1[kb], cS: run.c[k0], cB: run.c[kb],
      pOpen: run.p[NZ * NX + NX - 1] };
  }
  const state = v => (v.gone ? 'the resist is gone' : v.lifted ? 'the line has lost its footing' : !v.open ? 'the opening is not clear yet'
    : v.gamma > 1 ? `undercut ${um(v.under)}` : v.gamma < -1 ? 'positive slope' : 'nearly vertical sidewalls');

  MFW.widget('#app', {
    title: 'Image reversal: where the undercut comes from',
    alt: v => `Cross-section of an image reversal resist ${um(v.d)} thick, 3 µm lines and spaces, ${STAGES[v.stage].toLowerCase()}. First exposure ${mj(v.E1)}, ${v.pos ? 'processed as a positive resist' : `bake converting ${pct(v.eta)} of the exposed resist, flood exposure ${mj(v.E2)}`}, development ${sec(v.t)}: ${state(v)}.`,
    source: 'Exposure after Dill et al. (1975) with the parameters of the AZ 1500 series at 365 nm (MicroChemicals), development rate after Mack (1987) with the set measured for AZ 1350J after a 100 °C prebake, development front from the eikonal equation. Process sequence and trends after MicroChemicals GmbH, application note “Image reversal resists and their processing”. Assumptions of this page: the product converted by the bake inhibits dissolution like intact photoactive compound, and the share η of the exposed product that the bake converts is a free parameter. The mask and the light arrows are schematic; the resist cross-section is to scale.',
    freeText: v => `Explore – ${state(v)}. Lower the first exposure dose step by step and watch the undercut grow until the film starts to thin, then change the development time.`,

    params: {
      E1: { value: 90, min: 20, max: 300, step: 5, label: 'First exposure dose (through the mask)', format: mj },
      eta: { value: 1, min: 0.5, max: 1, step: 0.05, label: 'Reversal bake: share of the exposed resist converted <i>η</i>', format: pct, when: v => v.mode !== 'positive' },
      E2: { value: 400, min: 0, max: 600, step: 10, label: 'Flood exposure dose (no mask)', format: mj, when: v => v.mode !== 'positive' },
      t: { value: 120, min: 10, max: TMAX, step: 2, label: 'Development time', format: sec },
      d: { value: 1.4, min: 1, max: 2, step: 0.1, label: 'Resist thickness', format: um },
      mode: { value: 'reversal', label: 'Process', options: { reversal: 'Image reversal (bake and flood exposure)', positive: 'Positive (no bake, no flood exposure)' } },
      stage: { value: 'dev', label: 'Show the resist', options: STAGES },
    },

    derived: compute,

    draw(p, v, w) {
      const R = v.R, q = v.q, d = v.d;
      // ---------------------------------------------------------- cross-section, to scale; the opening is in the middle
      const X0 = -6.6, X1 = -0.25, XC = (X0 + X1) / 2, TOP = 3.25, k = (X1 - X0) / (2 * HP);       // scene units per µm
      const ySub = -1.55, yRes = ySub + d * k, sx = u => XC + u * k;
      const stage = v.pos && (v.stage === 'bake' || v.stage === 'flood') ? 'exp' : v.stage;
      const sw = (x, y, fill, label, a = 1) => { p.box(x, y - 0.08, x + 0.22, y + 0.08, { fill: MFW.MAT.resist.fill, stroke: null }); if (fill) p.box(x, y - 0.08, x + 0.22, y + 0.08, { fill, fillAlpha: a, stroke: null }); p.text(label, x + 0.3, y, { size: 0.18, color: C.text }); };
      sw(X0, TOP - 0.1, null, 'photoactive'); sw(X0 + 1.55, TOP - 0.1, C.yellow, 'exposed, soluble', 0.75); sw(X0 + 3.75, TOP - 0.1, C.blue, 'converted, insoluble', 0.8);
      p.text(`${STAGES[stage].toLowerCase()} · resist to scale, lines and spaces 3 µm`, X0, TOP - 0.45, { size: 0.18, color: C.muted });

      // mask and light (schematic): first exposure through the mask, flood exposure without it
      const yM = yRes + 0.95, lit = stage === 'exp' || stage === 'flood';
      if (stage === 'exp') {
        p.material('glass', X0, yM + 0.1, X1, yM + 0.24, { stroke: null });
        const chrome = v.pos ? [[-HP, -HP / 2], [HP / 2, HP]] : [[-HP / 2, HP / 2]];
        for (const [a, b] of chrome) p.box(sx(a), yM, sx(b), yM + 0.1, { fill: MFW.MAT.chrome.fill, stroke: null });
        p.text('mask (schematic)', X1, yM + 0.42, { size: 0.17, align: 'right', color: C.muted });
      }
      if (lit) for (let i = 0; i < 12; i++) {
        const u = -HP + (i + 0.5) * HP / 6, dark = stage === 'exp' && (v.pos ? Math.abs(u) > HP / 2 : Math.abs(u) < HP / 2);
        if (!dark) p.arrow(sx(u), yM - 0.08, sx(u), yRes + 0.1, { color: C.purple, width: 1.8, head: 0.1 });
      }
      p.material('si', X0, ySub - 0.45, X1, ySub, { stroke: null });
      p.clip(X0, ySub, X1, yRes + 0.02, () => {
        p.material('resist', X0, ySub, X1, yRes, { stroke: null });
        // composition: yellow = exposed and soluble, blue = converted by the bake
        const rows = 16, dz = d / rows, dx = R.hx * 2;
        for (let i = 0; i < NX - 1; i += 2) {
          for (let j = 0; j < rows; j++) {
            const n = Math.round((j + 0.5) * NZ / rows) * NX + i + 1;
            const m1 = R.m1[n];
            const cc = stage === 'exp' ? 0 : R.c[n], aa = stage === 'exp' ? 1 - m1 : stage === 'bake' ? 1 - m1 - cc : R.a[n];
            const x = i * R.hx, y = yRes - (j + 1) * dz * k;
            for (const sgn of [-1, 1]) {
              const xa = sgn > 0 ? sx(HP - x - dx) : sx(-(HP - x));
              if (aa > 0.03) p.rect(xa, y, dx * k * 1.03, dz * k * 1.03, { fill: C.yellow, fillAlpha: 0.75 * aa, stroke: null, noOcc: true });
              if (cc > 0.03) p.rect(xa, y, dx * k * 1.03, dz * k * 1.03, { fill: C.blue, fillAlpha: 0.8 * cc, stroke: null, noOcc: true });
            }
          }
        }
        if (stage === 'dev') {
          // developed region: everything between the two resist edges, row by row
          const left = [], right = [];
          for (let j = 0; j <= NZ; j++) { const half = HP - q.e[j], y = yRes - j * R.hz * k; left.push([sx(-half), y]); right.push([sx(half), y]); }
          p.polygon([[sx(-HP), yRes + 0.05], ...left, [left[NZ][0], ySub - 0.05], [right[NZ][0], ySub - 0.05], ...right.reverse(), [sx(HP), yRes + 0.05]], { fill: C.bg, stroke: null, noOcc: true });
          if (q.left < d) p.box(X0, yRes - (d - q.left) * k, X1, yRes + 0.05, { fill: C.bg, stroke: null, noOcc: true });
        }
      });
      const good = !v.gone && !v.lifted && v.open;
      p.text(stage === 'dev' ? state(v) : stage === 'exp' ? `exposed share: ${pct(v.expS)} at the surface, ${pct(v.expB)} at the substrate` : stage === 'bake' ? `converted: ${pct(v.cS)} at the surface, ${pct(v.cB)} at the substrate` : `photoactive compound left at the bottom of the opening: ${pct(v.pOpen)}`,
        X0, ySub - 0.72, { size: 0.2, bold: true, color: stage !== 'dev' ? C.text : !good ? C.red : v.gamma > 1 ? C.green : C.gold });

      // ---------------------------------------------------------- depth profiles in the middle of the line
      const a1 = p.axes({ x: 1.1, y: 0.75, w: 5.45, h: 1.75, xr: [0, 2], yr: [0, 1.15], grid: true, size: 0.18,
        xticks: [0, 0.5, 1, 1.5, 2], yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: y => fmt.num(y, 2), xlabel: 'depth below the resist surface (µm)', ylabel: 'share', ylabelOffset: 0.72 }).draw();
      const zs = M.linspace(0, d, NZ + 1);
      p.clip(a1.x, a1.y, a1.x + a1.w, a1.y + a1.h, () => {
        a1.curve(zs, zs.map((_, j) => 1 - R.m1[j * NX + v.iE]), { color: C.yellow, width: 4 });
        if (!v.pos) a1.curve(zs, zs.map((_, j) => R.c[j * NX + v.iE]), { color: C.blue, width: 3, dash: [0.12, 0.08] });
      });
      const key = (x, y, color, dash, label) => { p.line(x, y, x + 0.4, y, { color, width: 3, dash }); p.text(label, x + 0.5, y, { size: 0.17, color }); return x + 0.75 + p.measure(label, 0.17); };
      p.text('in the middle of the exposed area', a1.x, a1.y + a1.h + 0.4, { size: 0.17, color: C.text, bold: true });
      const kx = key(a1.x, a1.y + a1.h + 0.15, C.yellow, undefined, 'exposed by the first exposure');
      if (!v.pos) key(kx, a1.y + a1.h + 0.15, C.blue, [0.12, 0.08], 'converted by the bake');

      // ---------------------------------------------------------- undercut against development time
      const a2 = p.axes({ x: 1.1, y: -2.45, w: 5.45, h: 1.85, xr: [0, TMAX], yr: [-0.5, 1.5], grid: true, size: 0.18,
        xticks: [0, 60, 120, 180, 240], yticks: [-0.5, 0, 0.5, 1, 1.5], yfmt: y => fmt.num(y, 1), xlabel: 'development time (s)', ylabel: 'µm', ylabelOffset: 0.72 }).draw();
      p.clip(a2.x, a2.y, a2.x + a2.w, a2.y + a2.h, () => {
        a2.hline(0, { color: C.muted, width: 1.5, dash: undefined });
        a2.vline(v.t, { color: C.muted, width: 1.5 });
        a2.curve(v.curve.t, v.curve.left, { color: C.purple, width: 3, dash: [0.12, 0.08] });
        if (v.curve.tu.length > 1) a2.curve(v.curve.tu, v.curve.under, { color: C.green, width: 4 });
      });
      const kx2 = key(a2.x, a2.y + a2.h + 0.15, C.green, undefined, 'undercut (negative: positive slope)');
      key(kx2, a2.y + a2.h + 0.15, C.purple, [0.12, 0.08], 'resist thickness left');
    },

    readout: v => MFW.chars([
      ['profile after development', '', v.gone ? 'no resist' : v.lifted ? 'line lifted' : !v.open ? 'not open' : um(v.under), undefined, { hl: true, note: v.gone || v.lifted || !v.open ? '' : v.gamma >= 0 ? `undercut, ${fmt.num(v.gamma, 0)}° from the vertical` : `positive slope, ${fmt.num(-v.gamma, 0)}°` }],
      ['resist thickness left', '', um(v.left), undefined, { note: `of ${um(v.d)}` }],
      ['opening at the top / at the substrate', '', v.gone || !v.open ? '–' : `${fmt.sig(v.wTop, 3)} / ${fmt.sig(v.wFoot, 3)} µm`],
      ['developer reaches the substrate after', '', isFinite(v.tClear) ? sec(v.tClear) : '–'],
      ['over-development', '', pct(v.over), undefined, { f: '(t − t_clear)/t' }],
      ['exposed share in the line, surface / substrate', '', `${pct(v.expS)} / ${pct(v.expB)}`],
      ...(v.pos ? [] : [['converted by the bake, surface / substrate', '', `${pct(v.cS)} / ${pct(v.cB)}`]])]),

    steps: [
      { name: 'First exposure', caption: 'The mask exposes the areas that are to stay', set: { mode: 'reversal', E1: 90, eta: 1, E2: 400, t: 120, d: 1.4, stage: 'exp' }, duration: 1.5,
        text: v => `An image reversal resist is a positive resist with two extra steps that turn its tone around. The first exposure goes through a mask that is inverted compared with a positive process: light falls where the resist is to stay. The light is absorbed on its way down, so after ${mj(v.E1)} the resist is exposed to ${pct(v.expS)} at the surface and to ${pct(v.expB)} at the substrate (yellow in the figure). That gradient is what later makes the undercut.` },
      { name: 'Reversal bake', caption: 'The bake makes the exposed resist insoluble', set: { stage: 'bake' }, duration: 1.5,
        ask: { q: 'After the first exposure the wafer is baked at 110–130 °C for a few minutes. In an ordinary positive process the exposed resist would dissolve in the developer. What does the bake do to it?',
          options: ['Nothing, it only dries the film', 'It makes the exposed resist insoluble, while the unexposed resist stays photoactive', 'It makes the unexposed resist insoluble'], correct: 1 },
        text: v => `During the reversal bake the exposed resist loses its ability to develop, and the unexposed resist stays photoactive (MicroChemicals; typically 110–130 °C for a few minutes). In the figure the exposed resist turns from yellow to blue: ${pct(v.cS)} converted at the surface, ${pct(v.cB)} at the substrate. This page describes the bake by one number, the share η of the exposed resist that it converts; a hotter or longer bake converts more.` },
      { name: 'Flood exposure', caption: 'Without a mask: everything still photoactive is exposed', set: { stage: 'dev', E2: 40, t: 120, E1: 90, eta: 1, mode: 'reversal', d: 1.4 }, duration: 1,
        task: 'The developer has to remove the resist that the mask kept dark, but with this flood exposure it does not get through. Increase the <b>Flood exposure dose</b> until the opening is clear at the substrate.',
        goal: v => v.open && !v.gone, solution: { E2: 400 },
        text: v => `The flood exposure has no mask. It exposes the resist that was dark the first time, down to the substrate, so that the developer can remove it; ${pct(v.pOpen)} of the photoactive compound is now left at the bottom of the opening. The converted areas no longer react to light, so too much does no harm: the recommendation is at least two to three times the dose that the same film would need as a positive resist (MicroChemicals).` },
      { name: 'Development time', caption: v => `Over-development ${pct(v.over)}: the undercut grows after the opening is clear`, from: { t: 70, stage: 'dev', E2: 400 }, set: { t: 150 }, duration: 3,
        ask: { q: 'After 70 s the developer has just reached the substrate and the sidewalls are nearly vertical. The wafer stays in the developer for 150 s in total. What happens to the sidewalls?',
          options: ['Nothing more, the remaining resist is insoluble', 'They are undercut: the resist near the substrate dissolves faster than the top', 'The top edge is rounded off and the slope becomes positive'], correct: 1 },
        text: v => `The resist near the substrate got less light in the first exposure, so less of it was converted and it still dissolves slowly. Once the opening is clear the developer works sideways there and the undercut grows: ${um(v.under)} after ${sec(v.t)}, an over-development of ${pct(v.over)} (the green curve). About 30 % over-development is a good starting point (MicroChemicals). Too long, and narrow lines lose their footing and lift off the substrate.` },
      { name: 'First exposure dose', caption: 'A high first dose exposes the film evenly: no undercut', from: { E1: 90, t: 120, stage: 'dev' }, set: { E1: 250 }, duration: 2.5,
        ask: { q: 'With a first exposure of 90 mJ/cm² this resist develops an undercut. The first exposure is now raised to 250 mJ/cm², everything else stays. What happens to the profile?',
          options: ['The undercut grows', 'The undercut almost disappears', 'The resist line dissolves'], correct: 1 },
        text: v => `A high dose bleaches the resist and exposes it almost evenly down to the substrate: ${pct(v.expS)} at the surface and ${pct(v.expB)} at the bottom. The bake then converts the whole depth, nothing dissolves faster at the bottom, and the sidewall comes out nearly vertical (${um(v.under)} of undercut). The undercut is set by a low first dose, and the dose is the main handle on the profile.` },
      { name: 'Too little light', caption: 'An underexposed film is not converted and thins in the developer', set: { E1: 40, t: 90, stage: 'dev', eta: 1, E2: 400, mode: 'reversal', d: 1.4 }, duration: 1,
        task: 'With this first exposure not even the surface of the resist is converted enough, and the developer removes the whole film. Increase the <b>First exposure dose</b> until at least 1 µm of resist is left on the lines.',
        goal: v => v.left >= 1 && v.open && !v.lifted, solution: { E1: 90 },
        text: v => `Below a certain dose the bake cannot make even the surface insoluble, and the resist that should stay is eroded. Now ${um(v.left)} of the ${um(v.d)} are left. The useful window lies between the dose that just protects the surface and the dose that exposes the whole depth. A reversal bake that converts too little has the same effect: lower <b>η</b> in Explore and the film thins.` },
      { name: 'The same resist, positive', caption: 'Without bake and flood exposure the resist is an ordinary positive resist', set: { mode: 'positive', E1: 90, t: 90, stage: 'dev', d: 1.4 }, duration: 1.5,
        text: v => `Leave out the reversal bake and the flood exposure and the same resist works as a positive resist: the exposed areas dissolve, the mask has the opposite tone, and the sidewalls slope the other way (${fmt.num(-v.gamma, 0)}° here), because now the top of the film is the better exposed, faster dissolving part. Undercut sidewalls are only obtained in the reversal mode (MicroChemicals). They are what lift-off needs: see the lesson <b>Lift-off</b>.` },
      { name: 'Your turn', caption: 'Find a profile for lift-off', duration: 1,
        text: 'Switch to <b>Explore</b>: find a first dose and a development time that give an undercut of about 0.3 µm with more than 1 µm of resist left, then check how much the result changes when the development runs 20 s longer.' },
    ],
  });
}());
