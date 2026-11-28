/* Consistency check for interactive tours (browser, dev only).
   MFWTour.run() goes through every step of the page's tour and reports
   - a task (`goal`) that already holds in the state the step starts in (nothing left to do),
   - a task whose own `solution` does not reach the goal ("Show me" would not finish it),
   - a task without `task` text or without a `solution`,
   - a question (`ask`) whose `correct` index is not one of its options, or with fewer than two options,
   - a step without explanation text.
   Expect an empty list. Pages whose tour has no `ask` / `goal` steps return an empty list too. */
(function () {
  'use strict';
  function run() {
    const w = [...MFW.instances][0], steps = w.cfg.steps || [], out = [];
    const saved = { P: { ...w.P }, mode: w.mode, step: w.step };
    const keys = new Set(); steps.forEach(s => Object.keys(s.set || {}).forEach(k => keys.add(k)));
    const stateAt = i => { const P = {}; steps.slice(0, i + 1).forEach(s => Object.assign(P, s.set || {})); const v = {}; keys.forEach(k => { v[k] = k in P ? P[k] : w.cfg.params[k].value; }); return v; };
    const valuesFor = P => { Object.assign(w.P, P); w.renderNow(); return w.values; };
    steps.forEach((st, i) => {
      const tag = `step ${i + 1} “${st.name || ''}”`;
      if (!st.text) out.push(`${tag}: no explanation text`);
      if (st.ask) {
        const o = st.ask.options || [];
        if (o.length < 2) out.push(`${tag}: a question needs at least two options`);
        if (!(Number.isInteger(st.ask.correct) && st.ask.correct >= 0 && st.ask.correct < o.length)) out.push(`${tag}: 'correct' is not one of the options`);
      }
      if (st.goal) {
        if (!st.task) out.push(`${tag}: task text missing`);
        const start = stateAt(i);
        if (st.goal(valuesFor(start))) out.push(`${tag}: the goal already holds at the start of the step`);
        if (!st.solution) out.push(`${tag}: no solution for “Show me”`);
        else if (!st.goal(valuesFor({ ...start, ...st.solution }))) out.push(`${tag}: the solution does not reach the goal`);
      }
    });
    Object.assign(w.P, saved.P);
    if (saved.mode === 'tour' && saved.step >= 0) w.goStep(saved.step, { instant: true }); else w.renderNow();
    return out;
  }
  window.MFWTour = { run };
}());
