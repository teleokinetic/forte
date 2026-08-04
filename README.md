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

No targets ledger yet — a progress view for Carolina is planned but
deliberately not built.
