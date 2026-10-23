/* Forte — Carolina's gym companion. One surface, one-press set (silent).
   Same engine as Strength Rebuild v2 at the bottom: tracked slots capture
   one working weight (prefilled from last session), menu slots take a note.
   reps: true adds one working-reps number to either kind — alone on the
   push-up slots, where the rung is the load and reps move the ladder.
   Sets are counted, never logged — the ring taps once per set and each tap
   starts that exercise's rest itself; the dock stays for manual rests. */

'use strict';

/* ============================== state ============================== */

const STORE_KEY = 'forte-state-v1';
const APP_VERSION = '2.2.0';

let state = null;

function slug(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function defaultState() {
  return {
    version: 1,
    settings: {
      unit: 'lb', theme: 'auto', restNormal: 90, restHeavy: 180, lastExport: null,
    },
    program: JSON.parse(JSON.stringify(SEED_PROGRAM)),
    sessions: [],
    active: null,
  };
}

function validState(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.version !== 1) return false;
  const s = obj.settings;
  if (!s || typeof s !== 'object') return false;
  if (s.unit == null || s.theme == null || !(s.restNormal > 0) || !(s.restHeavy > 0)) return false;
  if (!obj.program || !Array.isArray(obj.program.days)) return false;
  if (!Array.isArray(obj.sessions)) return false;
  return true;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (validState(parsed)) { state = parsed; return; }
    }
  } catch (e) { /* corrupted → fall through */ }
  state = defaultState();
  save();
}

// One-time program updates for installed devices — the seed only reaches
// fresh installs; the live program sits in localStorage. Staged by
// specVersion so each patch runs once and in-app edits afterward stick.
function patchProgram() {
  const p = state.program;
  if (!p) return;
  const v = parseFloat(p.specVersion) || 0;
  if (v >= 2.0) return;

  // 1.1: Voo's push-up practice carries the full progression ladder —
  // same menu as Terra, cue marks it as the slightly easier exposure.
  if (v < 1.1) {
    const voo = p.days.find((d) => d.id === 'voo');
    const pu = voo && voo.slots.find((s) => slug(s.name) === 'push-up-practice');
    if (pu) {
      pu.menu = [
        'Incline push-up — hands on a bar or box; lower the height over time',
        'Eccentric-only from the floor — 3–5 s down, reset on knees',
        'Kneeling push-up — extra volume after inclines',
        'Full push-up singles — when the low incline feels easy',
      ];
      pu.cue = 'Slightly easier version than Terra — crisp reps, stop two short of grinding. Same ladder: 3×8 crisp at one height → move down a notch';
    }
  }

  // 1.2: Terra's rests tell the truth. Push-up + row are a strength
  // pairing and carry + Pallof + hang cycle as a trio — 1:30 between
  // moves is right, so those slots get pair keys and the UI says why.
  // The hip thrust stands alone at RIR 1–2, so it takes the heavy tier.
  if (v < 1.2) {
    const terra = p.days.find((d) => d.id === 'terra');
    if (terra) {
      const bySlug = {};
      terra.slots.forEach((s) => { bySlug[slug(s.name)] = s; });
      const set = (key, fields) => { if (bySlug[key]) Object.assign(bySlug[key], fields); };
      set('push-up-progression', { pair: 'a', short: 'push-ups' });
      set('one-arm-db-row', { pair: 'a', short: 'the row' });
      set('hip-thrust-smith', { rest: 'heavy' });
      set('suitcase-carry', { pair: 'b', short: 'carry' });
      set('pallof-press', { pair: 'b', short: 'Pallof' });
      set('hang-grip', { pair: 'b', short: 'hang' });
    }
  }

  // 1.3: Carolina's own pairing map. Terra's hang stands alone after
  // all — carry + Pallof are the pair. Voo pairs the press with
  // chin-ups, and push-up practice + hollow body + calves cycle as a
  // quick trio at 1:00 between moves.
  if (v < 1.3) {
    const terra = p.days.find((d) => d.id === 'terra');
    const hang = terra && terra.slots.find((s) => slug(s.name) === 'hang-grip');
    if (hang) { delete hang.pair; delete hang.short; }
    const voo = p.days.find((d) => d.id === 'voo');
    if (voo) {
      const bySlug = {};
      voo.slots.forEach((s) => { bySlug[slug(s.name)] = s; });
      const set = (key, fields) => { if (bySlug[key]) Object.assign(bySlug[key], fields); };
      set('db-standing-overhead-press', { pair: 'a', short: 'the press' });
      set('chin-up-progression', { pair: 'a', short: 'chin-ups' });
      set('push-up-practice', { pair: 'b', short: 'push-ups', pairRest: 60 });
      set('hollow-body', { pair: 'b', short: 'hollow body', pairRest: 60 });
      set('calf-single-leg', { pair: 'b', short: 'calves', pairRest: 60 });
    }
  }

  // 1.4: Nordic curls enter the program. The Pallof crosses to Voo and
  // stands alone right before the push-up trio — before it, not in it;
  // a quartet is too much cycling. The Nordic ladder takes its old spot
  // next to the carry, so the Terra dupla keeps its shape.
  if (v < 1.4) {
    const terra = p.days.find((d) => d.id === 'terra');
    const voo = p.days.find((d) => d.id === 'voo');
    if (terra && voo) {
      const i = terra.slots.findIndex((s) => slug(s.name) === 'pallof-press');
      if (i !== -1) {
        const [pallof] = terra.slots.splice(i, 1);
        // Solo now — no pair keys, and the trio's quick rest isn't hers.
        delete pallof.pair; delete pallof.short; delete pallof.pairRest;
        const j = voo.slots.findIndex((s) => slug(s.name) === 'push-up-practice');
        voo.slots.splice(j !== -1 ? j : voo.slots.length, 0, pallof);
      }
    }
    if (terra && !terra.slots.some((s) => slug(s.name) === 'nordic-ladder')) {
      const c = terra.slots.findIndex((s) => slug(s.name) === 'suitcase-carry');
      terra.slots.splice(c !== -1 ? c + 1 : terra.slots.length, 0, {
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
      });
    }
  }

  // 1.5: push-ups get the working-reps chip. The ladder moves on "3×8
  // crisp at one height" but the number had nowhere to live — reps ride
  // alone on these menu slots (the rung is the load).
  if (v < 1.5) {
    for (const day of p.days) {
      for (const s of day.slots) {
        if (PUSHUP_IDS.includes(slug(s.name))) s.reps = true;
      }
    }
  }

  // 1.6: hip abduction joins Voo — the week's only frontal-plane hip
  // work (Terra owns extension). Solo after the Pallof, machine stack
  // and reps on the chip.
  if (v < 1.6) {
    const voo = p.days.find((d) => d.id === 'voo');
    if (voo && !voo.slots.some((s) => slug(s.name) === 'hip-abduction-machine')) {
      const slot = {
        id: 'v8', name: 'Hip abduction (machine)', target: '3×12–15',
        track: true, reps: true, rest: 'normal',
        cue: 'Slow push apart, pause wide, resist the ride back',
      };
      let i = voo.slots.findIndex((s) => slug(s.name) === 'pallof-press');
      if (i === -1) i = voo.slots.findIndex((s) => slug(s.name) === 'push-up-practice') - 1;
      voo.slots.splice(i >= 0 ? i + 1 : voo.slots.length, 0, slot);
    }
  }

  // 1.7: the hamstring curl machine takes the Nordic ladder's place on
  // Terra (same call as Strength Rebuild, 10/7) — still in the dupla with
  // the carry. Old Nordic entries stay in the log as they were.
  if (v < 1.7) {
    const terra = p.days.find((d) => d.id === 'terra');
    if (terra && !terra.slots.some((s) => slug(s.name) === 'hamstring-curl-machine')) {
      const curl = {
        id: 't9', name: 'Hamstring curl (machine)', target: '3×8–12 · RIR 2–3',
        track: true, reps: true, rest: 'normal', pair: 'b', short: 'curls',
        cue: 'Reps first — build to 12s, then add weight · slow on the way back',
      };
      const i = terra.slots.findIndex((s) => slug(s.name) === 'nordic-ladder');
      if (i !== -1) terra.slots.splice(i, 1, curl);
      else {
        const c = terra.slots.findIndex((s) => slug(s.name) === 'suitcase-carry');
        terra.slots.splice(c !== -1 ? c + 1 : terra.slots.length, 0, curl);
      }
    }
  }

  // 2.0: three days (10/17) — Água (Monday, the light day), Terra
  // (Wednesday) and Voo (Saturday). The days are rebuilt whole from the
  // seed; slot ids and exercise names carry over wherever a lift continues,
  // so history, prefill, Progresso and the Gym Log read straight through.
  // The old program is kept under programBackup. A slot's `start` is a
  // one-time Week 1 prefill, stamped now and used until that lift is next
  // logged.
  if (v < 2.0) {
    state.programBackup = {
      at: Date.now(), specVersion: p.specVersion || '',
      days: JSON.parse(JSON.stringify(p.days)),
    };
    const now = Date.now();
    p.days = JSON.parse(JSON.stringify(SEED_PROGRAM.days));
    for (const d of p.days) for (const s of d.slots) if (s.start != null) s.startAt = now;
  }

  p.specVersion = '2.0';
  save();
}

let saveTimer = null;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save — storage full?'); }
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
function flushSave() { clearTimeout(saveTimer); save(); }
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

/* ============================== helpers ============================== */

const $ = (sel) => document.querySelector(sel);

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtMMSS(sec) {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

// European Portuguese greeting by clock — tarde runs to 20h in Portugal.
function saudacao() {
  const h = new Date().getHours();
  if (h < 6) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 20) return 'Boa tarde';
  return 'Boa noite';
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function fmtDateLong(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function relPhrase(ts) {
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 11) return 'a week ago';
  return `${Math.round(days / 7)} weeks ago`;
}

// Monday-start weeks (Europe).
function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return d.getTime();
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function findDay(dayId) { return state.program.days.find((d) => d.id === dayId); }
function findSlot(day, slotId) { return day ? day.slots.find((s) => s.id === slotId) : null; }

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ========================= history & prefill ========================= */

// Most recent recorded weight for an exercise, matched by name-slug so it
// survives program edits.
function lastWeightFor(exerciseId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const entry = (state.sessions[i].entries || []).find(
      (e) => e.exerciseId === exerciseId && e.weight !== '' && e.weight != null
    );
    if (entry) return entry.weight;
  }
  return '';
}

// Working reps mirror the working weight: one number per exercise per
// session ("what did your work sets hit"), never per-set entry.
function lastRepsFor(exerciseId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const entry = (state.sessions[i].entries || []).find(
      (e) => e.exerciseId === exerciseId && e.reps > 0
    );
    if (entry) return entry.reps;
  }
  return '';
}

function lastSessionFor(dayId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    if (state.sessions[i].dayId === dayId) return state.sessions[i];
  }
  return null;
}

/* ---- push-up ladder & rung picks ---- */

// Menu items carry their own pill labels: everything before the first " — ".
function rungShort(item) { return String(item).split(/\s+—\s+/)[0]; }
function rungDetail(slot, sel) {
  const item = (slot.menu || []).find((m) => rungShort(m) === sel);
  if (!item) return '';
  const parts = String(item).split(/\s+—\s+/);
  return parts.length > 1 ? parts.slice(1).join(' — ') : '';
}

const PUSHUP_IDS = ['push-up-progression', 'push-up-practice'];

/* ============================ session core ============================ */

// A session begins lazily: the first weight tweak or note creates it, and only
// Finish → Save puts it in the log. Opening another day parks this draft
// instead of logging it; it comes back when that day is opened again.
function ensureActive(dayId) {
  if (state.active && state.active.dayId === dayId) return state.active;
  parkActive();
  state.active = takeDraft(dayId) || { dayId, startedAt: Date.now(), lastActivityAt: Date.now(), entries: {} };
  return state.active;
}

function parkActive() {
  if (!state.active) return;
  if (!state.drafts) state.drafts = {};
  state.drafts[state.active.dayId] = state.active;
  state.active = null;
}

function takeDraft(dayId) {
  const d = state.drafts && state.drafts[dayId];
  if (d) delete state.drafts[dayId];
  return d || null;
}

// Opening a day (or its finish screen) with a parked draft makes it the
// open session again, so its weights and rings show as they were left.
function resumeDraft(dayId) {
  if (state.active && state.active.dayId === dayId) return;
  if (!(state.drafts && state.drafts[dayId]) || !findDay(dayId)) return;
  parkActive();
  state.active = takeDraft(dayId);
  save();
}

function activeEntry(dayId, slotId) {
  const a = ensureActive(dayId);
  // The session exists now, so it can be discarded from this screen.
  const db = document.querySelector('.discardbtn.off');
  if (db) db.classList.remove('off');
  if (!a.entries[slotId]) a.entries[slotId] = { weight: null, note: '' };
  a.lastActivityAt = Date.now();
  return a.entries[slotId];
}

// A slot's one-time Week 1 load: shown until the lift is logged again after
// the program change that set it, then ordinary prefill takes over.
function startFor(slot) {
  if (slot.start == null) return null;
  const ex = slug(slot.name);
  const since = slot.startAt || 0;
  for (const sess of state.sessions) {
    if ((sess.endedAt || sess.startedAt || 0) < since) continue;
    if ((sess.entries || []).some((e) => e.exerciseId === ex && e.weight !== '' && e.weight != null)) return null;
  }
  return slot.start;
}

// Effective weight shown on a slot chip: session adjustment wins, else the
// Week 1 start, else prefill.
function effectiveWeight(dayId, slot) {
  const a = state.active;
  const e = a && a.dayId === dayId ? a.entries[slot.id] : null;
  if (e && e.weight != null && e.weight !== '') return e.weight;
  if (e && e.weight === '') return '';
  const st = startFor(slot);
  if (st != null) return st;
  return lastWeightFor(slug(slot.name));
}

// Optional slots (a "0–2×" add-on) never hold back the trail or Finish.
function requiredSlots(day) { return day.slots.filter((s) => !s.optional); }
function isDone(a, s) { return !!(a && a.entries[s.id] && a.entries[s.id].done); }

// Build and push the session record for a day's active entries, then clear
// the active session. Navigation, rest, save, and toasts stay with callers.
// Auto-banked sessions are kept for prefill but flagged so Progresso's
// rhythm and trends only count sessions she actually finished.
function recordSession(dayId, note, auto) {
  const day = findDay(dayId);
  if (!day) { state.active = null; return; }
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  const entries = [];
  for (const slot of day.slots) {
    const e = a ? a.entries[slot.id] : null;
    const slotNote = e && e.note ? e.note.trim() : '';
    const rung = e && e.rung ? e.rung : '';
    // Counted sets ride along on the record (still no per-set numbers).
    const sets = e && e.sets ? Math.min(e.sets, setTarget(slot) || e.sets) : 0;
    if (slot.track) {
      const w = effectiveWeight(dayId, slot);
      const entry = { exerciseId: slug(slot.name), name: slot.name, weight: w === '' ? '' : parseFloat(w), note: slotNote };
      if (slot.reps) {
        const banked = bankedReps(e);
        const r = banked.length ? Math.min(...banked) : effectiveReps(dayId, slot);
        entry.reps = r === '' ? '' : parseInt(r, 10);
        if (banked.length) entry.repsBySet = banked;
      }
      if (rung) entry.rung = rung;
      if (sets) entry.sets = sets;
      entries.push(entry);
    } else if (slotNote || rung || sets || (slot.reps && e && e.reps != null && e.reps !== '')) {
      // Menu slots record only when touched; once the entry exists, reps
      // carry prefill — same deal as tracked weights.
      const entry = { exerciseId: slug(slot.name), name: slot.name, weight: '', note: slotNote };
      if (slot.reps) {
        const banked = bankedReps(e);
        const r = banked.length ? Math.min(...banked) : effectiveReps(dayId, slot);
        if (r !== '' && r != null) entry.reps = parseInt(r, 10);
        if (banked.length) entry.repsBySet = banked;
      }
      if (rung) entry.rung = rung;
      if (sets) entry.sets = sets;
      entries.push(entry);
    }
  }
  const rec = {
    id: uid(), v: 1,
    dayId: day.id, dayName: `${day.name} — ${day.subtitle}`,
    startedAt: a ? a.startedAt : Date.now(),
    endedAt: Date.now(),
    note: (note || '').trim(),
    entries,
  };
  if (auto) rec.auto = true;
  state.sessions.push(rec);
  state.active = null;
}

/* ---- per-set reps (10/17) ----
   Each tap on a counting ring banks that set's reps from the chip into
   repsBySet. The chip always shows the set about to be banked: last
   session's same set when there is one (the number to match or beat),
   else the set just banked. A saved entry keeps `reps` as the LOWEST set,
   so "one pin less" / "add weight" still means every set reached the top
   and Progresso and the Gym Log keep reading `reps`; repsBySet rides
   along for the detail. */
function bankedReps(e) { return e && Array.isArray(e.repsBySet) ? e.repsBySet.filter((r) => r > 0) : []; }

// The newest logged entry with reps: its per-set list, or null if it
// predates per-set logging.
function lastRepsBySetFor(exerciseId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const en = (state.sessions[i].entries || []).find((x) => x.exerciseId === exerciseId && (x.reps > 0 || Array.isArray(x.repsBySet)));
    if (en) return Array.isArray(en.repsBySet) ? en.repsBySet : null;
  }
  return null;
}

function effectiveReps(dayId, slot) {
  const a = state.active;
  const e = a && a.dayId === dayId ? a.entries[slot.id] : null;
  if (e && e.reps != null && e.reps !== '') return e.reps;
  if (e && e.reps === '') return '';
  const banked = bankedReps(e);
  if (e && e.done && banked.length) return Math.min(...banked);
  const n = (e && e.sets) || 0;
  const prev = lastRepsBySetFor(slug(slot.name));
  if (prev && prev[n] > 0) return prev[n];
  if (banked.length) return banked[banked.length - 1];
  if (prev && prev.length) return prev[prev.length - 1];
  return lastRepsFor(slug(slot.name));
}

function finishSession(dayId, note) {
  if (!findDay(dayId)) return;
  recordSession(dayId, note);
  restCancel();
  save();
  location.hash = '#/';
  toast('Session saved');
  syncPush();
}

// Only Finish → Save logs a session, and only Discard drops one. An open
// session waits, however long, as "In progress" until one of the two.
function discardSession(dayId) {
  if (state.active && state.active.dayId === dayId) state.active = null;
  if (state.drafts) delete state.drafts[dayId];
  restCancel();
  save();
  location.hash = '#/';
  toast('Session discarded');
}

// Earlier versions logged unfinished sessions automatically (left open 12h,
// or replaced by opening the other day). Those were never submitted, so they
// leave the log for `unsubmitted`: kept in exports, counted nowhere.
function quarantineAutoSessions() {
  const isAuto = (x) => x.auto === true || x.note === '(auto-saved — session left open)';
  const auto = state.sessions.filter(isAuto);
  if (!auto.length) return;
  state.unsubmitted = (state.unsubmitted || []).concat(auto);
  state.sessions = state.sessions.filter((x) => !isAuto(x));
  save();
}


/* ====================== rest engine (silent) ======================
   No audio: media playback would take the iOS audio session and cut off
   whatever she's listening to for the whole rest. End of rest =
   vibration where supported + the dock's visual done state. */

const rest = { running: false, endsAt: 0, total: 0, tier: null, done: false, label: null };
let restTick = null;

function buzz() {
  try { if (navigator.vibrate) navigator.vibrate([220, 120, 220, 120, 320]); } catch (e) {}
}

/* ---- screen wake lock (nice-to-have) ---- */
let wakeLock = null;
async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }
}
function releaseWakeLock() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
}

/* ---- rest control ---- */

function restStart(tier, label, forSlot) {
  const sec = tier === 'heavy' ? state.settings.restHeavy : normalRestSec(forSlot);
  rest.running = true;
  rest.done = false;
  rest.tier = tier;
  rest.label = label || null;
  rest.total = sec;
  rest.endsAt = Date.now() + sec * 1000;
  requestWakeLock();
  startRestTick();
  renderRestDock();
}

function restCancel() {
  rest.running = false;
  rest.done = false;
  releaseWakeLock();
  stopRestTick();
  renderRestDock();
}

function restFinish() {
  rest.running = false;
  rest.done = true;
  buzz();
  releaseWakeLock();
  stopRestTick();
  renderRestDock();
  setTimeout(() => { if (rest.done && !rest.running) { rest.done = false; renderRestDock(); } }, 4000);
}

function startRestTick() {
  stopRestTick();
  restTick = setInterval(() => {
    if (!rest.running) return;
    const left = (rest.endsAt - Date.now()) / 1000;
    if (left <= 0) { restFinish(); return; }
    updateRestTime(left);
  }, 250);
}
function stopRestTick() { clearInterval(restTick); restTick = null; }

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && rest.running && Date.now() >= rest.endsAt) restFinish();
});

/* ============================== views ============================== */

// One small stroke-icon set (24-grid, round caps), shared with Strength
// Rebuild, so every glyph is drawn the same way instead of borrowed from a font.
const ICON_PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2h4"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  again: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/>',
  note: '<path d="M14.5 5.5l4 4"/><path d="M4.5 19.5l1-4.5L16 4.5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9 18.5z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  dn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  pair: '<path d="M7 8h13m0 0-3-3m3 3-3 3M17 16H4m0 0 3-3m-3 3 3 3"/>',
  climb: '<path d="M4 19.5h4.5V15H13v-4.5h4.5V6H20"/><path d="M16.5 3.5L20 6l-2.5 3.5"/>',
};
function icon(name, sw) {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 2}"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
}

function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

// Home: the date and the gear. A session is a sheet over home, so it
// closes downward to Início; every other page steps back.
function topbar(backTo, sheet) {
  if (!backTo) {
    const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    return `<div class="topbar home"><div class="topdate">${esc(date)}</div>
      <a class="gear" href="#/settings" aria-label="Settings">${icon('gear', 1.8)}</a></div>`;
  }
  const left = sheet
    ? `<a class="backlink" href="${backTo}" aria-label="Close session, back to Início">${icon('down', 2.4)}Início</a>`
    : `<a class="backlink" href="${backTo}">${icon('back', 2.4)}Back</a>`;
  return `<div class="topbar">${left}</div>`;
}

/* ---- ornaments ----
   Drawn once, in one hand: a fine stroke with a soft rosé fill. The day
   marks sit in a tinted tile; the sprig signs off home and Progresso; the
   bloom is how finishing looks — an exercise, a dupla, a whole session. */

// Água is a drop over still water; Terra sprouts from the ground; Voo is
// two birds in flight.
function dayGlyphHTML(dayId) {
  if (dayId === 'agua') return `
    <svg class="dayglyph" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.6c2.9 3.5 5 6.3 5 8.9a5 5 0 0 1-10 0c0-2.6 2.1-5.4 5-8.9z" fill="currentColor" fill-opacity=".2"/>
      <path d="M10 13.4c.2 1.1 1 1.9 2.1 2.1" stroke-width="1.4"/>
      <path d="M3.5 20.2c1.4-.9 2.8-.9 4.2 0s2.8.9 4.3 0 2.8-.9 4.3 0 2.8.9 4.2 0"/>
    </g></svg>`;
  if (dayId === 'terra') return `
    <svg class="dayglyph" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5c2.6-1.3 5.3-2 8-2s5.4.7 8 2"/>
      <path d="M12 17.5v-6.2"/>
      <path d="M12 12.6C11 9.3 8.2 7.6 4.8 8c.4 3.3 3.3 5 7.2 4.6z" fill="currentColor" fill-opacity=".2"/>
      <path d="M12 11.3c.6-3.6 3.4-6 7.2-6-.2 3.7-3 6.1-7.2 6z" fill="currentColor" fill-opacity=".2"/>
    </g></svg>`;
  if (dayId === 'voo') return `
    <svg class="dayglyph" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2.8 12.2c3.2-1.6 6.4-.9 9.2 2.6 2.8-3.5 6-4.2 9.2-2.6"/>
      <path d="M13.6 6.6c1.5-.7 2.9-.4 4 1 1.1-1.4 2.5-1.7 4-1" stroke-width="1.5"/>
    </g></svg>`;
  return '';
}

// A rose stem: one bud, two leaves. It stands on the Up next card, draws
// itself in the launch greeting, and signs off Progresso.
function sprigHTML(cls) {
  return `
    <svg class="sprig ${cls || ''}" viewBox="0 0 48 76" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M24 74c-1.2-13 .6-27-.2-46"/>
      <path d="M23.7 55c-6.8-.4-11.2-5-12.2-11.6 6.4.4 11 5 12.2 11.6z" fill="currentColor" fill-opacity=".18"/>
      <path d="M24 44.5c6.6-.8 10.8-5.6 11.4-12-6.3.6-10.7 5.4-11.4 12z" fill="currentColor" fill-opacity=".18"/>
      <path d="M18.4 25.2c-2.6.6-4.6 0-6-1.6M29.6 25.2c2.6.6 4.6 0 6-1.6"/>
      <path d="M24 28c-5.6-.6-7.8-6.4-6-12.4 1.6 2 3.8 3.1 6 3.1s4.4-1.1 6-3.1c1.8 6-.4 11.8-6 12.4z" fill="currentColor" fill-opacity=".22"/>
      <path d="M24 18.7c-2.4-3.6-2-8.4 0-11.2 2 2.8 2.4 7.6 0 11.2z" fill="currentColor" fill-opacity=".14"/>
    </g></svg>`;
}

// Five petals around a centre. Each petal is its own group so the bloom can
// open one petal at a time (CSS staggers on --i).
function bloomSVG(cls) {
  const petal = 'M50 49C41.5 42.5 40 28 50 16c10 12 8.5 26.5 0 33z';
  const outer = [0, 1, 2, 3, 4].map((i) =>
    `<g transform="rotate(${i * 72} 50 50)"><path class="petal" style="--i:${i}" d="${petal}"/></g>`).join('');
  const inner = [0, 1, 2, 3, 4].map((i) =>
    `<g transform="rotate(${36 + i * 72} 50 50) translate(50 50) scale(.56) translate(-50 -50)"><path class="petal in" style="--i:${i + 5}" d="${petal}"/></g>`).join('');
  return `
    <svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${outer}${inner}</g>
      <circle class="bloom-core" cx="50" cy="50" r="5.5" fill="currentColor"/>
    </svg>`;
}

/* ---- home ----
   Up next: one decisive card for the day she's on, the other day as a
   row, then Progresso. Opens with the greeting, which first plays as its
   own brief screen at launch and then settles into place. */

function greetingHTML() {
  return `<div class="greet"><h1 class="greet-ola">${esc(saudacao())}, Carolina</h1></div>`;
}

function lastRealSessionFor(dayId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    if (s.dayId === dayId && !s.auto) return s;
  }
  return null;
}

// The day she's on: an open session wins. Days with a weekday (dow) follow
// the calendar — today's day until it's done today, then the next one on
// the schedule; a missed day just shows in the rows below. Without
// weekdays, the day trained least recently (never-trained first).
function suggestedDay() {
  if (state.active && findDay(state.active.dayId)) return findDay(state.active.dayId);
  const sched = state.program.days.filter((d) => Number.isInteger(d.dow));
  if (sched.length) {
    const dow = new Date().getDay();
    const ahead = (d) => (d.dow - dow + 7) % 7;
    const order = sched.slice().sort((x, y) => ahead(x) - ahead(y));
    for (const d of order) {
      if (ahead(d) === 0) {
        const last = lastRealSessionFor(d.id);
        if (last && startOfDay(last.endedAt) === startOfDay(Date.now())) continue;
      }
      return d;
    }
    return order[0];
  }
  let best = null;
  let bestT = Infinity;
  for (const day of state.program.days) {
    const last = lastRealSessionFor(day.id);
    const t = last ? last.endedAt : -Infinity;
    if (t < bestT) { best = day; bestT = t; }
  }
  return best;
}

// A day's usual length, from her last few finished sessions, to 5 minutes.
function typicalMinutes(dayId) {
  const mins = realSessions().filter((s) => s.dayId === dayId).slice(-6)
    .map((s) => (s.endedAt - s.startedAt) / 60000).filter((m) => m >= 10 && m <= 180);
  if (!mins.length) return null;
  return Math.round(mins.reduce((a, b) => a + b, 0) / mins.length / 5) * 5;
}

// "In progress", "Done today", or how long ago.
function dayStatusHTML(day) {
  const last = lastSessionFor(day.id);
  if ((state.active && state.active.dayId === day.id) || (state.drafts && state.drafts[day.id])) return '<span class="daycard-live">In progress</span>';
  if (last && !last.auto && startOfDay(last.endedAt) === startOfDay(Date.now())) {
    return `<span class="daycard-done">${bloomSVG('bloom-mini')}Done today</span>`;
  }
  return `<span>${last ? esc(lastPhrase(last.endedAt)) : 'Not yet'}</span>`;
}

// When a day was last trained: "Yesterday", a weekday within the week,
// then the plain relative phrase.
function lastPhrase(ts) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
  return cap(relPhrase(ts));
}

// When the up-next day falls: "Today", "Tomorrow", or its weekday.
function whenLabel(day) {
  if (!Number.isInteger(day.dow)) return '';
  const ahead = (day.dow - new Date().getDay() + 7) % 7;
  if (ahead === 0) return 'Today';
  if (ahead === 1) return 'Tomorrow';
  const d = new Date(); d.setDate(d.getDate() + ahead);
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

// Weeks, Monday first: sessions per week and the two-a-week streak.
function rhythmStats() {
  const real = realSessions();
  if (!real.length) return null;
  const firstW = weekStart(real[0].endedAt);
  const nowW = weekStart(Date.now());
  const weeks = [];
  const d = new Date(nowW);
  while (weeks.length < 6 && d.getTime() >= firstW) {
    const ws = d.getTime();
    weeks.unshift({ start: ws, count: real.filter((s) => weekStart(s.endedAt) === ws).length });
    d.setDate(d.getDate() - 7);
  }
  const n = weeklyTarget();
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].start === nowW) { if (weeks[i].count >= n) streak++; continue; }
    if (weeks[i].count >= n) streak++; else break;
  }
  const thisWeek = weeks.length && weeks[weeks.length - 1].start === nowW ? weeks[weeks.length - 1].count : 0;
  return { weeks, streak, thisWeek, nowW };
}

// Sessions a week: one per scheduled day (three), else the old two.
function weeklyTarget() {
  const n = state.program.days.filter((d) => Number.isInteger(d.dow)).length;
  return n || 2;
}

function weekLine(st) {
  const n = weeklyTarget();
  const word = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'][n] || String(n);
  if (!st) return `${word} a week is the rhythm`;
  const run = st.streak >= 2 ? ` · ${st.streak} weeks running` : '';
  if (st.thisWeek >= n) return `${st.thisWeek === n ? word : st.thisWeek} this week${run}`;
  return `${st.thisWeek} of ${n} this week${run}`;
}

// This week's seven days: what she trained on each, and which is today.
function weekDays() {
  const ws = weekStart(Date.now());
  const today = startOfDay(Date.now());
  const real = realSessions();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const t = startOfDay(d.getTime());
    out.push({
      t, num: d.getDate(),
      letter: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      days: real.filter((s) => startOfDay(s.endedAt) === t).map((s) => s.dayId),
      today: t === today, future: t > today,
    });
  }
  return out;
}

// The lift that has grown most since her first session.
function bestGain() {
  let best = null;
  for (const row of sinceRows()) {
    if (row.assisted || row.pts.length < 2) continue;
    const a = row.pts[0].w, b = row.pts[row.pts.length - 1].w;
    const pct = a > 0 ? (b - a) / a : 0;
    if (b > a && (!best || pct > best.pct)) best = { row, pct, delta: +(b - a).toFixed(1) };
  }
  return best;
}

// The way into Progresso: the last row on home, in the days' list. A pill
// when lifts are ready to move up; no second line unless there's
// something to do.
function progressoRowHTML() {
  const ready = nextSessionItems().filter((i) => i.ready).length;
  return `
    <a class="dayrow progrow-home" href="#/progresso">
      <span class="dr-glyph">${icon('climb', 1.8)}</span>
      <span class="dr-name">Progresso</span>
      ${ready ? `<span class="pill">${ready} ready</span>` : ''}${icon('chev', 2.4)}
    </a>`;
}

// Home: the greeting, one decisive Up next card with the sprig standing
// on its floor, this week as seven dots, then the other days and Progresso
// as plain rows in one list. Fits one iPhone screen.
function viewHome() {
  const next = suggestedDay();
  const st = rhythmStats();
  const rows = (days) => `<div class="group homerows">${days.map((d) => `
    <a class="dayrow" href="#/day/${d.id}">
      <span class="dr-glyph">${dayGlyphHTML(d.id)}</span>
      <span class="dr-name">${esc(d.name)}</span>
      <span class="dr-when">${dayStatusHTML(d)}</span>${icon('chev', 2.4)}
    </a>`).join('')}${progressoRowHTML()}</div>`;
  if (!next) return `${topbar()}${greetingHTML()}${weekStripHTML(st)}${rows([])}`;
  const live = !!(state.active && state.active.dayId === next.id);
  const when = whenLabel(next);
  const others = state.program.days.filter((d) => d.id !== next.id);
  return `
    ${topbar()}
    ${greetingHTML()}
    <a class="upnext" href="#/day/${next.id}">
      <span class="upnext-k ${live ? 'live' : ''}">${live ? '' : `<span class="upnext-glyph">${dayGlyphHTML(next.id)}</span>`}${live ? 'In progress' : `Up next${when ? ' · ' + esc(when) : ''}`}</span>
      <span class="upnext-name">${esc(next.name)}</span>
      <span class="upnext-sub">${esc(next.subtitle)}</span>
      <span class="upnext-foot">
        <span class="upnext-go">${live ? 'Resume' : 'Start'}${icon('chev', 2.6)}</span>
        ${sprigHTML('upnext-sprig')}
      </span>
    </a>
    ${weekStripHTML(st)}
    ${rows(others)}`;
}

// This week as seven dots, Monday first: filled where she trained, a rose
// ring on a scheduled day still ahead, today's letter set in a capsule.
function weekStripHTML(st) {
  const dows = new Set(state.program.days.filter((d) => Number.isInteger(d.dow)).map((d) => d.dow));
  const n = weeklyTarget();
  const count = st ? st.thisWeek : 0;
  const days = weekDays().map((d, i) => {
    const dow = (i + 1) % 7;
    const kind = d.days.length ? 'done' : (dows.has(dow) && (d.future || d.today)) ? 'plan' : '';
    const names = d.days.map((id) => { const x = findDay(id); return x ? x.name : id; });
    const label = d.days.length ? `trained ${names.join(', ')}` : kind === 'plan' ? 'planned' : 'rest';
    return `<div class="wk-day ${d.today ? 'today' : ''}" aria-label="${esc(d.letter)}${d.today ? ', today' : ''}, ${esc(label)}">
      <span class="wk-l">${esc(d.letter)}</span><span class="wk-dot ${kind}"></span></div>`;
  }).join('');
  return `
    <div class="week">
      <div class="week-head"><span class="week-k">This week</span><span class="week-n">${Math.min(count, 99)} of ${n}</span></div>
      <div class="wk-row">${days}</div>
    </div>`;
}

/* ---- greeting splash ----
   At launch the greeting gets the whole screen for a moment: the sprig
   draws itself, the words rise, then the words glide up into the home
   greeting and the page settles in under them. Tap to skip. */

let splashTimer = null;
function showSplash() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = $('.greet-ola');
  if (!target) return;
  const old = $('.splash');
  if (old) old.remove();
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="splash-inner">
      ${sprigHTML().replace(/<path /g, '<path pathLength="1" ')}
      <div class="splash-ola">${esc(saudacao())}, Carolina</div>
      <div class="splash-date">${esc(date)}</div>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('splashing');
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearTimeout(splashTimer);
    const words = el.querySelector('.splash-ola');
    const from = words.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    words.style.transform = `translate(${(to.left - from.left).toFixed(1)}px, ${(to.top - from.top).toFixed(1)}px)`;
    el.classList.add('settling');
    document.body.classList.remove('splashing');
    document.body.classList.add('settle-in');
    setTimeout(() => {
      el.remove();
      document.body.classList.remove('settle-in');
    }, 640);
  };
  el.addEventListener('click', settle);
  // Leaving home mid-splash (a resume link could) settles too.
  window.addEventListener('hashchange', settle, { once: true });
  splashTimer = setTimeout(settle, 1250);
}

/* ---- workout ---- */

function rungsHTML(slot, entry) {
  const sel = entry && entry.rung ? entry.rung : '';
  const pills = slot.menu.map((m) => {
    const s = rungShort(m);
    const on = sel === s;
    return `<button class="rung ${on ? 'on' : ''}" data-action="rung" data-slot="${slot.id}"
      data-rung="${esc(s)}" aria-pressed="${on}">${esc(s)}</button>`;
  }).join('');
  const detail = sel ? rungDetail(slot, sel) : '';
  return `
    <div class="rungs" data-rungs="${slot.id}">${pills}</div>
    <div class="rung-detail ${detail ? '' : 'hidden'}" data-rungdetail="${slot.id}">${esc(detail)}</div>`;
}

// Sets-per-exercise reads straight off the target string ("4×8–12" → 4,
// "2–3 easy sets" → 3), so her installed program needs no migration and
// in-app edits keep working. A "sets" range counts to its top — the ring
// can sit under-filled on an easy day; the count is a nudge, not a ledger.
// No match (warm-up's "~5 min") → the plain one-tap done ring.
function setTarget(slot) {
  const t = String(slot.target || '').trim();
  let m = /^(\d+)\s*[×x]/.exec(t);
  if (!m) m = /^(?:\d+\s*[–-]\s*)?(\d+)\s+(?:\w+\s+)?sets?\b/.exec(t);
  const n = m ? parseInt(m[1], 10) : 0;
  return n >= 2 && n <= 12 ? n : 0;
}

// Plain rest captions: the ring already says what happened.
function restLabelFor(n, total) {
  return `Set ${n} of ${total}`;
}

const RING_CIRC = 2 * Math.PI * 12;

// The ring: 28px visual, an invisible inset takes the hit area to ~50pt.
// One ring for every kind of slot: a counting ring draws an arc per set;
// done is the same mark everywhere — a soft rose fill with a rose check.
// `fresh` plays the completion phrase: the fill blooms out of the closed
// ring, then the check writes itself.
function ringHTML(slot, e, fresh) {
  const done = !!(e && e.done);
  const total = setTarget(slot);
  const n = total ? (done ? total : Math.min((e && e.sets) || 0, total - 1)) : 0;
  const off = RING_CIRC * (1 - (total ? n / total : 0));
  const label = total ? (done ? 'Reset sets' : `Count one set (${n} of ${total})`) : 'Mark done';
  return `
    <button class="ring ${total ? 'counting' : ''} ${done ? 'on' : ''} ${fresh ? 'fresh' : ''}" data-action="done" data-slot="${slot.id}"
      aria-label="${label}" aria-pressed="${done}">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle class="ring-track" cx="14" cy="14" r="12"></circle>
        ${total ? `<circle class="ring-arc" cx="14" cy="14" r="12"
          style="stroke-dasharray:${RING_CIRC.toFixed(2)};stroke-dashoffset:${off.toFixed(2)}"></circle>` : ''}
        <circle class="ring-fill" cx="14" cy="14" r="12"></circle>
        <path class="ring-check" pathLength="1" d="M8.8 14.4l3.4 3.4 7-7.6"></path>
      </svg>
      ${total && !done && n ? `<span class="ring-count">${n}</span>` : ''}
    </button>`;
}

function slotEntry(dayId, slot) {
  const a = state.active;
  return a && a.dayId === dayId ? a.entries[slot.id] || null : null;
}

// Last time's rung, shown as a reference only — never saved unless picked.
function lastRungFor(exerciseId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const en = (state.sessions[i].entries || []).find((e) => e.exerciseId === exerciseId && e.rung);
    if (en) return en.rung;
  }
  return '';
}

// Under the name: the target, then today's rung (or last time's, dimmer).
function subHTML(dayId, slot) {
  const e = slotEntry(dayId, slot);
  let rung = '';
  if (slot.menu && slot.menu.length) {
    if (e && e.rung) rung = `<span class="sub-r now">${esc(e.rung)}</span>`;
    else {
      const last = lastRungFor(slug(slot.name));
      if (last) rung = `<span class="sub-r">Last: ${esc(last)}</span>`;
    }
  }
  const t = slot.target ? `<span class="sub-t">${esc(slot.target)}</span>` : '';
  const b = bankedReps(e);
  const sets = b.length ? `<span class="sub-dot"> · </span><span class="sub-r now">sets ${esc(b.join('/'))}</span>` : '';
  return t + (t && rung ? '<span class="sub-dot"> · </span>' : '') + rung + sets;
}

// Today's number, right-aligned: weight (and reps), or reps alone on push-ups.
function valHTML(dayId, slot) {
  if (slot.track) {
    const w = effectiveWeight(dayId, slot);
    const r = slot.reps ? effectiveReps(dayId, slot) : null;
    const hasR = !(r === '' || r == null);
    if (w === '' || w == null) {
      return `<span class="val-add">Add</span>${hasR ? `<span class="val-reps">×${esc(String(r))}</span>` : ''}`;
    }
    return `<span class="val-num">${esc((slot.added ? '+' : '') + w)}</span><span class="val-unit">${esc(state.settings.unit)}</span>${
      slot.reps ? `<span class="val-reps">×${hasR ? esc(String(r)) : '—'}</span>` : ''}`;
  }
  if (slot.reps) {
    const r = effectiveReps(dayId, slot);
    return r === '' || r == null ? '<span class="val-add">Reps</span>' : `<span class="val-num">×${esc(String(r))}</span>`;
  }
  return '';
}

function refreshRow(dayId, slot) {
  const card = $(`[data-slotcard="${slot.id}"]`);
  if (!card) return;
  const v = card.querySelector('.val');
  if (v) v.innerHTML = valHTML(dayId, slot);
  const s = card.querySelector('.slot-sub');
  if (s) s.innerHTML = subHTML(dayId, slot);
}

function stepRow(tag, kind, slot, d, value, mode) {
  return `
    <div class="edit-row"><span class="edit-tag">${esc(tag)}</span>
      <button class="step" data-action="${kind === 'weight' ? 'step' : 'rstep'}" data-slot="${slot.id}" data-d="-${d}" aria-label="Minus ${d}">−${d}</button>
      <input class="chip-input" type="number" inputmode="${mode}" ${kind === 'weight' ? 'step="any"' : ''}
        data-action="${kind}" data-slot="${slot.id}" value="${value === '' || value == null ? '' : esc(String(value))}" aria-label="${esc(tag)}">
      <button class="step" data-action="${kind === 'weight' ? 'step' : 'rstep'}" data-slot="${slot.id}" data-d="${d}" aria-label="Plus ${d}">+${d}</button>
    </div>`;
}

// One line per exercise: ring · name over target · today's number. Tapping
// the row opens its drawer (cue, ladder, steppers, note); one at a time.
function slotCardHTML(day, slot, onMat) {
  const a = slotEntry(day.id, slot);
  const note = a && a.note ? a.note : '';
  const done = !!(a && a.done);
  const partners = onMat ? [] : pairPartners(day, slot);
  const pairNote = partners.length
    ? `<div class="pair-note">${icon('pair', 2.4)}With ${esc(pairNames(day, slot))} — ${partners.length > 1 ? 'cycle through' : 'alternate sets'}</div>`
    : '';
  const warmup = slot.warmup
    ? `<div class="warmup"><span class="warmup-tag">Warm-up</span> ${esc(slot.warmup)}</div>` : '';
  const menu = slot.menu && slot.menu.length ? rungsHTML(slot, a) : '';
  let steppers = '';
  if (slot.track || slot.reps) {
    const rows = [];
    if (slot.track) rows.push(stepRow(state.settings.unit, 'weight', slot, slot.step || 5, effectiveWeight(day.id, slot), 'decimal'));
    if (slot.reps) rows.push(stepRow('reps', 'reps', slot, 1, effectiveReps(day.id, slot), 'numeric'));
    steppers = `<div class="chip-edit" data-edit="${slot.id}">${rows.join('')}</div>`;
  }
  const val = slot.track || slot.reps
    ? `<button class="val" data-action="expand" data-slot="${slot.id}" aria-label="Adjust">${valHTML(day.id, slot)}</button>` : '';
  return `
    <div class="slot ${done ? 'done' : ''} ${a && a.sets && !done ? 'live' : ''} ${note.trim() ? 'has-note' : ''}" data-slotcard="${slot.id}">
      <div class="slot-row">
        ${ringHTML(slot, a)}
        <button class="slot-main" data-action="expand" data-slot="${slot.id}" aria-expanded="false">
          <span class="slot-name">${esc(slot.name)}<i class="note-dot" aria-label="has a note"></i></span>
          <span class="slot-sub">${subHTML(day.id, slot)}</span>
        </button>
        ${val}
      </div>
      <div class="slot-drawer hidden" data-drawer="${slot.id}">
        ${slot.cue ? `<div class="slot-cue">${esc(slot.cue)}</div>` : ''}
        ${pairNote}${warmup}${menu}${steppers}
        <div class="note-edit" data-noteedit="${slot.id}">
          <textarea rows="2" data-action="notetext" data-slot="${slot.id}"
            placeholder="How did it go?">${esc(note)}</textarea>
        </div>
      </div>
    </div>`;
}

// Slots sharing a pair key are done together, alternating sets — the
// normal rest between moves is the point, and the UI says who's paired.
function pairPartners(day, slot) {
  if (!day || !slot || !slot.pair) return [];
  return day.slots.filter((s) => s.pair === slot.pair && s.id !== slot.id);
}

function shortName(slot) {
  return slot.short || String(slot.name).split(/[(—/]/)[0].trim();
}

function pairNames(day, slot) {
  return pairPartners(day, slot).map(shortName).join(' + ');
}

// A group can carry its own quicker rest (pairRest, seconds). While
// she's inside the group the normal tier takes it — dock and card agree.
function pairRestSec(day, slot) {
  if (day && slot && slot.pair) {
    const g = day.slots.find((s) => s.pair === slot.pair && s.pairRest > 0);
    if (g) return g.pairRest;
  }
  return state.settings.restNormal;
}

// forSlot: the exercise whose set just banked (counting ring) — its
// group's rest wins even when she works out of order. Dock taps pass
// nothing and anchor on the first unchecked slot.
function normalRestSec(forSlot) {
  const dayId = currentDayId();
  return pairRestSec(findDay(dayId), forSlot || (dayId ? currentSlot(dayId) : null));
}

// First unchecked slot in program order — what she's on right now.
function currentSlot(dayId) {
  const day = findDay(dayId);
  if (!day) return null;
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  return day.slots.find((s) => !(a && a.entries[s.id] && a.entries[s.id].done)) || null;
}

// Every dock state is the same 64px box, so nothing below ever jumps.
function restDockHTML(dayId) {
  if (rest.running) {
    const left = (rest.endsAt - Date.now()) / 1000;
    const pct = Math.max(0, Math.min(100, (1 - left / rest.total) * 100));
    return `
      <div class="rest-running">
        <div class="rest-fill" data-rest-fill style="width:${pct}%"></div>
        <div class="rest-row">
          <div class="rest-time" data-rest-time>${fmtMMSS(left)}</div>
          <span class="rest-label">${esc(rest.label || 'Rest')}</span>
          <button class="rest-mini" data-action="rest-restart" aria-label="Restart rest">${icon('again', 2.2)}</button>
          <button class="rest-mini" data-action="rest-cancel" aria-label="Stop rest">${icon('close', 2.2)}</button>
        </div>
      </div>`;
  }
  if (rest.done) {
    return `<button class="rest-done" data-action="rest-ack">Rest done</button>`;
  }
  // The tier the current exercise wants takes the rose; inside a group
  // with its own rest, the normal button carries that time.
  const cur = dayId ? currentSlot(dayId) : null;
  const heavy = !!(cur && cur.rest === 'heavy');
  const nSec = pairRestSec(findDay(dayId), cur);
  const btn = (tier, sec, on) =>
    `<button class="restbtn ${on ? '' : 'quiet'}" data-action="rest" data-tier="${tier}" aria-label="Rest ${fmtMMSS(sec)}">${icon('clock', 2.2)}<span class="restbtn-t">${fmtMMSS(sec)}</span></button>`;
  return `<div class="rest-idle">${btn('normal', nSec, !heavy)}${btn('heavy', state.settings.restHeavy, heavy)}</div>`;
}

function renderRestDock() {
  const dock = $('#restdock');
  if (dock) dock.innerHTML = restDockHTML(currentDayId());
}

// The session trail: one segment per exercise, pinned in the dock.
function trailHTML(day) {
  const a = state.active && state.active.dayId === day.id ? state.active : null;
  const req = requiredSlots(day);
  const done = req.filter((s) => isDone(a, s)).length;
  const pips = day.slots.map((s) => `<span class="trail-pip ${isDone(a, s) ? 'on' : ''}"></span>`).join('');
  const all = done === req.length && done > 0;
  return `<div class="trail ${all ? 'all' : ''}" data-trail><div class="trail-bar">${pips}</div><span class="trail-count">${done} of ${req.length}</span></div>`;
}

function renderTrail() {
  const el = $('[data-trail]');
  const day = findDay(currentDayId());
  if (!el || !day) return;
  const wasAll = el.classList.contains('all');
  el.outerHTML = trailHTML(day);
  const now = $('[data-trail]');
  if (now.classList.contains('all') && !wasAll) now.classList.add('bloomed');
  const fin = $('.finishbtn[data-action="finish"]');
  if (fin) fin.classList.toggle('ready', now.classList.contains('all'));
}

function updateRestTime(left) {
  const t = $('[data-rest-time]');
  const f = $('[data-rest-fill]');
  if (t) t.textContent = fmtMMSS(left);
  if (f) f.style.width = Math.max(0, Math.min(100, (1 - left / rest.total) * 100)) + '%';
}

const GROUP_WORDS = {
  2: ['Dupla · alternate sets', 'Dupla feita'],
  3: ['Trio · cycle through', 'Trio feito'],
};

// Consecutive pair members share one headed card; unpaired neighbours
// share a plain card, so the page reads as a few calm blocks.
function slotsHTML(day) {
  const a = state.active && state.active.dayId === day.id ? state.active : null;
  const groups = [];
  for (const slot of day.slots) {
    const last = groups[groups.length - 1];
    if (last && last.pair && last.pair === slot.pair) last.slots.push(slot);
    else groups.push({ pair: slot.pair || null, slots: [slot] });
  }
  const merged = [];
  for (const g of groups) {
    const solo = g.slots.length < 2;
    const prev = merged[merged.length - 1];
    if (solo && prev && prev.solo) prev.slots.push(...g.slots);
    else merged.push({ solo, pair: g.pair, slots: g.slots.slice() });
  }
  return merged.map((g) => {
    if (g.solo) return `<div class="slotgroup">${g.slots.map((s) => slotCardHTML(day, s)).join('')}</div>`;
    const allDone = g.slots.filter((s) => !s.optional).every((s) => isDone(a, s));
    const [word, doneWord] = GROUP_WORDS[Math.min(g.slots.length, 3)];
    return `
      <div class="slotgroup pair ${allDone ? 'done' : ''}">
        <div class="grouphead">
          <span class="gh-live">${icon('pair', 2.4)}${word}<span class="gh-rest">${fmtMMSS(pairRestSec(day, g.slots[0]))} rest</span></span>
          <span class="gh-done">${bloomSVG('bloom-mini')}${doneWord}</span>
        </div>
        ${g.slots.map((s) => slotCardHTML(day, s, true)).join('')}
      </div>`;
  }).join('');
}

function viewDay(dayId) {
  const day = findDay(dayId);
  if (!day) { location.hash = '#/'; return ''; }
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  const allDone = !!a && requiredSlots(day).every((s) => isDone(a, s));
  return `
    ${topbar('#/', true)}
    <div class="dayhead">
      <div class="dayhead-text">
        <div class="dayhead-name">${esc(day.name)}</div>
        <div class="dayhead-sub">${esc(day.subtitle)}</div>
      </div>
      <span class="daymark">${dayGlyphHTML(day.id)}</span>
    </div>
    <div class="dock">
      ${trailHTML(day)}
      <div id="restdock" class="restdock">${restDockHTML(day.id)}</div>
    </div>
    <div class="slots">${slotsHTML(day)}</div>
    <button class="finishbtn ${allDone ? 'ready' : ''}" data-action="finish" data-day="${day.id}">Finish session</button>
    <button class="discardbtn ${a ? '' : 'off'}" data-action="discard" data-day="${day.id}">Discard session</button>`;
}

// As an exercise finishes, one rose petal lifts off its ring, turns once
// and fades upward — after the check has written itself.
function petalLift(ringEl) {
  if (!ringEl || reducedMotion()) return;
  const p = document.createElement('span');
  p.className = 'petal-lift';
  p.setAttribute('aria-hidden', 'true');
  p.innerHTML = '<svg viewBox="0 0 12 16"><path d="M6 15.2C2.4 12.6 1.2 7.4 6 .8c4.8 6.6 3.6 11.8 0 14.4z"/></svg>';
  ringEl.appendChild(p);
  setTimeout(() => p.remove(), 1800);
}

function viewFinish(dayId) {
  const day = findDay(dayId);
  if (!day) { location.hash = '#/'; return ''; }
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  const doneCount = a ? requiredSlots(day).filter((s) => isDone(a, s)).length : 0;
  const mins = a ? Math.round((Date.now() - a.startedAt) / 60000) : 0;
  const sub = [day.name];
  if (doneCount) sub.push(`${doneCount} of ${requiredSlots(day).length}`);
  if (mins >= 1) sub.push(`${mins} min`);
  const rows = [];
  for (const slot of day.slots) {
    const e = a ? a.entries[slot.id] : null;
    const rung = e && e.rung ? e.rung : '';
    const noted = !!(e && e.note && e.note.trim());
    const name = `<span class="rrow-name">${esc(slot.name)}${noted ? `<i class="rrow-note" aria-label="has a note">${icon('note', 2)}</i>` : ''}</span>`;
    let num = '';
    if (slot.track) {
      const w = effectiveWeight(dayId, slot);
      const wtxt = w === '' || w == null ? '—' : `${slot.added ? '+' : ''}${w}`;
      num = `<b>${esc(wtxt)}</b> ${esc(state.settings.unit)}`;
      if (slot.reps) {
        const b = bankedReps(e);
        const r = b.length ? b.join('/') : effectiveReps(dayId, slot);
        num += ` ×${r === '' || r == null ? '—' : esc(String(r))}`;
      }
    } else if (slot.reps) {
      const b = bankedReps(e);
      const r = b.length ? b.join('/') : effectiveReps(dayId, slot);
      if (r !== '' && r != null) num = `<b>×${esc(String(r))}</b>`;
    }
    if (num) rows.push(`<div class="rrow">${name}<span class="rrow-num">${num}</span></div>`);
    if (rung) rows.push(`<div class="rrow">${num ? '<span class="rrow-name dim">↳ rung</span>' : name}<span class="rrow-rung">${esc(rung)}</span></div>`);
  }
  const recap = rows.length ? `<div class="recap"><div class="recap-head">Will save</div>${rows.join('')}</div>` : '';
  return `
    ${topbar('#/day/' + dayId)}
    <div class="finish-wrap">
      <div class="finish-hero">
        <div class="bloomwrap">${bloomSVG('bloom')}<span class="drift" aria-hidden="true"><i></i><i></i><i></i></span></div>
        <div class="boa">Boa, Carolina!</div>
        <div class="fsub">${esc(sub.join(' · '))}</div>
      </div>
      ${recap}
      <textarea id="finishnote" rows="3" placeholder="Session note (optional)"></textarea>
      <button class="finishbtn solid" data-action="finish-save" data-day="${day.id}">Save session</button>
      <button class="discardbtn ${a ? '' : 'off'}" data-action="discard" data-day="${day.id}">Discard session</button>
    </div>`;
}

/* ---------- progresso ----------
   Three parts, one job each: roads (the ladders, goal at the far end),
   next session (only what's ready to move), and since-the-start (where
   every tracked lift began and where it is now — weight and reps). */

// Roads: position is the highest rung she's ever picked, so Voo's
// deliberately easier push-up practice can't walk the road backwards.
const ROADS = [
  { key: 'pushups', title: 'Push-ups', ids: PUSHUP_IDS, goal: 'First set of full push-ups' },
];

function menuFor(ids) {
  for (const id of ids) {
    for (const day of state.program.days) {
      const s = day.slots.find((sl) => slug(sl.name) === id && sl.menu && sl.menu.length);
      if (s) return s.menu;
    }
  }
  return null;
}

function realSessions() { return state.sessions.filter((s) => !s.auto); }

// Assisted lifts read backwards: less weight is more strength. Matched on
// "chin-up" (not "chin", which also lives inside "machine").
function isAssisted(slot) {
  return /chin-?ups?\b/i.test(slot.name) || /assist/i.test(slot.target || '');
}

function roadsData() {
  const out = [];
  for (const r of ROADS) {
    const menu = menuFor(r.ids);
    if (!menu) continue;
    const rungs = menu.map(rungShort);
    const first = {};
    let best = -1;
    const see = (rung, ts) => {
      const i = rungs.indexOf(rung);
      if (i === -1) return;
      if (!(rung in first)) first[rung] = ts;
      if (i > best) best = i;
    };
    for (const sess of state.sessions) {
      for (const en of sess.entries || []) if (en.rung && r.ids.includes(en.exerciseId)) see(en.rung, sess.endedAt);
    }
    const a = state.active;
    const aday = a && findDay(a.dayId);
    if (aday) {
      for (const s of aday.slots) {
        const e = a.entries[s.id];
        if (e && e.rung && r.ids.includes(slug(s.name))) see(e.rung, Date.now());
      }
    }
    const nodes = rungs.map((name) => ({ name, when: first[name] || null }));
    if (r.goal) nodes.push({ name: r.goal, when: null, goal: true });
    else nodes[nodes.length - 1].goal = true;
    out.push({ key: r.key, title: r.title, kind: 'ladder', nodes, current: best >= 0 ? best : null });
    if (r.key === 'pushups') { const chin = assistRoad(); if (chin) out.push(chin); }
  }
  return out;
}

// Chin-ups run on the assisted machine: a road measured in pounds of help,
// ending at zero — her first unassisted chin-up.
function assistRoad() {
  let slot = null;
  for (const day of state.program.days) {
    slot = day.slots.find((s) => s.track && !s.light && isAssisted(s));
    if (slot) break;
  }
  if (!slot) return null;
  const id = slug(slot.name);
  const pts = [];
  for (const sess of realSessions()) {
    const en = (sess.entries || []).find((e) => e.exerciseId === id && e.weight !== '' && e.weight != null);
    if (en) pts.push({ w: +en.weight, r: en.reps > 0 ? en.reps : null, t: sess.endedAt });
  }
  if (!pts.length) return null;
  return {
    key: 'chin', title: 'Chin-ups', kind: 'assist', pts,
    start: pts[0], now: pts[pts.length - 1], range: repRange(slot.target),
  };
}

// The pins on the road, from the most help she's used down to zero. One pin
// is the smallest drop she's ever made (the machine's step), else 10 lb / 5 kg.
function pinNodes(r) {
  const unit = state.settings.unit;
  let step = 0;
  for (let i = 1; i < r.pts.length; i++) {
    const d = +(r.pts[i - 1].w - r.pts[i].w).toFixed(2);
    if (d > 0 && (!step || d < step)) step = d;
  }
  if (!step) step = unit === 'kg' ? 5 : 10;
  const top = Math.max(...r.pts.map((p) => p.w));
  if (top / step > 12) step = Math.ceil(top / 8);
  const vals = [];
  for (let v = top; v > 0.001; v = +(v - step).toFixed(2)) vals.push(v);
  let cur = vals.findIndex((v) => v <= r.now.w + 0.001);
  if (cur === -1) cur = vals.length; // at zero: the goal itself
  return { vals, cur };
}

// The rep ring on the current pin: how far through the range she is.
function pinRingSVG(frac) {
  const c = 59.69;
  const arc = Math.max(0, Math.min(1, frac)) * c;
  return `<svg class="pin-ring" viewBox="0 0 22 22" aria-hidden="true">
    <circle cx="11" cy="11" r="9.5" fill="none" stroke="var(--rose-wash)" stroke-width="3"/>
    ${arc > 0 ? `<circle cx="11" cy="11" r="9.5" fill="none" stroke="var(--rose)" stroke-width="3" stroke-linecap="round" stroke-dasharray="${arc.toFixed(1)} ${c}" transform="rotate(-90 11 11)"/>` : ''}
    <circle cx="11" cy="11" r="5" fill="var(--rose)"/>
  </svg>`;
}

function pinRoadHTML(r) {
  const unit = state.settings.unit;
  const { vals, cur } = pinNodes(r);
  const reached = cur >= vals.length;
  const [lo, hi] = r.range || [0, 0];
  const nowR = r.now.r;
  const frac = r.range && nowR ? (nowR - lo) / Math.max(1, hi - lo) : 0;
  const nodes = [];
  const labels = [];
  vals.forEach((v, i) => {
    const isCur = i === cur;
    nodes.push(isCur ? pinRingSVG(frac) : `<span class="rn ${i < cur ? 'past' : ''}"></span>`);
    labels.push(`<span class="pin-lab ${isCur ? 'now' : ''}" style="width:${isCur ? 22 : 10}px">${i === 0 || isCur ? esc(String(v)) : ''}</span>`);
    const past = i < cur;
    nodes.push(`<span class="rl ${past ? 'past' : ''}"></span>`);
    labels.push('<span class="pin-gap"></span>');
  });
  nodes.push(`<span class="rn goal ${reached ? 'now' : ''}">${bloomSVG('bloom-mini')}</span>`);
  labels.push('<span class="pin-lab" style="width:18px">0</span>');

  const gained = +(r.start.w - r.now.w).toFixed(1);
  const line1 = reached
    ? '<b>First unassisted chin-up:</b> done'
    : gained > 0
      ? `Pulling <b>${esc(String(gained))} ${esc(unit)}</b> more of your own weight since ${esc(fmtDate(r.start.t))}`
      : `Started ${esc(fmtDate(r.start.t))} at ${esc(String(r.start.w))} ${esc(unit)} of help`;
  let line2 = reached ? '' : `${esc(String(r.now.w))} ${esc(unit)} of help now`;
  if (!reached && r.range && nowR) {
    line2 += nowR >= hi ? ` · ×${nowR} last time, one pin less next` : ` · ×${nowR} of ${hi} to the next pin`;
  }
  return `
    <div class="road pinroad ${reached ? 'reached' : ''}">
      <div class="road-head"><span class="road-title">${esc(r.title)}</span><span class="road-goal">First unassisted chin-up</span></div>
      <div class="pin-track">${nodes.join('')}</div>
      <div class="pin-labels">${labels.join('')}</div>
      <div class="pin-gain">${line1}</div>
      ${line2 ? `<div class="pin-now">${line2}</div>` : ''}
    </div>`;
}

function roadHTML(r) {
  const unit = esc(state.settings.unit);
  if (r.kind === 'assist') return pinRoadHTML(r);
  const cur = r.current;
  const goalIdx = r.nodes.length - 1;
  const reached = cur != null && cur >= goalIdx;
  const track = r.nodes.map((n, i) => {
    const cls = ['rn'];
    if (cur != null && i < cur) cls.push('past');
    if (i === cur) cls.push('now');
    const dot = n.goal ? `<span class="${cls.join(' ')} goal">${bloomSVG('bloom-mini')}</span>` : `<span class="${cls.join(' ')}"></span>`;
    const line = i < goalIdx ? `<span class="rl ${cur != null && i < cur ? 'past' : ''}"></span>` : '';
    return dot + line;
  }).join('');
  const now = cur == null
    ? '<span class="road-now dim">Pick a rung on the card and the road starts moving</span>'
    : `<span class="road-now">${reached ? 'Reached' : 'Now'} <b>${esc(r.nodes[cur].name)}</b>${r.nodes[cur].when ? ` · since ${esc(fmtDate(r.nodes[cur].when))}` : ''}</span>`;
  const goalName = r.nodes[goalIdx].name;
  const detail = r.nodes.slice().reverse().map((n, k) => {
    const i = goalIdx - k;
    const state_ = i === cur ? 'now' : (cur != null && i < cur ? 'past' : 'next');
    const meta = i === cur ? 'Now' : (n.when ? fmtDate(n.when) : '');
    return `
      <div class="lad-row ${state_}">
        <div class="lad-rail"><span class="lad-dot ${state_} ${n.goal ? 'goal' : ''}"></span>${i > 0 ? '<span class="lad-line"></span>' : ''}</div>
        <div class="lad-body"><span class="lad-name">${esc(n.name)}</span><span class="lad-meta">${esc(meta)}</span></div>
      </div>`;
  }).join('');
  return `
    <button class="road ${reached ? 'reached' : ''}" data-action="road" data-road="${r.key}" aria-expanded="false">
      <span class="road-head"><span class="road-title">${esc(r.title)}</span><span class="road-goal">${esc(goalName)}</span></span>
      <span class="road-track">${track}</span>
      ${now}
    </button>
    <div class="lad hidden" data-roaddetail="${r.key}">${detail}</div>`;
}

// "8–12" out of a target like "4×8–12 · RIR 2–3".
function repRange(target) {
  const m = /[×x]\s*(\d+)\s*[–-]\s*(\d+)/.exec(String(target || ''));
  return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}

// Reps-first: a lift is ready when the last session hit the top of its
// range. Assisted chin-ups take one pin less; push-ups take the next rung.
function nextSessionItems() {
  const unit = state.settings.unit;
  const seen = new Set();
  const items = [];
  const real = realSessions();
  for (const day of state.program.days) {
    for (const s of day.slots) {
      if (!s.reps || s.light) continue;
      const id = slug(s.name);
      if (seen.has(id)) continue;
      seen.add(id);
      const range = repRange(s.target);
      if (!range) continue;
      let en = null;
      for (let i = real.length - 1; i >= 0 && !en; i--) {
        en = (real[i].entries || []).find((e) => e.exerciseId === id && e.reps > 0) || null;
      }
      if (!en) continue;
      const [, hi] = range;
      const ready = en.reps >= hi;
      const close = !ready && en.reps === hi - 1;
      if (!ready && !close) continue;
      const assisted = s.track && isAssisted(s);
      let what, pill;
      if (!s.track) {
        what = `×${en.reps}${en.rung ? ` on ${en.rung}` : ''}`;
        pill = ready ? 'Next rung' : 'Almost';
      } else {
        const w = en.weight === '' || en.weight == null ? '' : ` at ${en.weight} ${unit}${assisted ? ' help' : ''}`;
        what = `×${en.reps}${w}`;
        pill = ready ? (assisted ? 'One pin less' : 'Add weight') : 'Almost';
      }
      if (close) what += ` — ×${hi} moves it`;
      items.push({ name: s.name, what, pill, ready, slot: s });
    }
  }
  return items.sort((x, y) => (y.ready ? 1 : 0) - (x.ready ? 1 : 0));
}

function sinceRows() {
  const seen = new Set();
  const rows = [];
  const real = realSessions();
  for (const day of state.program.days) {
    for (const s of day.slots) {
      if (!s.track || s.light) continue;
      const id = slug(s.name);
      if (seen.has(id)) continue;
      seen.add(id);
      const pts = [];
      for (const sess of real) {
        const en = (sess.entries || []).find((e) => e.exerciseId === id && e.weight !== '' && e.weight != null);
        if (en) pts.push({ w: en.weight, r: en.reps > 0 ? en.reps : null, t: sess.endedAt });
      }
      if (!pts.length) continue;
      rows.push({ id, name: s.name, pts, assisted: isAssisted(s) });
    }
  }
  return rows;
}

// One lift's history: weight as the line, reps printed under each point.
function historySVG(pts) {
  const view = pts.slice(-10);
  const W = 320, H = 92, px = 14, top = 12, base = 58;
  const ws = view.map((p) => p.w);
  const min = Math.min(...ws), max = Math.max(...ws);
  const x = (i) => view.length === 1 ? W / 2 : px + (i * (W - 2 * px)) / (view.length - 1);
  const y = (v) => max === min ? (top + base) / 2 : base - ((v - min) * (base - top)) / (max - min);
  const line = view.map((p, i) => `${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  const dots = view.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="${i === view.length - 1 ? 4 : 2.8}"/>`).join('');
  const reps = view.map((p, i) => p.r ? `<text x="${x(i).toFixed(1)}" y="${base + 18}">${p.r}</text>` : '').join('');
  return `<svg class="hist" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <g fill="currentColor">${dots}</g><g class="hist-reps">${reps}</g>
    <text class="hist-date" x="${px - 4}" y="${H - 2}">${esc(fmtDate(view[0].t))}</text>
    <text class="hist-date end" x="${W - px + 4}" y="${H - 2}">${esc(fmtDate(view[view.length - 1].t))}</text>
  </svg>`;
}

// Friendly names for lists: "Chin-up progression" → "Chin-ups".
function niceName(slot) {
  const n = String(slot.name).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const m = /^(.*)-up progression$/i.exec(n);
  return m ? `${m[1]}-ups` : n;
}

/* Since-the-start as one shared timeline: each lift's strength (weight and
   reps folded together, so an extra rep counts too) on the same calendar,
   with its gain as a percentage. Assisted chin-ups count help shed instead.
   Tap a row for its weight-and-reps history. */

// Epley's estimate: weight × (1 + reps/30); weight alone when reps aren't logged.
function strengthOf(p) { return p.r ? p.w * (1 + p.r / 30) : p.w; }

function strengthGain(row) {
  const unit = state.settings.unit;
  const a = row.pts[0], b = row.pts[row.pts.length - 1];
  const now = `${b.w}${b.r ? `×${b.r}` : ` ${unit}`}`;
  if (row.assisted) {
    const d = +(a.w - b.w).toFixed(1);
    return { big: d > 0 ? `−${d} ${unit}` : `${b.w} ${unit}`, small: 'help' };
  }
  if (row.pts.length < 2) return { big: 'New', small: now };
  const s0 = strengthOf(a), s1 = strengthOf(b);
  if (s0 <= 0) return { big: `+${+(b.w - a.w).toFixed(1)} ${unit}`, small: now };
  const pct = Math.round(((s1 - s0) / s0) * 100);
  return { big: `${pct > 0 ? '+' : pct < 0 ? '−' : '±'}${Math.abs(pct)}%`, small: now };
}

function strengthTimelineHTML(rows) {
  const W = 200, H = 36, pad = 3;
  let t0 = Infinity, t1 = -Infinity;
  for (const row of rows) for (const p of row.pts) { t0 = Math.min(t0, p.t); t1 = Math.max(t1, p.t); }
  const span = t1 - t0;
  const x = (t) => span > 0 ? pad + ((t - t0) / span) * (W - 2 * pad) : W / 2;

  // Month starts inside the window: faint guides on every row, labels on the axis.
  const months = [];
  const m = new Date(t0);
  m.setDate(1); m.setHours(0, 0, 0, 0);
  for (m.setMonth(m.getMonth() + 1); m.getTime() < t1; m.setMonth(m.getMonth() + 1)) months.push(m.getTime());
  const guides = months.map((t) => `<line x1="${x(t).toFixed(1)}" y1="0" x2="${x(t).toFixed(1)}" y2="${H}"/>`).join('');

  const rowHTML = (row) => {
    const vals = row.pts.map((p) => (row.assisted ? -p.w : strengthOf(p)));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const y = (v) => hi === lo ? H / 2 : H - pad - ((v - lo) * (H - 2 * pad)) / (hi - lo);
    const pts = row.pts.map((p, i) => `${x(p.t).toFixed(1)},${y(vals[i]).toFixed(1)}`);
    const last = pts[pts.length - 1].split(',');
    const first = pts[0].split(',');
    const area = pts.length > 1
      ? `<polygon points="${pts.join(' ')} ${last[0]},${H} ${first[0]},${H}" class="ts-area"/>
         <polyline points="${pts.join(' ')}" class="ts-line"/>` : '';
    const g = strengthGain(row);
    const name = row.assisted ? niceName({ name: row.name }) : row.name;
    return `
      <button class="trow" data-action="mrow" data-m="${esc(row.id)}" aria-expanded="false">
        <span class="trow-l"><span class="trow-name">${esc(name)}</span>
          <span class="trow-v"><b>${esc(g.big)}</b><span>${esc(g.small)}</span></span></span>
        <svg class="tspark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
          <g class="ts-guide">${guides}</g>${area}
          <circle cx="${last[0]}" cy="${last[1]}" r="3"/>
        </svg>
      </button>
      <div class="tcard hidden" data-mdetail="${esc(row.id)}">${sinceDetailHTML(row)}</div>`;
  };

  // Axis: the first day, then each month start that has room for its label.
  const labels = [`<text x="${pad}" y="13">${esc(fmtDate(t0))}</text>`];
  for (const t of months) {
    const xt = x(t);
    if (xt - pad > 40 && W - xt > 16) labels.push(`<text x="${xt.toFixed(1)}" y="13" text-anchor="middle">${esc(fmtDate(t))}</text>`);
  }
  return `
    <div class="group tline-card">
      ${rows.map(rowHTML).join('')}
      <div class="taxis"><span></span><svg class="tspark" viewBox="0 0 ${W} 18" aria-hidden="true">${labels.join('')}</svg></div>
    </div>`;
}

function sinceDetailHTML(row) {
  let best = row.pts[0];
  for (const p of row.pts) {
    const better = row.assisted ? p.w < best.w : p.w > best.w;
    if (better || (p.w === best.w && (p.r || 0) > (best.r || 0))) best = p;
  }
  const bestTxt = `${row.assisted ? 'Least help' : 'Best'}: ${best.w} ${state.settings.unit}${best.r ? ` ×${best.r}` : ''} · ${fmtDate(best.t)}`;
  return `${historySVG(row.pts)}
    <div class="tline">${esc(bestTxt)}${row.pts.some((p) => p.r) ? ' · <span class="dim">reps under each point</span>' : ''}</div>`;
}

// Next session at a glance: one line per action, the lifts it applies to,
// and the near-misses gathered into a single quiet line.
function nextSessionHTML(items) {
  const ready = items.filter((i) => i.ready);
  const almost = items.filter((i) => !i.ready);
  if (!ready.length && !almost.length) {
    return '<div class="nempty">Nothing due yet — keep building reps.</div>';
  }
  const byAction = new Map();
  for (const i of ready) {
    if (!byAction.has(i.pill)) byAction.set(i.pill, []);
    byAction.get(i.pill).push(niceName(i.slot));
  }
  const rows = [...byAction].map(([pill, names]) => `
    <div class="nact"><span class="npill">${esc(pill)}</span><span class="nact-names">${esc(names.join(', '))}</span></div>`).join('');
  const near = almost.length
    ? `<div class="nalmost">One rep away: ${esc(almost.map((i) => niceName(i.slot)).join(', '))}</div>` : '';
  return rows + near;
}

function rhythmHTML() {
  const st = rhythmStats();
  if (!st) return '';
  const cols = st.weeks.map((wk) => {
    let dots = '';
    for (let i = 0; i < Math.min(wk.count, 4); i++) dots += '<span class="wdot"></span>';
    if (!wk.count) dots = '<span class="wdot zero"></span>';
    else if (wk.start === st.nowW && wk.count === 1) dots += '<span class="wdot faded"></span>';
    const label = new Date(wk.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<div class="week"><div class="wdots">${dots}</div><div class="wl">${esc(label)}</div></div>`;
  }).join('');
  const total = st.weeks.reduce((a, wk) => a + wk.count, 0);
  const line = st.streak >= 2
    ? `Two a week, ${st.streak} weeks straight`
    : st.weeks.length === 1
      ? `${total} session${total === 1 ? '' : 's'} this week`
      : `${total} session${total === 1 ? '' : 's'} in the last ${st.weeks.length} weeks`;
  return `
    <div class="sechead">Rhythm</div>
    <div class="card rhythm-card">
      <div class="rhythm">${cols}</div>
      <div class="tline">${esc(line)}</div>
    </div>`;
}

function viewProgresso() {
  const roads = roadsData();
  const next = nextSessionItems();
  const rows = sinceRows();
  const real = realSessions();
  const sinceWord = real.length ? fmtDate(real[0].endedAt) : '';
  return `
    ${topbar('#/')}
    <h1 class="pagehead">Progresso</h1>
    ${roads.length ? `<div class="sechead">Roads</div><div class="roads">${roads.map(roadHTML).join('')}</div>` : ''}
    ${real.length ? `<div class="sechead">Next session</div><div class="card nextcard">${nextSessionHTML(next)}</div>` : ''}
    ${rows.length ? `<div class="sechead">Since ${esc(sinceWord)}</div><p class="sec-note">Strength from weight and reps together, every lift on the same calendar.</p>${strengthTimelineHTML(rows)}` : ''}
    ${!real.length ? '<p class="finish-hint">Finish a session and this page starts to fill in.</p>' : ''}
    ${rhythmHTML()}
    <div class="fieldmark">${sprigHTML()}</div>`;
}

/* ---------- settings & editor: inset-grouped lists ---------- */

function viewSettings() {
  const s = state.settings;
  const seg = (name, val, opts) => opts.map(([v, label]) =>
    `<button class="seg ${val === v ? 'on' : ''}" data-action="${name}" data-v="${v}">${label}</button>`
  ).join('');
  return `
    ${topbar('#/')}
    <h1 class="pagehead">Settings</h1>
    <div class="settings">
      <div class="sechead">Display</div>
      <div class="group">
        <div class="setrow">
          <div class="setlabel">Theme</div>
          <div class="segwrap">${seg('theme', s.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
        </div>
        <div class="setrow">
          <div class="setlabel">Unit</div>
          <div class="segwrap">${seg('unit', s.unit, [['lb', 'lb'], ['kg', 'kg']])}</div>
        </div>
      </div>
      <div class="sechead">Rest</div>
      <div class="group">
        <div class="setrow">
          <div class="setlabel">Normal</div>
          <label class="numfield"><input class="setnum" type="number" inputmode="numeric" data-action="rest-normal" value="${s.restNormal}">s</label>
        </div>
        <div class="setrow">
          <div class="setlabel">Heavy</div>
          <label class="numfield"><input class="setnum" type="number" inputmode="numeric" data-action="rest-heavy" value="${s.restHeavy}">s</label>
        </div>
      </div>
      <div class="sechead">Program</div>
      <div class="group">
        <a class="grow-link" href="#/program"><span class="setlabel">Edit program</span>${icon('chev', 2.2)}</a>
      </div>
      ${viewSyncGroup()}
      <div class="sechead">Data</div>
      <div class="group">
        <div class="setrow">
          <div class="setlabel">Backup</div>
          <div class="btnrow">
            <button class="setbtn" data-action="export">Export</button>
            <button class="setbtn" data-action="copy-json">Copy JSON</button>
          </div>
        </div>
        <a class="grow-link" href="#/import"><span class="setlabel">Import</span>${icon('chev', 2.2)}</a>
        <div class="setrow">
          <div class="setlabel">Erase everything</div>
          <button class="setbtn danger" data-action="erase">Erase all data</button>
        </div>
      </div>
      <div class="version">v${APP_VERSION} · ${state.sessions.length} sessions logged</div>
    </div>`;
}

function viewImport() {
  return `
    ${topbar('#/settings')}
    <h1 class="pagehead">Import</h1>
    <div class="settings">
      <p class="finish-hint">Paste a Forte JSON export. Replaces everything.</p>
      <textarea id="importbox" rows="8" placeholder="{ … }"></textarea>
      <button class="finishbtn solid" data-action="import-load">Load</button>
    </div>`;
}

function viewProgram() {
  const days = state.program.days.map((day) => `
    <div class="sechead">${esc(day.name)} · ${esc(day.subtitle)}</div>
    <div class="group proglist">
      ${day.slots.map((s) => `
        <a class="progrow" href="#/program/${day.id}/${s.id}">
          <span class="progrow-name">${esc(s.name)}</span>
          <span class="progrow-target">${esc(s.target || '')}</span>${icon('chev', 2.2)}
        </a>`).join('')}
      <button class="grow-link add" data-action="add-slot" data-day="${day.id}">${icon('plus', 2.4)}Add exercise</button>
    </div>`).join('');
  return `${topbar('#/settings')}<h1 class="pagehead">Program</h1><div class="settings">${days}</div>`;
}

function viewSlotEdit(dayId, slotId) {
  const day = findDay(dayId);
  const slot = findSlot(day, slotId);
  if (!slot) { location.hash = '#/program'; return ''; }
  const field = (label, action, value, ph) => `
    <label class="editfield"><span>${label}</span>
      <input type="text" data-action="${action}" value="${esc(value || '')}" placeholder="${ph || ''}"></label>`;
  const sw = (label, action, on) => `
      <div class="setrow">
        <div class="setlabel">${label}</div>
        <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}"
          aria-label="${label}" data-action="${action}"></button>
      </div>`;
  return `
    ${topbar('#/program')}
    <h1 class="pagehead">${esc(slot.name)}</h1>
    <div class="settings" data-editing-day="${dayId}" data-editing-slot="${slotId}">
      ${field('Name', 'edit-name', slot.name)}
      ${field('Target', 'edit-target', slot.target, 'e.g. 3×6–8 · RIR 2–3')}
      ${field('Cue', 'edit-cue', slot.cue)}
      ${field('Warm-up', 'edit-warmup', slot.warmup)}
      <label class="editfield"><span>Menu (one per line)</span>
        <textarea rows="4" data-action="edit-menu">${esc((slot.menu || []).join('\n'))}</textarea></label>
      ${field('Pair (same letter = done together)', 'edit-pair', slot.pair, 'e.g. a')}
      ${field('Pair rest (seconds — blank = normal tier)', 'edit-pairrest', slot.pairRest, 'e.g. 60')}
      <div class="group">
        ${sw('Track weight', 'edit-track', slot.track)}
        ${sw('Added load (+)', 'edit-added', slot.added)}
        ${sw('Track reps', 'edit-reps', slot.reps)}
        <div class="setrow">
          <div class="setlabel">Rest tier</div>
          <div class="segwrap">
            <button class="seg ${slot.rest !== 'heavy' ? 'on' : ''}" data-action="edit-rest" data-v="normal">Normal</button>
            <button class="seg ${slot.rest === 'heavy' ? 'on' : ''}" data-action="edit-rest" data-v="heavy">Heavy</button>
          </div>
        </div>
      </div>
      <div class="btnrow edit-actions">
        <button class="setbtn" data-action="edit-up">${icon('up', 2.2)}Move up</button>
        <button class="setbtn" data-action="edit-down">${icon('dn', 2.2)}Move down</button>
        <button class="setbtn danger" data-action="edit-delete">Delete</button>
      </div>
    </div>`;
}

/* ============================== router ============================== */

// A session is a sheet over home: it rises from the bottom on the way in
// and drops away on the way out, home easing back up underneath. Every
// other page is a push: deeper pages slide in from the right over a dimmed
// parallax of the page before; Back slides them away again. A still copy
// of the outgoing page (the ghost) carries the motion so the real page
// can render at once.
let lastView = null;
let lastDepth = 0;
const DEPTH = { home: 0, day: 1, settings: 1, progresso: 1, finish: 2, program: 2, import: 2, slot: 3 };
function navMotion(from, to, fromDepth, toDepth) {
  if (!from || reducedMotion()) return null;
  if (to === 'day' && from !== 'finish' && from !== 'day') return 'in';
  if (from === 'day' && to === 'home') return 'out';
  if (from === to && fromDepth === toDepth) return null;
  if (toDepth > fromDepth) return 'push';
  if (toDepth < fromDepth) return 'pop';
  return null;
}
function makeGhost(app, cls) {
  const g = document.createElement('div');
  g.className = 'ghost ' + cls;
  g.setAttribute('aria-hidden', 'true');
  g.innerHTML = `<div class="ghost-page" data-view="${app.getAttribute('data-view') || ''}" style="transform:translateY(${-window.scrollY}px)">${app.innerHTML}</div>`;
  g.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  // A still copy: no completion phrase, petal or splash replaying inside it.
  g.querySelectorAll('.fresh, .pop, .just').forEach((n) => n.classList.remove('fresh', 'pop', 'just'));
  g.querySelectorAll('.petal-lift, .splash').forEach((n) => n.remove());
  document.body.appendChild(g);
  setTimeout(() => g.remove(), 700);
  return g;
}

function render() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/');
  const view = parts[0] || 'home';
  const depth = view === 'program' && parts[2] ? DEPTH.slot : (DEPTH[view] != null ? DEPTH[view] : 1);
  const motion = navMotion(lastView, view, lastDepth, depth);
  lastView = view;
  lastDepth = depth;
  const appEl = $('#app');
  const GHOST = { in: 'recede', out: 'drop', push: 'behind', pop: 'away' };
  if (motion && appEl.innerHTML) makeGhost(appEl, GHOST[motion]);
  if ((parts[0] === 'day' || parts[0] === 'finish') && parts[1]) resumeDraft(parts[1]);
  let html = '';
  if (parts[0] === 'day' && parts[1]) html = viewDay(parts[1]);
  else if (parts[0] === 'finish' && parts[1]) html = viewFinish(parts[1]);
  else if (parts[0] === 'progresso') html = viewProgresso();
  else if (parts[0] === 'settings') html = viewSettings();
  else if (parts[0] === 'import') html = viewImport();
  else if (parts[0] === 'program' && parts[1] && parts[2]) html = viewSlotEdit(parts[1], parts[2]);
  else if (parts[0] === 'program') html = viewProgram();
  else html = viewHome();
  const app = $('#app');
  app.setAttribute('data-view', view);
  document.documentElement.setAttribute('data-view', view);
  app.innerHTML = html;
  window.scrollTo(0, 0);
  const ENTER = { in: 'sheet-in', out: 'emerge', push: 'push-in', pop: 'pop-in' };
  app.classList.remove('sheet-in', 'emerge', 'push-in', 'pop-in');
  updateDock();
  if (motion) {
    app.getBoundingClientRect();
    app.classList.add(ENTER[motion]);
    setTimeout(() => app.classList.remove(ENTER[motion]), 700);
  }
}

window.addEventListener('hashchange', render);

// The dock's edge fade shows only while it's pinned under the top.
let dockRaf = 0;
function updateDock() {
  dockRaf = 0;
  const d = $('.dock');
  if (!d) return;
  const pin = parseFloat(getComputedStyle(d).top) || 0;
  d.classList.toggle('stuck', window.scrollY > 0 && d.getBoundingClientRect().top <= pin + 0.5);
}
window.addEventListener('scroll', () => { if (!dockRaf) dockRaf = requestAnimationFrame(updateDock); }, { passive: true });

/* ============================== actions ============================== */

let pendingErase = false;
let pendingDiscard = false;

function currentDayId() {
  const m = (location.hash || '').match(/^#\/day\/([^/]+)/);
  return m ? m[1] : null;
}

function closeDrawers() {
  document.querySelectorAll('[data-drawer]').forEach((d) => {
    d.classList.add('hidden');
    const c = d.closest('.slot');
    if (c) {
      c.classList.remove('open');
      const m = c.querySelector('.slot-main');
      if (m) m.setAttribute('aria-expanded', 'false');
    }
  });
}

function editedSlot() {
  const wrap = $('[data-editing-slot]');
  if (!wrap) return {};
  const dayId = wrap.getAttribute('data-editing-day');
  const slotId = wrap.getAttribute('data-editing-slot');
  const day = findDay(dayId);
  return { day, slot: findSlot(day, slotId) };
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-action]');
  if (!t) return;
  const action = t.getAttribute('data-action');
  if (syncAction(action, t)) return;
  const dayId = currentDayId();

  if (action === 'rest') { restStart(t.getAttribute('data-tier'), null); return; }
  if (action === 'rest-restart') { restStart(rest.tier || 'normal', rest.label); return; }
  if (action === 'rest-cancel') { restCancel(); return; }
  if (action === 'rest-ack') { rest.done = false; renderRestDock(); return; }

  if (action === 'done') {
    const slotId = t.getAttribute('data-slot');
    const day = findDay(dayId);
    const slot = findSlot(day, slotId);
    if (!slot) return;
    // Logging a set means the adjusting is over: fold the editor away and
    // drop the keyboard. A typed value is committed first (change fires on blur).
    if (document.activeElement && document.activeElement.matches('input, textarea')) document.activeElement.blur();
    closeDrawers();
    const e = activeEntry(dayId, slotId);
    const total = setTarget(slot);
    if (total) {
      // Counting ring: each tap banks one set and starts that exercise's
      // rest; the tap that fills the ring is the old done-tap. Tapping
      // the check clears the exercise back to untouched — one press
      // recovers any accidental over-taps — and never starts a timer.
      if (e.done) {
        e.done = false;
        e.sets = 0;
        delete e.repsBySet;
      } else {
        if (slot.reps) {
          // Bank this set's reps, then let the chip move on to the next set.
          const n = e.sets || 0;
          const r = parseInt(effectiveReps(dayId, slot), 10);
          const list = Array.isArray(e.repsBySet) ? e.repsBySet.slice(0, n) : [];
          while (list.length < n) list.push(null);
          list[n] = Number.isFinite(r) ? r : null;
          e.repsBySet = list;
          delete e.reps;
        }
        e.sets = Math.min((e.sets || 0) + 1, total);
        e.done = e.sets >= total;
        // The banked slot rides along so its group's own rest (e.g. the
        // trio's 1:00) wins even when she works out of order.
        restStart(slot.rest === 'heavy' ? 'heavy' : 'normal', restLabelFor(e.sets, total), slot);
      }
    } else {
      e.done = !e.done;
    }
    save();
    const card = $(`[data-slotcard="${slotId}"]`);
    if (card) {
      card.classList.toggle('done', !!e.done);
      card.classList.toggle('live', !!e.sets && !e.done);
    }
    // A pair or trio whose last member just finished says so, with a bloom.
    const group = card && card.closest('.slotgroup.pair');
    if (group) {
      const all = [...group.querySelectorAll('[data-slotcard]')].every((c) => c.classList.contains('done'));
      if (all && !group.classList.contains('done')) group.classList.add('just');
      group.classList.toggle('done', all);
    }
    // The arc grows from where it was rather than snapping to the new set.
    const oldArc = t.querySelector('.ring-arc');
    const oldOff = oldArc ? oldArc.style.strokeDashoffset : null;
    t.outerHTML = ringHTML(slot, e, !!e.done);
    const ringNow = card && card.querySelector('.ring');
    if (ringNow) {
      const arc = ringNow.querySelector('.ring-arc');
      if (arc && oldOff != null && (e.done || e.sets) && !reducedMotion()) {
        const to = arc.style.strokeDashoffset;
        arc.style.transition = 'none';
        arc.style.strokeDashoffset = oldOff;
        arc.getBoundingClientRect();
        arc.style.transition = '';
        arc.style.strokeDashoffset = to;
      }
      ringNow.classList.add('pop');
      if (e.done) petalLift(ringNow);
    }
    refreshRow(dayId, slot);
    const rin = $(`[data-edit="${slotId}"] input[data-action="reps"]`);
    if (rin) { const r = effectiveReps(dayId, slot); rin.value = r === '' || r == null ? '' : r; }
    renderTrail();
    renderRestDock();
    return;
  }
  if (action === 'rung') {
    const slotId = t.getAttribute('data-slot');
    const label = t.getAttribute('data-rung');
    const day = findDay(dayId);
    const slot = findSlot(day, slotId);
    if (!slot) return;
    const e = activeEntry(dayId, slotId);
    e.rung = e.rung === label ? '' : label;
    save();
    const wrap = $(`[data-rungs="${slotId}"]`);
    if (wrap) {
      wrap.querySelectorAll('.rung').forEach((b) => {
        const on = !!e.rung && b.getAttribute('data-rung') === e.rung;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
    const det = $(`[data-rungdetail="${slotId}"]`);
    if (det) {
      const text = e.rung ? rungDetail(slot, e.rung) : '';
      det.textContent = text;
      det.classList.toggle('hidden', !text);
    }
    refreshRow(dayId, slot);
    return;
  }
  if (action === 'expand') {
    // One drawer open at a time keeps the list calm. Opening never
    // touches saved state — only an actual change starts a session.
    const id = t.getAttribute('data-slot');
    const box = $(`[data-drawer="${id}"]`);
    if (!box) return;
    const opening = box.classList.contains('hidden');
    closeDrawers();
    if (opening) {
      box.classList.remove('hidden');
      const card = box.closest('.slot');
      card.classList.add('open');
      card.querySelector('.slot-main').setAttribute('aria-expanded', 'true');
    }
    return;
  }
  if (action === 'road' || action === 'mrow') {
    const sel = action === 'road'
      ? `[data-roaddetail="${t.getAttribute('data-road')}"]` : `[data-mdetail="${t.getAttribute('data-m')}"]`;
    const box = $(sel);
    if (!box) return;
    const open = box.classList.toggle('hidden') === false;
    t.classList.toggle('open', open);
    t.setAttribute('aria-expanded', open ? 'true' : 'false');
    return;
  }
  if (action === 'step') {
    const slotId = t.getAttribute('data-slot');
    const d = parseFloat(t.getAttribute('data-d'));
    const day = findDay(dayId);
    const slot = findSlot(day, slotId);
    if (!slot) return;
    const cur = parseFloat(effectiveWeight(dayId, slot));
    const next = (Number.isFinite(cur) ? cur : 0) + d;
    const e = activeEntry(dayId, slotId);
    e.weight = Math.max(0, next);
    save();
    const input = $(`[data-edit="${slotId}"] input[data-action="weight"]`);
    if (input) input.value = e.weight;
    refreshRow(dayId, slot);
    return;
  }
  if (action === 'rstep') {
    const slotId = t.getAttribute('data-slot');
    const d = parseInt(t.getAttribute('data-d'), 10);
    const day = findDay(dayId);
    const slot = findSlot(day, slotId);
    if (!slot) return;
    const cur = parseInt(effectiveReps(dayId, slot), 10);
    const next = (Number.isFinite(cur) ? cur : 0) + d;
    const e = activeEntry(dayId, slotId);
    e.reps = Math.max(0, next);
    save();
    const input = $(`[data-edit="${slotId}"] input[data-action="reps"]`);
    if (input) input.value = e.reps;
    refreshRow(dayId, slot);
    return;
  }

  if (action === 'finish') { location.hash = '#/finish/' + t.getAttribute('data-day'); return; }
  if (action === 'discard') {
    if (!pendingDiscard) {
      pendingDiscard = true;
      t.textContent = 'Tap again to discard';
      t.classList.add('armed');
      setTimeout(() => {
        pendingDiscard = false;
        if (document.body.contains(t)) { t.textContent = 'Discard session'; t.classList.remove('armed'); }
      }, 3500);
      return;
    }
    pendingDiscard = false;
    discardSession(t.getAttribute('data-day'));
    return;
  }
  if (action === 'finish-save') {
    finishSession(t.getAttribute('data-day'), ($('#finishnote') || {}).value || '');
    return;
  }

  if (action === 'theme') { state.settings.theme = t.getAttribute('data-v'); applyTheme(); save(); render(); return; }
  if (action === 'unit') { state.settings.unit = t.getAttribute('data-v'); save(); render(); return; }
  if (action === 'export') { exportJSON(); return; }
  if (action === 'copy-json') {
    navigator.clipboard.writeText(JSON.stringify(state, null, 1))
      .then(() => toast('Copied'))
      .catch(() => toast('Copy failed'));
    return;
  }
  if (action === 'erase') {
    if (!pendingErase) {
      pendingErase = true;
      t.textContent = 'Tap again to erase';
      setTimeout(() => { pendingErase = false; if (document.body.contains(t)) t.textContent = 'Erase all data'; }, 3500);
      return;
    }
    localStorage.removeItem(STORE_KEY);
    state = defaultState();
    save();
    pendingErase = false;
    location.hash = '#/';
    render();
    toast('Erased');
    return;
  }
  if (action === 'import-load') {
    try {
      const parsed = JSON.parse(($('#importbox') || {}).value || '');
      if (validState(parsed)) { state = parsed; }
      else { toast('Not a Forte export'); return; }
      patchProgram();
      save();
      applyTheme();
      location.hash = '#/';
      toast('Imported');
      syncPush({ force: true });
    } catch (e) { toast('Could not parse JSON'); }
    return;
  }

  if (action === 'add-slot') {
    const day = findDay(t.getAttribute('data-day'));
    if (!day) return;
    const id = 's' + uid();
    day.slots.push({ id, name: 'New exercise', target: '', track: true, rest: 'normal', cue: '' });
    save();
    location.hash = `#/program/${day.id}/${id}`;
    return;
  }
  if (action === 'edit-track' || action === 'edit-added' || action === 'edit-reps') {
    const { slot } = editedSlot();
    if (!slot) return;
    const key = action === 'edit-track' ? 'track' : action === 'edit-added' ? 'added' : 'reps';
    slot[key] = !slot[key];
    save(); render();
    return;
  }
  if (action === 'edit-rest') {
    const { slot } = editedSlot();
    if (!slot) return;
    slot.rest = t.getAttribute('data-v');
    save(); render();
    return;
  }
  if (action === 'edit-up' || action === 'edit-down') {
    const { day, slot } = editedSlot();
    if (!day || !slot) return;
    const i = day.slots.indexOf(slot);
    const j = action === 'edit-up' ? i - 1 : i + 1;
    if (j < 0 || j >= day.slots.length) return;
    day.slots.splice(i, 1);
    day.slots.splice(j, 0, slot);
    save();
    toast(action === 'edit-up' ? 'Moved up' : 'Moved down');
    return;
  }
  if (action === 'edit-delete') {
    const { day, slot } = editedSlot();
    if (!day || !slot) return;
    day.slots.splice(day.slots.indexOf(slot), 1);
    save();
    location.hash = '#/program';
    return;
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target.closest('[data-action]');
  if (!t) return;
  const action = t.getAttribute('data-action');
  const dayId = currentDayId();

  if (action === 'weight') {
    const slotId = t.getAttribute('data-slot');
    const e = activeEntry(dayId, slotId);
    e.weight = t.value === '' ? '' : parseFloat(t.value);
    if (!Number.isFinite(e.weight)) e.weight = '';
    const slot = findSlot(findDay(dayId), slotId);
    if (slot) refreshRow(dayId, slot);
    saveSoon();
    return;
  }
  if (action === 'reps') {
    const slotId = t.getAttribute('data-slot');
    const e = activeEntry(dayId, slotId);
    e.reps = t.value === '' ? '' : parseInt(t.value, 10);
    if (!Number.isFinite(e.reps)) e.reps = '';
    const slot = findSlot(findDay(dayId), slotId);
    if (slot) refreshRow(dayId, slot);
    saveSoon();
    return;
  }
  if (action === 'notetext') {
    const e = activeEntry(dayId, t.getAttribute('data-slot'));
    e.note = t.value;
    const card = $(`[data-slotcard="${t.getAttribute('data-slot')}"]`);
    if (card) card.classList.toggle('has-note', !!t.value.trim());
    saveSoon();
    return;
  }
  if (action === 'rest-normal' || action === 'rest-heavy') {
    const n = parseInt(t.value, 10);
    if (Number.isFinite(n) && n >= 10 && n <= 900) {
      state.settings[action === 'rest-normal' ? 'restNormal' : 'restHeavy'] = n;
      saveSoon();
    }
    return;
  }

  const editable = { 'edit-name': 'name', 'edit-target': 'target', 'edit-cue': 'cue', 'edit-warmup': 'warmup' };
  if (editable[action]) {
    const { slot } = editedSlot();
    if (!slot) return;
    slot[editable[action]] = t.value;
    saveSoon();
    return;
  }
  if (action === 'edit-menu') {
    const { slot } = editedSlot();
    if (!slot) return;
    const lines = t.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) slot.menu = lines; else delete slot.menu;
    saveSoon();
    return;
  }
  if (action === 'edit-pair') {
    const { slot } = editedSlot();
    if (!slot) return;
    const v = t.value.trim();
    if (v) slot.pair = v; else delete slot.pair;
    saveSoon();
    return;
  }
  if (action === 'edit-pairrest') {
    const { slot } = editedSlot();
    if (!slot) return;
    const v = parseInt(t.value, 10);
    if (v > 0) slot.pairRest = v; else delete slot.pairRest;
    saveSoon();
    return;
  }
});

/* ============================== export ============================== */

function exportJSON() {
  const json = JSON.stringify(state, null, 1);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `forte-${stamp}.json`;
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: name }).then(() => {
      state.settings.lastExport = Date.now();
      save();
    }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  state.settings.lastExport = Date.now();
  save();
}

/* ============================ Drive sync ============================
   One-way backup to Tanner's Google Drive through the Gym Sync Apps Script
   (strength-rebuild/drive-sync). The whole state goes up after Finish, and
   when the app is left with program/settings changes; the script keeps
   latest.json + one copy per day and rebuilds the Google Sheet. No signal →
   it waits and goes up on the next open. The in-flight session never
   triggers a send. Config lives under its own key, so Export, Import and
   Erase never carry or wipe it. */

const SYNC_STORE = 'forte-sync';
const SYNC_APP = 'forte';
let sync = { url: '', key: '', lastOk: 0, sentHash: '', error: '', drive: 0 };
let syncBusy = false;
let syncAgain = false;

function syncLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(SYNC_STORE) || 'null');
    if (raw && typeof raw === 'object') sync = Object.assign(sync, raw);
  } catch (e) { /* unreadable → not connected */ }
}
function syncSave() { try { localStorage.setItem(SYNC_STORE, JSON.stringify(sync)); } catch (e) {} }
function syncOn() { return !!(sync.url && sync.key); }

// What's worth a send: everything but the session in progress.
function syncHash() {
  const rest = {};
  for (const k in state) if (k !== 'active' && k !== 'drafts') rest[k] = state[k];
  const s = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '.' + s.length;
}

// opts.force: Import/Restore — replace Drive's copy even if it has more.
// opts.always: send even if nothing changed (Connect, Sync now).
function syncPush(opts) {
  opts = opts || {};
  if (!syncOn()) return Promise.resolve(false);
  if (syncBusy) { syncAgain = true; return Promise.resolve(false); }
  const h = syncHash();
  if (!opts.force && !opts.always && h === sync.sentHash) return Promise.resolve(true);
  syncBusy = true;
  syncPaint('Sending…');
  const body = JSON.stringify({ app: SYNC_APP, key: sync.key, force: !!opts.force, version: APP_VERSION, state });
  return fetch(sync.url, {
    method: 'POST', body, cache: 'no-store', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // no preflight — Apps Script can't answer one
  })
    .then((r) => r.json())
    .then((res) => {
      if (res && res.ok) { sync.lastOk = Date.now(); sync.sentHash = h; sync.error = ''; sync.drive = 0; }
      else { sync.error = (res && res.error) || 'failed'; sync.drive = (res && res.drive) || 0; }
      return !!(res && res.ok);
    })
    .catch(() => { sync.error = 'offline'; return false; })
    .then((ok) => {
      syncBusy = false;
      syncSave();
      syncPaint();
      if (syncAgain) { syncAgain = false; syncPush(); }
      return ok;
    });
}

function syncRestore() {
  if (!syncOn()) return;
  syncPaint('Fetching…');
  const u = `${sync.url}?app=${encodeURIComponent(SYNC_APP)}&key=${encodeURIComponent(sync.key)}&action=latest&t=${Date.now()}`;
  fetch(u, { cache: 'no-store', redirect: 'follow' })
    .then((r) => r.json())
    .then((res) => {
      if (!res || !res.ok) {
        toast(res && res.error === 'empty' ? 'Nothing on Drive yet' : res && res.error === 'bad-key' ? 'Sync code rejected' : 'Restore failed');
        syncPaint();
        return;
      }
      if (!validState(res.state)) { toast('Drive copy unreadable'); syncPaint(); return; }
      state = res.state;
      patchProgram();
      save();
      applyTheme();
      sync.sentHash = syncHash();
      sync.lastOk = Date.now(); sync.error = ''; sync.drive = 0;
      syncSave();
      location.hash = '#/';
      render();
      toast(`Restored · ${state.sessions.length} session${state.sessions.length === 1 ? "" : "s"}`);
    })
    .catch(() => { toast('No connection'); syncPaint(); });
}

function syncConnect(code) {
  let cfg = null;
  try { cfg = JSON.parse(atob(String(code || '').replace(/\s+/g, '').replace(/^GS1\./, ''))); } catch (e) {}
  if (!cfg || !/^https:\/\//.test(cfg.u || '') || !cfg.k) { toast('That isn’t a sync code'); return; }
  if (cfg.a !== SYNC_APP) { toast('That code is for Strength Rebuild'); return; }
  sync = { url: cfg.u, key: cfg.k, lastOk: 0, sentHash: '', error: '', drive: 0 };
  syncSave();
  render();
  syncPush({ always: true }).then((ok) => { if (ok) toast('Connected to Drive'); });
}

function syncDisconnect() {
  sync = { url: '', key: '', lastOk: 0, sentHash: '', error: '', drive: 0 };
  try { localStorage.removeItem(SYNC_STORE); } catch (e) {}
  render();
}

function syncAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const d = new Date(t);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (new Date().toDateString() === d.toDateString()) return `today ${time}`;
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ` ${time}`;
}

function syncStatus() {
  if (sync.error === 'behind') {
    return { warn: true, text: `Drive has ${sync.drive}, this phone ${state.sessions.length} sessions — Restore first` };
  }
  if (sync.error === 'bad-key') return { warn: true, text: 'Sync code rejected — reconnect' };
  const pending = sync.sentHash !== syncHash();
  if (sync.error && pending) return { warn: false, text: 'Waiting for signal — sends on next open' };
  if (!sync.lastOk) return { warn: false, text: 'Not sent yet' };
  return { warn: false, text: `Saved ${syncAgo(sync.lastOk)}${pending ? ' · changes waiting' : ''}` };
}

function syncPaint(busyText) {
  const el = $('#syncstate');
  if (!el) return;
  const s = busyText ? { warn: false, text: busyText } : syncStatus();
  el.textContent = s.text;
  el.classList.toggle('warn', !!s.warn);
}

function viewSyncGroup() {
  if (!syncOn()) {
    return `
      <div class="sechead">Drive</div>
      <div class="group">
        <div class="setrow syncrow">
          <input class="synccode" id="synccode" type="text" placeholder="Paste sync code" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button class="setbtn" data-action="sync-connect">Connect</button>
        </div>
      </div>`;
  }
  const s = syncStatus();
  return `
    <div class="sechead">Drive</div>
    <div class="group">
      <div class="setrow">
        <div class="setlabel">Backup</div>
        <div class="syncstate${s.warn ? ' warn' : ''}" id="syncstate">${esc(s.text)}</div>
      </div>
      <div class="setrow">
        <div class="btnrow">
          <button class="setbtn" data-action="sync-now">Sync now</button>
          <button class="setbtn" data-action="sync-restore">Restore</button>
        </div>
        <button class="setbtn quiet" data-action="sync-off">Disconnect</button>
      </div>
    </div>`;
}

let pendingRestore = false;
function syncAction(action, t) {
  if (action === 'sync-connect') { syncConnect(($('#synccode') || {}).value); return true; }
  if (action === 'sync-now') { syncPush({ always: true }); return true; }
  if (action === 'sync-off') {
    if (t.textContent !== 'Tap again') { t.textContent = 'Tap again'; setTimeout(() => { if (document.body.contains(t)) t.textContent = 'Disconnect'; }, 3500); return true; }
    syncDisconnect();
    return true;
  }
  if (action === 'sync-restore') {
    if (!pendingRestore) {
      pendingRestore = true;
      t.textContent = 'Replace this phone?';
      t.classList.add('danger');
      setTimeout(() => { pendingRestore = false; if (document.body.contains(t)) { t.textContent = 'Restore'; t.classList.remove('danger'); } }, 3500);
      return true;
    }
    pendingRestore = false;
    syncRestore();
    return true;
  }
  return false;
}

// Leaving the app sends what changed; coming back (or regaining signal)
// retries anything that didn't make it.
document.addEventListener('visibilitychange', () => { if (syncOn()) syncPush(); });
window.addEventListener('online', () => { if (syncOn()) syncPush(); });

/* ============================ update flow ============================
   Installed iOS PWAs cling to old versions: they resume without a fresh
   boot (no update check) and a single failed request used to sink the
   whole SW install. Check for an update on every resume, and when a new
   version takes control, reload into it — unless a rest is running. */

let reloadOnControl = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadOnControl) return;
    reloadOnControl = false;
    if (rest.running) { toast('Update ready — lands on next open'); return; }
    location.reload();
  });
}
function checkForUpdate() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration()
    .then((reg) => { if (reg) { reloadOnControl = true; reg.update(); } })
    .catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener('load', () => setTimeout(checkForUpdate, 3000));

/* ============================== boot ============================== */

load();
syncLoad();
patchProgram();
quarantineAutoSessions();
applyTheme();
render();
if (syncOn()) syncPush();
// The greeting plays as its own screen once per launch, from home only.
if ((location.hash || '#/') === '#/') showSplash();
