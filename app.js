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
const APP_VERSION = '1.12.0';

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
  if (v >= 1.6) return;

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

  p.specVersion = '1.6';
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

// Effective weight shown on a slot chip: session adjustment wins, else prefill.
function effectiveWeight(dayId, slot) {
  const a = state.active;
  const e = a && a.dayId === dayId ? a.entries[slot.id] : null;
  if (e && e.weight != null && e.weight !== '') return e.weight;
  if (e && e.weight === '') return '';
  return lastWeightFor(slug(slot.name));
}

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
        const r = effectiveReps(dayId, slot);
        entry.reps = r === '' ? '' : parseInt(r, 10);
      }
      if (rung) entry.rung = rung;
      if (sets) entry.sets = sets;
      entries.push(entry);
    } else if (slotNote || rung || sets || (slot.reps && e && e.reps != null && e.reps !== '')) {
      // Menu slots record only when touched; once the entry exists, reps
      // carry prefill — same deal as tracked weights.
      const entry = { exerciseId: slug(slot.name), name: slot.name, weight: '', note: slotNote };
      if (slot.reps) {
        const r = effectiveReps(dayId, slot);
        if (r !== '' && r != null) entry.reps = parseInt(r, 10);
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

function effectiveReps(dayId, slot) {
  const a = state.active;
  const e = a && a.dayId === dayId ? a.entries[slot.id] : null;
  if (e && e.reps != null && e.reps !== '') return e.reps;
  if (e && e.reps === '') return '';
  return lastRepsFor(slug(slot.name));
}

function finishSession(dayId, note) {
  if (!findDay(dayId)) return;
  recordSession(dayId, note);
  restCancel();
  save();
  location.hash = '#/';
  toast('Session saved');
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

function cap(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }

function topbar(backTo) {
  const left = backTo
    ? `<a class="backlink" href="${backTo}">${icon('back', 2.4)}Back</a>`
    : `<div class="wordmark">Forte</div>`;
  const right = backTo ? '' : `<a class="gear" href="#/settings" aria-label="Settings">${icon('gear', 1.8)}</a>`;
  return `<div class="topbar">${left}${right}</div>`;
}

/* ---- ornaments ----
   Drawn once, in one hand: a fine stroke with a soft rosé fill. The day
   marks sit in a tinted tile; the sprig signs off home and Progresso; the
   bloom is how finishing looks — an exercise, a dupla, a whole session. */

// Terra sprouts from the ground; Voo is two birds in flight.
function dayGlyphHTML(dayId) {
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

// A rose stem: one bud, two leaves. The quiet sign-off at the foot of a page.
function sprigHTML() {
  return `
    <svg class="sprig" viewBox="0 0 48 76" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
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
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  return `
    <div class="greet">
      <h1 class="greet-ola">${esc(saudacao())}, Carolina</h1>
      <div class="greet-date">${esc(weekday)} · ${esc(fmtDate(now.getTime()))}</div>
    </div>`;
}

function lastRealSessionFor(dayId) {
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const s = state.sessions[i];
    if (s.dayId === dayId && !s.auto) return s;
  }
  return null;
}

// The day she's on: an open session wins; otherwise the day trained least
// recently (never-trained first), so Terra and Voo alternate on their own.
function suggestedDay() {
  if (state.active && findDay(state.active.dayId)) return findDay(state.active.dayId);
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
  return `<span>${last ? esc(cap(relPhrase(last.endedAt))) : 'Not yet'}</span>`;
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
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].start === nowW) { if (weeks[i].count >= 2) streak++; continue; }
    if (weeks[i].count >= 2) streak++; else break;
  }
  const thisWeek = weeks.length && weeks[weeks.length - 1].start === nowW ? weeks[weeks.length - 1].count : 0;
  return { weeks, streak, thisWeek, nowW };
}

function weekLine(st) {
  if (!st) return 'Two a week is the rhythm';
  const run = st.streak >= 2 ? ` · ${st.streak} weeks running` : '';
  if (st.thisWeek >= 2) return `Two this week${run}`;
  return `${st.thisWeek} of 2 this week${run}`;
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

// The way into Progresso: a tinted strip, not another card like the days.
// One headline (what's ready, else her biggest gain), the push-up rung
// under it, and the push-up road drawn small on the right.
function progressoRowHTML() {
  const ready = nextSessionItems().filter((i) => i.ready).length;
  const gain = bestGain();
  const pu = roadsData().find((r) => r.key === 'pushups');
  let main;
  if (ready) main = `${ready} lift${ready === 1 ? '' : 's'} ready to move up`;
  else if (gain) main = `${gain.row.name} +${gain.delta} ${state.settings.unit}`;
  else main = realSessions().length ? 'Every session counts here' : 'The road to your first full set';
  const sub = pu && pu.current != null ? `Push-ups · ${pu.nodes[pu.current].name}` : '';
  const road = pu ? `<span class="mini-road">${pu.nodes.map((n, i) =>
    `<span class="mini-rn ${pu.current != null && i <= pu.current ? 'on' : ''} ${n.goal ? 'goal' : ''}"></span>`).join('')}</span>` : '';
  return `
    <a class="prow" href="#/progresso">
      <span class="prow-body">
        <span class="prow-k">Progresso${icon('chev', 2.6)}</span>
        <span class="prow-main">${esc(main)}</span>
        ${sub ? `<span class="prow-s">${esc(sub)}</span>` : ''}
      </span>
      ${road}
    </a>`;
}

// Home: one card answers "what am I doing today", the other day waits
// below as a single row, Progresso follows, and this week's strip sits at
// the foot. Sized to fit one standard iPhone screen.
function viewHome() {
  const next = suggestedDay();
  if (!next) return `${topbar()}${greetingHTML()}${progressoRowHTML()}`;
  if (!next) return `${topbar()}${greetingHTML()}${progressoRowHTML()}`;
  const live = !!(state.active && state.active.dayId === next.id);
  const mins = typicalMinutes(next.id);
  const last = lastRealSessionFor(next.id);
  const meta = [`${next.slots.length} exercises`];
  if (mins) meta.push(`about ${mins} min`);
  if (!live && last) meta.push(`last ${relPhrase(last.endedAt)}`);
  const others = state.program.days.filter((d) => d.id !== next.id).map((d) => `
    <a class="dayrow" href="#/day/${d.id}">
      <span class="daymark">${dayGlyphHTML(d.id)}</span>
      <span class="dr-body"><span class="dr-name">${esc(d.name)}</span><span class="dr-sub">${esc(d.subtitle)}</span></span>
      <span class="dr-when">${dayStatusHTML(d)}</span>${icon('chev', 2.2)}
    </a>`).join('');
  const st = rhythmStats();
  return `
    ${topbar()}
    ${greetingHTML()}
    <a class="upnext" href="#/day/${next.id}">
      <span class="upnext-top"><span class="daymark lg">${dayGlyphHTML(next.id)}</span>
        <span class="upnext-k ${live ? 'live' : ''}">${live ? 'In progress' : 'Up next'}</span></span>
      <span class="upnext-name">${esc(next.name)}</span>
      <span class="upnext-sub">${esc(next.subtitle)}</span>
      <span class="upnext-meta">${esc(meta.join(' · '))}</span>
      <span class="upnext-go">${live ? 'Pick up where you left off' : `Start ${esc(next.name)}`}${icon('chev', 2.4)}</span>
    </a>
    ${others ? `<div class="group dayrows">${others}</div>` : ''}
    ${progressoRowHTML()}
    ${weekStripHTML(st)}
    <div class="fieldmark">${sprigHTML()}</div>`;
}

// This week as seven days, each trained day marked with that day's glyph.
function weekStripHTML(st) {
  const days = weekDays().map((d) => {
    const mark = d.days.length
      ? `<span class="wk-mark">${dayGlyphHTML(d.days[d.days.length - 1])}</span>`
      : '<span class="wk-mark empty"></span>';
    return `<div class="wk-day ${d.today ? 'today' : ''} ${d.future ? 'future' : ''}">
      <span class="wk-l">${esc(d.letter)}</span><span class="wk-n">${d.num}</span>${mark}</div>`;
  }).join('');
  return `
    <div class="card weekcard">
      <div class="wk-row">${days}</div>
      <div class="wk-line">${esc(weekLine(st))}</div>
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
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  const el = document.createElement('div');
  el.className = 'splash';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="splash-inner">
      ${sprigHTML().replace(/<path /g, '<path pathLength="1" ')}
      <div class="splash-ola">${esc(saudacao())}, Carolina</div>
      <div class="splash-date">${esc(weekday)} · ${esc(fmtDate(now.getTime()))}</div>
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
    }, 760);
  };
  el.addEventListener('click', settle);
  splashTimer = setTimeout(settle, 1900);
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
function ringHTML(slot, e) {
  const done = !!(e && e.done);
  const total = setTarget(slot);
  if (!total) {
    return `<button class="ring ${done ? 'on' : ''}" data-action="done" data-slot="${slot.id}"
      aria-label="Mark done" aria-pressed="${done}"></button>`;
  }
  const n = done ? total : Math.min((e && e.sets) || 0, total - 1);
  const off = RING_CIRC * (1 - n / total);
  return `
    <button class="ring counting ${done ? 'on' : ''}" data-action="done" data-slot="${slot.id}"
      aria-label="${done ? 'Reset sets' : `Count one set (${n} of ${total})`}" aria-pressed="${done}">
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <circle class="ring-track" cx="14" cy="14" r="12"></circle>
        <circle class="ring-arc" cx="14" cy="14" r="12"
          style="stroke-dasharray:${RING_CIRC.toFixed(2)};stroke-dashoffset:${off.toFixed(2)}"></circle>
      </svg>
      <span class="ring-count">${done ? icon('check', 3.2) : (n || '')}</span>
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
  return t + (t && rung ? '<span class="sub-dot"> · </span>' : '') + rung;
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
    if (slot.track) rows.push(stepRow(state.settings.unit, 'weight', slot, 5, effectiveWeight(day.id, slot), 'decimal'));
    if (slot.reps) rows.push(stepRow('reps', 'reps', slot, 1, effectiveReps(day.id, slot), 'numeric'));
    steppers = `<div class="chip-edit" data-edit="${slot.id}">${rows.join('')}</div>`;
  }
  const val = slot.track || slot.reps
    ? `<button class="val" data-action="expand" data-slot="${slot.id}" aria-label="Adjust">${valHTML(day.id, slot)}</button>` : '';
  return `
    <div class="slot ${done ? 'done' : ''} ${note.trim() ? 'has-note' : ''}" data-slotcard="${slot.id}">
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
    `<button class="restbtn ${on ? '' : 'quiet'}" data-action="rest" data-tier="${tier}"><span class="restbtn-k">Rest</span><span class="restbtn-t">${fmtMMSS(sec)}</span></button>`;
  return `<div class="rest-idle">${btn('normal', nSec, !heavy)}${btn('heavy', state.settings.restHeavy, heavy)}</div>`;
}

function renderRestDock() {
  const dock = $('#restdock');
  if (dock) dock.innerHTML = restDockHTML(currentDayId());
}

// The session trail: one segment per exercise, pinned in the dock.
function trailHTML(day) {
  const a = state.active && state.active.dayId === day.id ? state.active : null;
  let done = 0;
  const pips = day.slots.map((s) => {
    const on = !!(a && a.entries[s.id] && a.entries[s.id].done);
    if (on) done++;
    return `<span class="trail-pip ${on ? 'on' : ''}"></span>`;
  }).join('');
  const all = done === day.slots.length && done > 0;
  return `<div class="trail ${all ? 'all' : ''}" data-trail><div class="trail-bar">${pips}</div><span class="trail-count">${done} of ${day.slots.length}</span></div>`;
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
    const allDone = g.slots.every((s) => a && a.entries[s.id] && a.entries[s.id].done);
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
  const allDone = !!a && day.slots.every((s) => a.entries[s.id] && a.entries[s.id].done);
  return `
    ${topbar('#/')}
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

// Five petals fly off a ring the moment its exercise is done.
function petalBurst(ringEl) {
  if (!ringEl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const row = ringEl.closest('.slot-row');
  if (!row) return;
  const b = document.createElement('span');
  b.className = 'burst';
  b.style.left = (ringEl.offsetLeft + ringEl.offsetWidth / 2) + 'px';
  b.style.top = (ringEl.offsetTop + ringEl.offsetHeight / 2) + 'px';
  b.innerHTML = [0, 1, 2, 3, 4].map((i) => `<i style="--a:${i * 72 + 18}deg;--d:${i * 22}ms"></i>`).join('');
  row.appendChild(b);
  setTimeout(() => b.remove(), 1000);
}

function viewFinish(dayId) {
  const day = findDay(dayId);
  if (!day) { location.hash = '#/'; return ''; }
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  const doneCount = a ? day.slots.filter((s) => a.entries[s.id] && a.entries[s.id].done).length : 0;
  const mins = a ? Math.round((Date.now() - a.startedAt) / 60000) : 0;
  const sub = [day.name];
  if (doneCount) sub.push(`${doneCount} of ${day.slots.length}`);
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
        const r = effectiveReps(dayId, slot);
        num += ` ×${r === '' || r == null ? '—' : esc(String(r))}`;
      }
    } else if (slot.reps) {
      const r = effectiveReps(dayId, slot);
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
    slot = day.slots.find((s) => s.track && isAssisted(s));
    if (slot) break;
  }
  if (!slot) return null;
  const id = slug(slot.name);
  const pts = [];
  for (const sess of realSessions()) {
    const en = (sess.entries || []).find((e) => e.exerciseId === id && e.weight !== '' && e.weight != null);
    if (en) pts.push({ w: en.weight, t: sess.endedAt });
  }
  if (!pts.length) return null;
  return { key: 'chin', title: 'Chin-ups', kind: 'assist', start: pts[0], now: pts[pts.length - 1] };
}

function roadHTML(r) {
  const unit = esc(state.settings.unit);
  if (r.kind === 'assist') {
    const start = Math.max(r.start.w, r.now.w, 1);
    const pct = Math.max(0, Math.min(100, (1 - r.now.w / start) * 100));
    const less = +(r.start.w - r.now.w).toFixed(1);
    const since = less > 0 ? ` · ${less} less than ${fmtDate(r.start.t)}` : '';
    return `
      <div class="road">
        <div class="road-head"><span class="road-title">${esc(r.title)}</span><span class="road-goal">First one unassisted</span></div>
        <div class="road-bar"><i style="width:${pct.toFixed(1)}%"></i><b style="left:${pct.toFixed(1)}%"></b><span class="road-goalmark">${bloomSVG('bloom-mini')}</span></div>
        <div class="road-ends"><span>${esc(String(start))} ${unit} help</span><span>0</span></div>
        <div class="road-now">Now <b>${esc(String(r.now.w))} ${unit}</b> help${esc(since)}</div>
      </div>`;
  }
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
      if (!s.reps) continue;
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
      if (!s.track) continue;
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

// One encouraging line per lift: how far it's come, in her units.
function gainLine(row) {
  const unit = state.settings.unit;
  const a = row.pts[0], b = row.pts[row.pts.length - 1];
  if (row.pts.length < 2) return { text: 'First one in the book', up: false };
  const d = +(b.w - a.w).toFixed(1);
  if (row.assisted) {
    return d < 0 ? { text: `${-d} ${unit} less help`, up: true } : { text: 'Holding steady', up: false };
  }
  if (d > 0) {
    if (a.w > 0) return { text: `+${d} ${unit} · ${Math.round((d / a.w) * 100)}% stronger`, up: true };
    return { text: `+${d} ${unit} on top of bodyweight`, up: true };
  }
  if (d === 0 && a.r && b.r && b.r > a.r) return { text: `+${b.r - a.r} reps at the same weight`, up: true };
  return { text: 'Holding steady', up: false };
}

// True when the last session is the best one yet (weight, then reps).
function isNewBest(row) {
  if (row.pts.length < 2) return false;
  const last = row.pts[row.pts.length - 1];
  return row.pts.slice(0, -1).every((p) => {
    if (p.w !== last.w) return row.assisted ? last.w < p.w : last.w > p.w;
    return (last.r || 0) > (p.r || 0);
  });
}

function sinceRowHTML(row) {
  const unit = esc(state.settings.unit);
  const b = row.pts[row.pts.length - 1];
  const g = gainLine(row);
  let best = row.pts[0];
  for (const p of row.pts) {
    const better = row.assisted ? p.w < best.w : p.w > best.w;
    if (better || (p.w === best.w && (p.r || 0) > (best.r || 0))) best = p;
  }
  const bestTxt = `${row.assisted ? 'Least help' : 'Best'}: ${best.w} ${state.settings.unit}${best.r ? ` ×${best.r}` : ''} · ${fmtDate(best.t)}`;
  return `
    <button class="mrow" data-action="mrow" data-m="${esc(row.id)}" aria-expanded="false">
      <span class="m-body"><span class="mname">${esc(row.name)}</span>
        <span class="msub ${g.up ? 'up' : ''}">${esc(g.text)}</span></span>
      <span class="mnum">${isNewBest(row) ? `<span class="newbest" aria-label="New best last session">${bloomSVG('bloom-mini')}</span>` : ''}<b>${esc(String(b.w))}</b> ${unit}</span>
      <span class="mchev">${icon('chev', 2.4)}</span>
    </button>
    <div class="tcard hidden" data-mdetail="${esc(row.id)}">
      ${historySVG(row.pts)}
      <div class="tline">${esc(bestTxt)}${row.pts.some((p) => p.r) ? ' · <span class="dim">reps under each point</span>' : ''}</div>
    </div>`;
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
    ${rows.length ? `<div class="sechead">Since ${esc(sinceWord)}</div><div class="group mlist">${rows.map(sinceRowHTML).join('')}</div>` : ''}
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

function render() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/');
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
  $('#app').innerHTML = html;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

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
      } else {
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
      if (e.done) closeDrawers();
    }
    // A pair or trio whose last member just finished says so, with a bloom.
    const group = card && card.closest('.slotgroup.pair');
    if (group) {
      const all = [...group.querySelectorAll('[data-slotcard]')].every((c) => c.classList.contains('done'));
      if (all && !group.classList.contains('done')) group.classList.add('just');
      group.classList.toggle('done', all);
    }
    t.outerHTML = ringHTML(slot, e);
    const ringNow = card && card.querySelector('.ring');
    if (ringNow) {
      ringNow.classList.add('pop');
      if (e.done) petalBurst(ringNow);
    }
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
patchProgram();
quarantineAutoSessions();
applyTheme();
render();
// The greeting plays as its own screen once per launch, from home only.
if ((location.hash || '#/') === '#/') showSplash();
