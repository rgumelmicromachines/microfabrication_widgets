/* Lift-off: line-of-sight deposition into a resist opening, sidewall coverage, shift and blur of the line.
   Topic: thin-film deposition. */
(function () {
  const { C, fmt } = MFW;
  const L = MFW_LIFT;
  const MAT = MFW.MAT;
  const um = x => (Math.abs(x) >= 1 ? `${fmt.sig(x, 3)} µm` : `${fmt.sig(x * 1000, 3)} nm`);
  const nm = x => `${fmt.sig(x * 1000, 2)} nm`;
  const deg = x => `${fmt.num(x, 0)}°`;
  const pct = x => `${fmt.sig(100 * x, 2)} %`;
  const RAD = Math.PI / 180;
  const walls = v => (v.nCoated === 0 ? 'both sidewalls are bare' : v.nCoated === 1 ? 'one sidewall is coated' : 'both sidewalls are coated');

  MFW.widget('#app', {
    title: 'Lift-off: deposition into a resist opening',
    alt: v => `Cross-section of a resist opening ${um(v.w)} wide in ${um(v.h)} of resist with sidewalls tilted by ${deg(v.g)} (${v.g > 0 ? 'undercut' : v.g < 0 ? 'positive slope' : 'vertical'}). A ${um(v.t)} film arrives at ${deg(v.th)} with a spread of ±${deg(v.psi)}: ${walls(v)}, the line on the substrate is ${um(v.cd)} wide and shifted by ${um(v.shift)}.`,
    source: 'Line-of-sight deposition with unit sticking into a fixed geometry (shadowing as in M. Ohring, <i>The Materials Science of Thin Films</i>, 1992, §3.3.3): each surface element collects the cosine-weighted share of the arrival directions it can see through the opening. The arrival directions are spread evenly over ±ψ around θ₀. Process statements (sputtering coats the sidewalls, fences, choice of resist) after MicroChemicals GmbH, application note “Lift-off”. The view after lift-off is schematic: where a coated sidewall tears is not modelled.',
    freeText: v => `Explore – ${walls(v)}. Find the smallest undercut that keeps both sidewalls bare at the wafer edge, then widen the spread of arrival directions towards sputtering.`,

    params: {
      g: { value: 12, min: -20, max: 30, step: 1, label: 'Sidewall tilt <i>γ</i> (+ undercut, − positive slope)', format: deg },
      h: { value: 1.5, min: 0.5, max: 5, step: 0.1, label: 'Resist thickness <i>h</i>', format: um },
      w: { value: 4, min: 1, max: 10, step: 0.1, label: 'Opening at the top of the resist <i>w</i>', format: um },
      t: { value: 0.3, min: 0.05, max: 2, step: 0.05, label: 'Deposited thickness <i>t</i>', format: um },
      th: { value: 0, min: 0, max: 20, step: 0.5, label: 'Mean angle of arrival <i>θ</i>₀', format: x => `${fmt.num(x, 1)}°`, group: 'Deposition' },
      psi: { value: 2, min: 1, max: 90, step: 1, label: 'Spread of the arrival directions ±<i>ψ</i>', format: deg, group: 'Deposition' },
      view: { value: 'dep', label: 'View', options: { dep: 'After deposition', lift: 'After lift-off (schematic)' } },
    },

    derived: v => {
      const S = L.state({ h: v.h, w: v.w, gamma: v.g, t: v.t, psi: v.psi, th0: v.th });
      return { S, u: S.u, cd: S.cd, shift: S.shift, blur: S.blur, fMax: S.fMax, nCoated: S.nCoated, sideMax: S.sideMax, sideMin: S.sideMin,
        gClean: S.gClean, buried: S.buried, closed: S.closed, clean: S.clean, ratio: S.ratio, wallFlat: v.t * Math.sin(Math.abs(v.g) * RAD) };
    },

    tex: [
      { at: [0, 3.42], tex: '\\text{bare sidewalls: } \\gamma \\ge \\psi + |\\theta_0|, \\qquad \\Delta x = -h\\tan\\theta_0, \\qquad u = h\\tan\\gamma', size: 0.33 },
    ],

    draw(p, v, w) {
      const S = v.S, g = { h: v.h, w: v.w, gamma: v.g, t: v.t, psi: v.psi, th0: v.th };
      // ---------------------------------------------------------- cross-section, to scale
      const X0 = -6.6, X1 = -0.25, XW = X1 - X0, XC = (X0 + X1) / 2, BOT = -2.95, TOP = 2.85;
      const shoulder = Math.max(1, 0.35 * v.w);
      const k = w.smooth('k', Math.min(XW / (v.w + 2 * Math.max(v.u, 0) + 2 * shoulder), 3.0 / (v.h + v.t)), { log: true });   // scene units per µm
      const Y0 = (BOT + 0.5 + TOP - 0.75) / 2 - ((v.h + v.t) * k + 1.05 - 0.5) / 2;                 // substrate surface: the section is centred in its panel
      const sx = x => XC + (x - v.w / 2) * k, sy = z => Y0 + z * k;
      const aRes = w.smooth('view', v.view === 'lift' ? 0 : 1);
      const film = { fill: MAT.metal.fill, stroke: null };
      const sw = (x, name, label) => { p.box(x, TOP - 0.2, x + 0.22, TOP - 0.04, { fill: MAT[name].fill, stroke: MAT[name].stroke, width: 1 }); p.text(label, x + 0.3, TOP - 0.12, { size: 0.18, color: C.text }); };
      sw(X0, 'resist', 'resist'); sw(X0 + 1.25, 'metal', 'deposited film'); sw(X0 + 3.45, 'si', 'substrate');
      p.text('cross-section of one opening (to scale)', X0, TOP - 0.5, { size: 0.18, color: C.muted });

      p.clip(X0, BOT + 0.5, X1, TOP - 0.75, () => {
        p.material('si', X0, Y0 - 0.5, X1, Y0, { stroke: null });
        // resist blocks and the film on top of them fade in the view after lift-off
        p.alpha(aRes, () => {
          p.materialPoly('resist', [[X0 - 1, Y0], [sx(-v.u), Y0], [sx(0), sy(v.h)], [X0 - 1, sy(v.h)]], { stroke: null });
          p.materialPoly('resist', [[X1 + 1, Y0], [sx(v.w + v.u), Y0], [sx(v.w), sy(v.h)], [X1 + 1, sy(v.h)]], { stroke: null });
          p.box(X0 - 1, sy(v.h), sx(0), sy(v.h + v.t), film);
          p.box(sx(v.w), sy(v.h), X1 + 1, sy(v.h + v.t), film);
        });
        // deposit on the substrate
        const pts = [[sx(S.xs[0]), Y0]];
        for (let i = 0; i < S.xs.length; i++) pts.push([sx(S.xs[i]), sy(v.t * S.f[i])]);
        pts.push([sx(S.xs[S.xs.length - 1]), Y0]);
        p.polygon(pts, film);
        // deposit on the sidewalls, thickness measured normal to the wall
        const cg = Math.cos(v.g * RAD), sg = Math.sin(v.g * RAD);
        for (const wl of S.walls) {
          if (wl.bare) continue;
          const base = [], top = [];
          for (const [s, f] of wl.profile) {
            const x = wl.side < 0 ? -v.u * s : v.w + v.u * s, z = v.h * (1 - s);
            base.push([sx(x), sy(z)]);
            top.push([sx(x - wl.side * cg * v.t * f), sy(z - sg * v.t * f)]);
          }
          p.polygon(base.concat(top.reverse()), film);
        }
      });
      // arrival directions: mean and the two limits of the spread
      p.alpha(aRes, () => {
        const tipX = sx(v.w / 2), tipY = sy(v.h + v.t) + 0.12, len = 0.85;
        for (const [a, wd, al] of [[v.th - Math.min(v.psi, 75), 1.6, 0.6], [v.th + Math.min(v.psi, 75 - v.th), 1.6, 0.6], [v.th, 2.6, 1]]) {
          p.arrow(tipX + len * Math.sin(a * RAD), tipY + len * Math.cos(a * RAD), tipX, tipY, { color: C.gold, width: wd, head: 0.13, alpha: al });
        }
      });
      p.text(`arrival: θ₀ = ${fmt.num(v.th, 1)}°, spread ±${deg(v.psi)}`, X1, TOP - 0.5, { size: 0.18, align: 'right', color: C.gold });
      const verdict = v.closed ? 'the opening is closed at the substrate' : v.buried ? 'the deposit has reached the top of the resist' : v.view === 'lift'
        ? (v.nCoated === 0 ? 'clean line: the film broke at both resist edges' : `fence${v.nCoated > 1 ? 's' : ''} left where the sidewall was coated`)
        : (v.nCoated === 0 ? 'sidewalls bare – the solvent reaches the resist' : v.nCoated === 1 ? 'one sidewall coated – film continuous on that side' : 'both sidewalls coated – the resist is sealed in');
      p.text(verdict, X0, Y0 - 0.78, { size: 0.2, color: v.closed || v.buried || v.nCoated > 1 ? C.red : v.nCoated ? C.gold : C.green, bold: true });

      // ---------------------------------------------------------- deposit on the substrate
      const Xr = w.smooth('xr', w.nice('xr', null, 0.5 * v.w + Math.max(v.u, 0) + 0.3));
      const a1 = p.axes({ x: 1.1, y: 0.75, w: 5.45, h: 1.95, xr: [-Xr, Xr], yr: [0, 1.15], grid: true, size: 0.18, nticks: 5,
        yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: y => fmt.num(y, 2), xlabel: 'position across the opening (µm)', ylabel: 'thickness / t', ylabelOffset: 0.72 }).draw();
      p.clip(a1.x, a1.y, a1.x + a1.w, a1.y + a1.h, () => {
        for (const e of [-v.w / 2, v.w / 2]) a1.vline(e, { color: C.muted, width: 1.5 });
        a1.curve(S.xs.map(x => x - v.w / 2), S.f, { color: C.yellow, width: 4 });
      });
      p.text('deposit on the substrate', a1.x, a1.y + a1.h + 0.14, { size: 0.17, color: C.yellow, bold: true });
      p.text('dashed: resist edges at the top', a1.x + a1.w, a1.y + a1.h + 0.14, { size: 0.17, align: 'right', color: C.muted });

      // ---------------------------------------------------------- deposit on the sidewalls
      const a2 = p.axes({ x: 1.1, y: -2.45, w: 5.45, h: 1.95, xr: [0, 1], yr: [0, 1.15], grid: true, size: 0.18,
        xticks: [0, 0.25, 0.5, 0.75, 1], xfmt: x => (x === 0 ? 'top edge' : x === 1 ? 'foot' : fmt.num(x, 2)), yticks: [0, 0.25, 0.5, 0.75, 1], yfmt: y => fmt.num(y, 2),
        xlabel: 'position down the sidewall (fraction of its length)', ylabel: 'thickness / t', ylabelOffset: 0.72 }).draw();
      p.clip(a2.x, a2.y, a2.x + a2.w, a2.y + a2.h, () => {
        S.walls.forEach((wl, i) => a2.curve(wl.profile.map(q => q[0]), wl.profile.map(q => (wl.bare ? 0 : q[1])), { color: i ? C.red : C.blue, width: i ? 3 : 4, dash: i ? [0.12, 0.08] : undefined }));
      });
      p.text('deposit on the sidewalls', a2.x, a2.y + a2.h + 0.14, { size: 0.17, color: C.text, bold: true });
      a2.legend([{ label: 'left sidewall (away from the source)', color: C.blue, width: 4 }, { label: 'right sidewall (source side)', color: C.red, width: 3, dash: [0.12, 0.08] }],
        { at: [a2.x + 0.12, a2.y + a2.h - 0.1], size: 0.17 });
    },

    readout: v => MFW.chars([
      ['sidewalls', '', v.nCoated === 0 ? 'bare' : `${v.nCoated} coated`, undefined, { hl: true, note: `bare from γ ≥ ${deg(v.gClean)}`, f: 'γ ≥ ψ + |θ₀|' }],
      ['thickest sidewall deposit', '', v.nCoated ? nm(v.t * v.sideMax) : '0 nm', undefined, { note: v.nCoated ? `${pct(v.sideMax)} of t` : '' }],
      ['line width on the substrate (at half height)', '', v.closed ? 'no line' : um(v.cd)],
      ['shift of the line', 'Δx', um(v.shift), undefined, { f: '−h·tan θ₀' }],
      ['edge blur (10–90 %)', '', um(v.blur)],
      ['thickness at the middle of the line', '', pct(v.fMax), undefined, { note: 'of t' }],
      ['undercut at the substrate', 'u', um(v.u), undefined, { f: 'h·tan γ' }],
      ['resist : film thickness', 'h/t', fmt.sig(v.ratio, 2)]]),

    steps: [
      { name: 'Deposit onto the resist', caption: 'The film is deposited over the patterned resist and breaks at its edges', set: { g: 12, h: 1.5, w: 4, t: 0.3, th: 0, psi: 2, view: 'dep' }, duration: 1.5,
        text: v => `In etching the film comes first and the resist protects what should stay. Lift-off turns the order around: the resist is patterned first, the film is deposited over everything, and a solvent then dissolves the resist and carries away the film lying on it. Only the film that landed on the substrate through the opening remains. It is used for materials that are difficult to etch through a resist mask, such as gold (MicroChemicals). Here a ${um(v.t)} film has been evaporated onto ${um(v.h)} of resist with undercut sidewalls: ${walls(v)}, so the solvent can reach the resist.` },
      { name: 'Positive slope', caption: v => `A sidewall that faces the source collects t·sin|γ| = ${nm(v.wallFlat)}`, set: { g: -8 }, duration: 2,
        ask: { q: 'An ordinary positive resist develops with sidewalls that slope the other way: the opening is narrower at the substrate than at the top. The film is evaporated straight from above. What happens on the sidewalls?',
          options: ['They stay bare, the atoms only hit horizontal surfaces', 'They are coated with a thinner film that joins the line to the film on the resist', 'They collect the full thickness t'], correct: 1 },
        text: v => `A sloping sidewall is visible from the source, so it collects the film at a slant: t·sin|γ| = ${nm(v.wallFlat)} for a slope of ${deg(Math.abs(v.g))} (the model gives up to ${nm(v.t * v.sideMax)} with the ±${deg(v.psi)} spread). That thin film joins the line on the substrate to the film on top of the resist. The solvent then has to find a way through it, the film tears at an unpredictable place, and ragged “fences” stay at the edges of the line (MicroChemicals).` },
      { name: 'Undercut', caption: 'Sidewalls stay bare when γ ≥ ψ + |θ₀|', set: { g: -8, th: 0, psi: 2, view: 'dep' }, duration: 1,
        task: 'Make the film break at the resist edge. Increase the <b>Sidewall tilt <i>γ</i></b> until both sidewalls are bare.',
        goal: v => v.nCoated === 0, solution: { g: 5 },
        text: v => `An undercut sidewall faces away from the source and lies in the shadow of its own top edge. No atom reaches it as long as the undercut angle is at least the largest angle of arrival, γ ≥ ψ + |θ₀| = ${deg(v.gClean)} here. Image-reversal resists and negative lift-off resists are processed to give such a profile (MicroChemicals). The line on the substrate keeps the width of the opening at the top of the resist, ${um(v.cd)}, and leaves a gap of u = h·tan γ = ${um(v.u)} to the resist foot on each side.` },
      { name: 'Away from the wafer centre', caption: v => `The line is shifted by h·tan θ₀ = ${um(Math.abs(v.shift))}`, from: { g: 5, th: 0, psi: 2 }, set: { th: 12 }, duration: 2.5,
        ask: { q: 'This opening has a 5° undercut and bare sidewalls in the middle of the wafer. Far from the middle the atoms arrive at 12° from the normal. What changes?',
          options: ['Nothing, the undercut still shadows both sidewalls', 'The line is shifted and the sidewall on the far side from the source is coated', 'The line becomes narrower but stays in place'], correct: 1 },
        text: v => `At wafer radius r under a source at distance H the atoms arrive at tan θ₀ = r/H. The whole line is shifted by h·tan θ₀ = ${um(Math.abs(v.shift))} away from the source, and the atoms now reach under the overhang on that side: ${deg(v.g)} of undercut is less than ψ + θ₀ = ${deg(v.gClean)}, so the left sidewall is coated. A thicker resist makes the shift larger. Evaporators keep θ₀ small with a long source distance or a dome that turns every wafer towards the source.` },
      { name: 'Sputtering', caption: 'Atoms from all directions coat the sidewalls under any overhang', from: { g: 15, th: 0, psi: 2 }, set: { psi: 90 }, duration: 2.5,
        ask: { q: 'A resist with a 15° undercut is coated by sputtering. The sputtered atoms collide with the gas and arrive from all directions. Are the sidewalls still bare?',
          options: ['Yes, the overhang shadows them as before', 'No, both sidewalls are coated, also under the overhang', 'Only the upper half of each sidewall is coated'], correct: 1 },
        text: v => `With arrival from the whole half-space (ψ = 90°) the condition γ ≥ ψ cannot be met by any resist profile. Both sidewalls are coated, with up to ${pct(v.sideMax)} of the film thickness near the top edge, and the resist is sealed in. The line also changes: its edges are blurred over ${um(v.blur)}, it reaches under the overhang, and its middle gets only ${pct(v.fMax)} of t because the resist blocks part of the sky. Lift-off of sputtered films is therefore limited to a few hundred nanometres, where the solvent can still get through the sidewall film (MicroChemicals).` },
      { name: 'Thick films', caption: 'The resist has to be thicker than the film', set: { g: 12, th: 0, psi: 2, h: 1.5, t: 1.6, w: 4, view: 'dep' }, duration: 1,
        task: 'The film in the opening has grown up to the film on the resist and joined it. Increase the <b>Resist thickness <i>h</i></b> until the deposit in the opening ends below the resist surface.',
        goal: v => !v.buried, solution: { h: 3 },
        text: v => `A film as thick as the resist closes the gap between the line and the film on top, whatever the profile. The resist is now ${fmt.sig(v.ratio, 2)} times as thick as the film. In practice the resist is kept much thicker than the film, because the deposit on the resist edges also grows sideways and slowly narrows the opening, which this model leaves out (MicroChemicals). The upper limit comes from the resolution: a thick resist cannot hold a narrow opening.` },
      { name: 'After lift-off', caption: 'What stays on the wafer', set: { g: -8, th: 0, psi: 2, h: 1.5, t: 0.3, w: 4, view: 'lift' }, duration: 1.5,
        text: v => `The resist and the film on it are gone. With the ${deg(Math.abs(v.g))} positive slope chosen here the sidewall film stays attached to the line as a fence on each side; the drawing leaves the whole sidewall film standing, while a real fence tears off at some height or falls over. Set the <b>Sidewall tilt</b> to an undercut and the line comes out clean. Solvents that boil at a low temperature, such as acetone, are a poor choice for the lift-off itself: they cannot be heated and they let lifted metal flakes settle back on the wafer (MicroChemicals).` },
      { name: 'Your turn', caption: 'Find a profile that works at the wafer edge', duration: 1,
        text: 'Switch to <b>Explore</b>: choose the resist thickness and the undercut for a 1 µm line at an arrival angle of 8°, check the shift of the line, then see how much spread of the arrival directions the profile tolerates.' },
    ],
  });
}());
