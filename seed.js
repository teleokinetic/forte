// Forte — Carolina's program seed (v1.5)
// This is only the FIRST-RUN seed. After first launch the program lives in
// localStorage and is edited in-app; changes here won't overwrite it.
//
// Model (same as Strength Rebuild v0.3): no per-set logging. Two kinds of slot —
//   track: true   → one working-weight capture, prefilled from last session
//   menu: [...]   → task menu, note instead of numbers
//   reps: true    → one working-reps capture, on either kind — alone on the
//     push-up slots, where the rung is the load and reps move the ladder
// rest: 'normal' | 'heavy' picks which rest-button tier the slot suggests.
// pair: slots sharing a key are done together, alternating sets — 1:30
//   between moves is the right rest, and the card + rest dock say so.
//   short: the name partners use when pointing at this slot.
//   pairRest: optional quicker rest (seconds) the group takes instead.
//
// Terra = grounded day (squat, push-up, hips). Voo = flight day (hinge,
// chin-up, press). Push-up appears on both days on purpose: frequency is
// the main lever for a first push-up — Terra is the progression work,
// Voo is lighter practice.

const SEED_PROGRAM = {
  specVersion: '1.5',
  days: [
    {
      id: 'terra',
      name: 'Terra',
      subtitle: 'Squat · push-up · hips',
      slots: [
        {
          id: 'warm-terra', name: 'Warm-up', target: '~5 min',
          track: false, rest: 'normal',
          cue: 'Anything that raises your heart rate and warms your joints — bike, brisk incline walk, easy flow',
        },
        {
          id: 't1', name: 'Back squat', target: '4×8–12 · RIR 2–3',
          track: true, reps: true, rest: 'heavy',
          warmup: 'Empty bar first — feet, breath, easy depth',
          cue: 'Reps first — build to 12s, then add weight and drop back to 8s. Upright torso, full depth',
        },
        {
          id: 't2', name: 'Push-up progression', target: '3×5–8',
          track: false, reps: true, rest: 'normal', pair: 'a', short: 'push-ups',
          menu: [
            'Incline push-up — hands on a bar or box; lower the height over time',
            'Eccentric-only from the floor — 3–5 s down, reset on knees',
            'Kneeling push-up — extra volume after inclines',
            'Full push-up singles — when the low incline feels easy',
          ],
          cue: '3×8 crisp at one height → move down a notch. Body one long line — ribs down, glutes on',
        },
        {
          id: 't3', name: 'One-arm DB row', target: '3×8–10 /side',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'the row',
          cue: 'Reps first — build to 3×8–10, then add weight · bench support, lead with the shoulder blade',
        },
        {
          id: 't4', name: 'Hip thrust (Smith)', target: '3×8–12 · RIR 1–2',
          track: true, reps: true, rest: 'heavy',
          cue: 'Chin tucked, ribs down — full lockout, hard squeeze at the top',
        },
        {
          id: 't5', name: 'Suitcase carry', target: '3×30–40 m /side',
          track: true, rest: 'normal', pair: 'b', short: 'carry',
          cue: "Ribcage stacked, don't tip",
        },
        {
          id: 't8', name: 'Nordic ladder', target: '3×4–8',
          track: false, rest: 'normal', pair: 'b', short: 'Nordics',
          menu: [
            'Bilateral slider',
            'Single-leg slider',
            'Shallow negative',
            'Full negative',
            'Band assist',
            'Full Nordic',
          ],
          cue: 'Slow 3–5 s eccentric — own a rung crisp, then move up',
        },
        {
          id: 't7', name: 'Hang / grip', target: '2×30–45 s',
          track: false, rest: 'normal',
          menu: ['Active→passive hang', 'Offset grip', 'Single-arm assisted', 'Traverse the bar'],
          cue: 'Active shoulders',
        },
      ],
    },
    {
      id: 'voo',
      name: 'Voo',
      subtitle: 'Hinge · chin-up · press',
      slots: [
        {
          id: 'warm-voo', name: 'Warm-up', target: '~5 min',
          track: false, rest: 'normal',
          cue: 'Anything that raises your heart rate and warms your joints — bike, brisk incline walk, easy flow',
        },
        {
          id: 'v1', name: 'Kettlebell swing', target: '4×6',
          track: true, rest: 'normal',
          cue: 'Snap the hips, float the bell — never to fatigue',
        },
        {
          id: 'v2', name: 'DB Romanian deadlift', target: '4×6–8 · RIR 2–3',
          track: true, reps: true, rest: 'heavy',
          cue: 'Long hamstrings, neutral spine',
        },
        {
          id: 'v3', name: 'DB standing overhead press', target: '3×6–8 · RIR 2–3',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'the press',
          cue: 'Ribs down — reach tall at the top',
        },
        {
          id: 'v4', name: 'Chin-up progression', target: '3×6–10 · assisted',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'chin-ups',
          cue: 'Assisted machine — the chip tracks the assistance, lower is harder. 3×10 crisp → one pin less, back to 6s',
        },
        {
          // Crossed over from Terra in 1.4 — the id rides along so an
          // in-flight session's entry isn't orphaned. Stands alone on
          // purpose: the trio stays a trio.
          id: 't6', name: 'Pallof press', target: '2×10–12 /side',
          track: true, reps: true, rest: 'normal',
          cue: "Resist rotation, don't create it",
        },
        {
          id: 'v5', name: 'Push-up practice', target: '2–3 easy sets',
          track: false, reps: true, rest: 'normal', pair: 'b', short: 'push-ups', pairRest: 60,
          menu: [
            'Incline push-up — hands on a bar or box; lower the height over time',
            'Eccentric-only from the floor — 3–5 s down, reset on knees',
            'Kneeling push-up — extra volume after inclines',
            'Full push-up singles — when the low incline feels easy',
          ],
          cue: 'Slightly easier version than Terra — crisp reps, stop two short of grinding. Same ladder: 3×8 crisp at one height → move down a notch',
        },
        {
          id: 'v6', name: 'Hollow body', target: '3×20–30 s',
          track: false, rest: 'normal', pair: 'b', short: 'hollow body', pairRest: 60,
          menu: [
            'Tuck hollow — low back pressed into the floor',
            'One leg extended',
            'Full hollow — arms overhead last',
            'Rocking hollow — once the shape is solid',
          ],
          cue: 'Low back glued down — shrink the shape before it breaks',
        },
        {
          id: 'v7', name: 'Calf, single-leg', target: '2×8–15 /side',
          track: true, reps: true, rest: 'normal', pair: 'b', short: 'calves', pairRest: 60,
          menu: [
            'Split squat iso w/ calf raise — front foot off a box edge, nothing moves but the heel',
            '3D calf raise — roller into the wall, find the angles',
          ],
          cue: 'Bent knee, full range, slow heel drop',
        },
      ],
    },
  ],
};
