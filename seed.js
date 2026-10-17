// Forte — Carolina's program seed (v2.0)
// This is only the FIRST-RUN seed. After first launch the program lives in
// localStorage and is edited in-app; changes here won't overwrite it.
// (Installed phones get v2.0 once, through patchProgram.)
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
// v2.0 additions —
//   dow: the weekday a day belongs to (1 = Monday … 6 = Saturday); Up next
//     follows the calendar and the week counts "of 3".
//   light: the easier repeat of a lift trained harder on another day. Its own
//     name keeps its own history, so it never prefills the main lift, and
//     Progresso leaves it out (the chin-up road reads Voo's chin-ups only).
//   optional: doesn't hold back the trail or Finish.
//   step: the chip's ± step (default 5); 2.5 where the dumbbells go up by 2.5.
//   start: a one-time Week 1 prefill, used until the lift is next logged.
//
// Three days (10/17): Água is the new light Monday (hips, easy upper,
// trunk). Terra (Wednesday) and Voo (Saturday) keep their names, glyphs and
// history — Terra still squats, Voo still hinges and climbs.

const SEED_PROGRAM = {
  specVersion: '2.0',
  days: [
    {
      id: 'agua',
      name: 'Água',
      subtitle: 'Hips · easy upper · trunk',
      dow: 1,
      slots: [
        {
          id: 'warm-agua', name: 'Warm-up', target: '~5 min',
          track: false, rest: 'normal',
          cue: 'Anything that raises your heart rate and warms your joints — bike, brisk incline walk, easy flow',
        },
        {
          id: 't4', name: 'Hip thrust (Smith)', target: '3×8–12 · RIR 2–3',
          track: true, reps: true, rest: 'heavy', start: 145,
          cue: 'Up from 135 — chin tucked, ribs down, full lockout, hard squeeze at the top',
        },
        {
          id: 'v5', name: 'Push-up practice', target: '2×8–10 · unbroken',
          track: false, reps: true, light: true, rest: 'normal', pair: 'a', short: 'push-ups',
          menu: [
            'Incline push-up — hands on a bar or box; lower the height over time',
            'Eccentric-only from the floor — 3–5 s down, reset on knees',
            'Kneeling push-up — extra volume after inclines',
            'Full push-up singles — when the low incline feels easy',
          ],
          cue: 'The easy day — smooth sets with no break, two short of grinding',
        },
        {
          id: 'a3', name: 'Chin-up practice', target: '2×8–10 · assisted · RIR 3–4',
          track: true, reps: true, light: true, rest: 'normal', pair: 'a', short: 'chin-ups', start: 80,
          cue: 'A pin more help than Voo — smooth reps all the way up, brief pause with the chin over the bar',
        },
        {
          id: 'a4', name: 'Hamstring curl (machine, light)', target: '2×10–15 · RIR 2–3',
          track: true, reps: true, light: true, rest: 'normal', pair: 'b', short: 'curls', start: 50,
          cue: 'Build 50 from 10 toward 15 · slow on the way back',
        },
        {
          id: 't6', name: 'Pallof press', target: '2×10–12 /side · 2 s pause',
          track: true, reps: true, rest: 'normal', pair: 'b', short: 'Pallof',
          cue: "Resist rotation, don't create it — exhale through the pause",
        },
        {
          id: 't5', name: 'Suitcase carry', target: '2×30–40 m /side',
          track: true, rest: 'normal', pair: 'c', short: 'carry',
          cue: "Ribcage stacked, don't tip · 40 m a side before a heavier bell",
        },
        {
          id: 'v8', name: 'Hip abduction (machine)', target: '3×12–15',
          track: true, reps: true, rest: 'normal', pair: 'c', short: 'abduction',
          cue: 'Build from 12 toward 15 before more weight · or 2 sets abduction + 2 sets kickback',
        },
      ],
    },
    {
      id: 'terra',
      name: 'Terra',
      subtitle: 'Squat · push-up · row',
      dow: 3,
      slots: [
        {
          id: 'warm-terra', name: 'Warm-up', target: '~5 min',
          track: false, rest: 'normal',
          cue: 'Anything that raises your heart rate and warms your joints — bike, brisk incline walk, easy flow',
        },
        {
          id: 't1', name: 'Back squat', target: '3×8–10 · RIR 2–3',
          track: true, reps: true, rest: 'heavy',
          warmup: 'Empty bar first — feet, breath, easy depth',
          cue: 'Beat last time on set 1 — 9,8,8 → 9,9,9 → 10,10,10, then add 5',
        },
        {
          id: 't2', name: 'Push-up progression', target: '3×8–12 · floor',
          track: false, reps: true, rest: 'normal', pair: 'a', short: 'push-ups',
          menu: [
            'Incline push-up — hands on a bar or box; lower the height over time',
            'Eccentric-only from the floor — 3–5 s down, reset on knees',
            'Kneeling push-up — extra volume after inclines',
            'Full push-up singles — when the low incline feels easy',
          ],
          cue: 'Full sets on the floor — add a rep where you can. Body one long line, ribs down, glutes on',
        },
        {
          id: 't3', name: 'One-arm DB row', target: '3×8–10 /side · RIR 2',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'the row', step: 2.5,
          cue: 'Beat last time on set 1 — at 10,10,10 go to 27.5 · lead with the shoulder blade',
        },
        {
          id: 't9', name: 'Hamstring curl (machine)', target: '2×8–12 · RIR 2–3',
          track: true, reps: true, rest: 'normal', pair: 'b', short: 'curls',
          cue: 'Reps first — build to 12s, then add weight · slow on the way back',
        },
        {
          id: 't10', name: 'Ab-wheel rollout', target: '2×5–8 · kneeling, wall-stopped',
          track: false, reps: true, rest: 'normal', pair: 'b', short: 'rollouts',
          cue: 'Wall where 5–6 feel solid, no low-back arch · 2×8 → move further back',
        },
        {
          id: 'v7', name: 'Calf, single-leg', target: '2×8–15 /side · RIR 2',
          track: true, reps: true, rest: 'normal', pair: 'c', short: 'calves',
          menu: [
            'Split squat iso w/ calf raise — front foot off a box edge, nothing moves but the heel',
            '3D calf raise — roller into the wall, find the angles',
          ],
          cue: 'Bent knee, full range, slow heel drop · build past 8 toward 12–15',
        },
        {
          id: 't7', name: 'Hang / grip', target: '2×20–40 s',
          track: false, rest: 'normal', pair: 'c', short: 'hang',
          menu: ['Active→passive hang', 'Offset grip', 'Single-arm assisted', 'Traverse the bar'],
          cue: 'Active shoulders · feet on a box if needed',
        },
      ],
    },
    {
      id: 'voo',
      name: 'Voo',
      subtitle: 'Hinge · chin-up · press',
      dow: 6,
      slots: [
        {
          id: 'warm-voo', name: 'Warm-up', target: '~5 min',
          track: false, rest: 'normal',
          cue: 'Anything that raises your heart rate and warms your joints — bike, brisk incline walk, easy flow',
        },
        {
          id: 'v1', name: 'Kettlebell swing', target: '3×6–8 · crisp',
          track: true, rest: 'normal',
          cue: 'Snap the hips, float the bell — never to fatigue',
        },
        {
          id: 'v2', name: 'DB Romanian deadlift', target: '3×8–10 /hand · RIR 2–3',
          track: true, reps: true, rest: 'heavy',
          cue: 'Beat last time on set 1 — at 10,10,10 go to 45 · long hamstrings, neutral spine',
        },
        {
          id: 'v4', name: 'Chin-up progression', target: '3×6–8 · assisted',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'chin-ups',
          cue: 'Assisted machine — lower is harder. Add a rep or two each week (7,6,6 → 7,7,7 → 8,8,8); at 8,8,8, one pin less',
        },
        {
          id: 'v3', name: 'DB standing overhead press', target: '3×6–10 · RIR 2–3',
          track: true, reps: true, rest: 'normal', pair: 'a', short: 'the press', step: 2.5,
          cue: 'Stay at 15 and build to 10s, then 17.5 · ribs down, reach tall',
        },
        {
          id: 'v9', name: 'Bulgarian split squat', target: '2×8–10 /leg · RIR 3–4',
          track: true, added: true, reps: true, rest: 'normal', start: 0,
          cue: 'Back foot on a bench · bodyweight first (+0); dumbbells once 2×10 is easy',
        },
        {
          id: 'v10', name: 'Reverse crunch', target: '2×8–12',
          track: false, reps: true, rest: 'normal', pair: 'b', short: 'crunches',
          cue: 'Curl the pelvis up off the floor — slow down',
        },
        {
          id: 'v11', name: 'Calf, single-leg (optional)', target: '0–2×12–20 /side · if time',
          track: true, reps: true, light: true, optional: true, rest: 'normal', pair: 'b', short: 'calves',
          start: 10,
        },
      ],
    },
  ],
};
