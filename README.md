# Forte

Carolina's gym companion — a PWA in the Strength Rebuild family, reskinned
(Morning Rosé) and reseeded with her program.

- **Terra** — squat · push-up · hips
- **Voo** — hinge · chin-up · press

Same engine as [Strength Rebuild](https://github.com/teleokinetic/strength-rebuild):
no per-set logging, one working-weight chip per tracked lift (prefilled from
last session), menu slots take notes, silent one-press rest timer.

Deployed via GitHub Pages: https://teleokinetic.github.io/forte/
Install from Safari → Share → Add to Home Screen.

The first-run program lives in `seed.js`; after first launch it lives in
localStorage and is edited in-app (Settings → Program). Ship program changes
to installed devices as staged patches in `patchProgram()` (app.js), keyed by
`specVersion`.

**Progresso** (home → the row under the day cards), computed from the log alone:
*roads* — each ladder (push-ups, Nordics, hollow body) with its goal at the far
end, plus chin-up assistance shrinking toward zero; position is the highest
rung ever picked, so Voo's easier practice can't walk a road backwards;
*next session* — reps-first lifts that hit the top of their range (add weight,
one pin less, next rung); *since* — every tracked lift from first session to
now, weight and reps, tap for its history; *rhythm* — sessions per week.

Design: the system font carries words; Barlow Condensed (`fonts/`) is for
numbers only. One line per exercise; tap a row for its drawer.
