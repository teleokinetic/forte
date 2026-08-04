/* Forte — Carolina's gym companion. One surface, one-press rest (silent).
   Same engine as Strength Rebuild v2: no per-set logging — tracked slots
   capture one working weight (prefilled from last session), menu slots
   take a note. Rest never auto-starts. */

'use strict';

/* ============================== state ============================== */

const STORE_KEY = 'forte-state-v1';
const APP_VERSION = '1.4.0';

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
  if (v >= 1.2) return;

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

  p.specVersion = '1.2';
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

// The ladder's rungs come from the program's own push-up menu; the current
// rung is her latest pick (active session first, then the log).
function pushupLadder() {
  let menu = null;
  for (const id of PUSHUP_IDS) {
    if (menu) break;
    for (const day of state.program.days) {
      const s = day.slots.find((sl) => slug(sl.name) === id && sl.menu && sl.menu.length);
      if (s) { menu = s.menu; break; }
    }
  }
  const rungs = (menu || []).map(rungShort);
  let current = null;
  const pick = latestPushupRung();
  if (pick) {
    const i = rungs.indexOf(pick);
    if (i !== -1) current = i;
  }
  return { rungs, current };
}

function latestPushupRung() {
  const a = state.active;
  if (a) {
    const day = findDay(a.dayId);
    if (day) {
      for (const s of day.slots) {
        const e = a.entries[s.id];
        if (e && e.rung && PUSHUP_IDS.includes(slug(s.name))) return e.rung;
      }
    }
  }
  for (let i = state.sessions.length - 1; i >= 0; i--) {
    const en = (state.sessions[i].entries || []).find((e) => e.rung && PUSHUP_IDS.includes(e.exerciseId));
    if (en) return en.rung;
  }
  return null;
}

function rungFirstDates() {
  const map = {};
  for (const sess of state.sessions) {
    for (const en of (sess.entries || [])) {
      if (en.rung && PUSHUP_IDS.includes(en.exerciseId) && !(en.rung in map)) map[en.rung] = sess.endedAt;
    }
  }
  return map;
}

/* ============================ session core ============================ */

// A session begins lazily: the first weight tweak or note creates it. Finishing
// records every tracked slot at its effective (prefilled or adjusted) weight.
// An unfinished session left on the other day is banked, never discarded.
function ensureActive(dayId) {
  if (state.active && state.active.dayId === dayId) return state.active;
  if (state.active) {
    recordSession(state.active.dayId, '(auto-saved — session left open)', true);
    toast('Previous session auto-saved');
  }
  state.active = { dayId, startedAt: Date.now(), lastActivityAt: Date.now(), entries: {} };
  return state.active;
}

function activeEntry(dayId, slotId) {
  const a = ensureActive(dayId);
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
    if (slot.track) {
      const w = effectiveWeight(dayId, slot);
      const entry = { exerciseId: slug(slot.name), name: slot.name, weight: w === '' ? '' : parseFloat(w), note: slotNote };
      if (slot.reps) {
        const r = effectiveReps(dayId, slot);
        entry.reps = r === '' ? '' : parseInt(r, 10);
      }
      if (rung) entry.rung = rung;
      entries.push(entry);
    } else if (slotNote || rung) {
      const entry = { exerciseId: slug(slot.name), name: slot.name, weight: '', note: slotNote };
      if (rung) entry.rung = rung;
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

// A session left hanging past 12h is finished, not lost: adjusted weights and
// notes are real data, and "forgot to hit finish" is the common failure.
const STALE_AFTER_MS = 12 * 3600 * 1000;
function autoFinishStale() {
  const a = state.active;
  if (!a) return;
  const last = a.lastActivityAt || a.startedAt;
  if (Date.now() - last > STALE_AFTER_MS) {
    recordSession(a.dayId, '(auto-saved — session left open)', true);
    save();
    render();
    toast('Previous session auto-saved');
  }
}

// An installed PWA resumes for days without a fresh boot — run the stale
// check whenever the app comes back, not just at launch.
document.addEventListener('visibilitychange', () => { if (!document.hidden) autoFinishStale(); });
window.addEventListener('pageshow', (e) => { if (e.persisted) autoFinishStale(); });

/* ====================== rest engine (silent) ======================
   No audio: media playback would take the iOS audio session and cut off
   whatever she's listening to for the whole rest. End of rest =
   vibration where supported + the dock's visual done state. */

const rest = { running: false, endsAt: 0, total: 0, tier: null, done: false };
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

function restStart(tier) {
  const sec = tier === 'heavy' ? state.settings.restHeavy : state.settings.restNormal;
  rest.running = true;
  rest.done = false;
  rest.tier = tier;
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

function topbar(backTo, title) {
  const left = backTo
    ? `<a class="backlink" href="${backTo}">‹ Back</a>`
    : `<div class="wordmark">Forte</div>`;
  const right = backTo
    ? (title ? `<div class="pagetitle">${esc(title)}</div>` : '')
    : `<a class="gear" href="#/settings" aria-label="Settings">⚙</a>`;
  return `<div class="topbar">${left}${right}</div>`;
}

// Pressed sprig — the one ornament. Absolutely positioned into the empty
// corner, negative z-index so cards always paint over it.
function sprigHTML() {
  return `
    <svg class="sprig" viewBox="0 0 104 118" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M96 6 C 78 18 54 38 40 62 C 32 76 27 89 26 102"/>
        <path d="M60 44 C 54 54 50 62 48 72" stroke-width="1.7"/>
        <path d="M74 26 c 10 -9 22 -10 30 -4 c -10 9 -22 10 -30 4 z" fill="currentColor" stroke="none" opacity="0.3"/>
        <path d="M38 66 c -11 -3 -18 -11 -19 -21 c 11 3 18 11 19 21 z" fill="currentColor" stroke="none" opacity="0.3"/>
        <g transform="translate(38 70) scale(0.8)" stroke-width="1.7">
          <ellipse cx="12" cy="6.2" rx="3.4" ry="4.8"/>
          <ellipse cx="12" cy="6.2" rx="3.4" ry="4.8" transform="rotate(72 12 12)"/>
          <ellipse cx="12" cy="6.2" rx="3.4" ry="4.8" transform="rotate(144 12 12)"/>
          <ellipse cx="12" cy="6.2" rx="3.4" ry="4.8" transform="rotate(216 12 12)"/>
          <ellipse cx="12" cy="6.2" rx="3.4" ry="4.8" transform="rotate(288 12 12)"/>
        </g>
        <circle cx="26" cy="106" r="2.6" fill="currentColor" stroke="none" opacity="0.55"/>
      </g>
    </svg>`;
}

// Day glyphs in the sprig's hand: Terra sprouts, Voo flies.
function dayGlyphHTML(dayId) {
  if (dayId === 'terra') return `
    <svg class="dayglyph" viewBox="0 0 44 44" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 36 Q 22 30 38 36"/><path d="M22 34 V 20"/><path d="M22 22 C 20 14 13 11 7 12 C 9 19 15 22 22 22 Z" fill="currentColor" stroke="none" opacity=".35"/><path d="M22 18 C 24 11 30 8 36 9 C 34 16 28 19 22 18 Z" fill="currentColor" stroke="none" opacity=".35"/></g></svg>`;
  if (dayId === 'voo') return `
    <svg class="dayglyph" viewBox="0 0 44 44" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 26 C 12 18 20 16 27 20 C 24 24 16 27 8 27 Z" fill="currentColor" stroke="none" opacity=".35"/><path d="M26 20 C 31 14 38 12 42 13 C 39 18 33 21 27 21"/><path d="M26 20 C 28 25 28 31 25 36"/><path d="M27 20 L 21 15"/></g></svg>`;
  return '';
}

// The sprig's five-petal flower, opened. Blooms on the finish screen and
// waits at the top of the push-up ladder.
function bloomHTML(cls, strokeWidth) {
  const petal = (rot) => `<ellipse class="petal" cx="44" cy="23" rx="12" ry="17" fill="currentColor" fill-opacity=".16"${rot ? ` transform="rotate(${rot} 44 44)"` : ''}/>`;
  return `
    <svg class="${cls}" viewBox="0 0 88 88" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round">
        ${petal(0)}${petal(72)}${petal(144)}${petal(216)}${petal(288)}
        <circle cx="44" cy="44" r="4.5" fill="currentColor" stroke="none" opacity=".55"/>
      </g>
    </svg>`;
}

function greetingHTML() {
  const now = new Date();
  const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
  return `
    <div class="greet">
      ${sprigHTML()}
      <div class="greet-ola">${esc(saudacao())}, Carolina</div>
      <div class="greet-date">${esc(weekday)} · ${esc(fmtDate(now.getTime()))}</div>
    </div>`;
}

function viewHome() {
  const cards = state.program.days.map((day) => {
    const last = lastSessionFor(day.id);
    const when = last
      ? `${fmtDateLong(last.endedAt)} — ${relPhrase(last.endedAt)}`
      : "First one's waiting";
    return `
      <a class="daycard" href="#/day/${day.id}">
        ${dayGlyphHTML(day.id)}
        <div class="daycard-name">${esc(day.name)}</div>
        <div class="daycard-sub">${esc(day.subtitle)}</div>
        <div class="daycard-last">${esc(when)}</div>
      </a>`;
  }).join('');
  return `${topbar()}${greetingHTML()}<div class="daygrid">${cards}</div>${progressoRowHTML()}`;
}

function progressoRowHTML() {
  const n = state.sessions.filter((s) => !s.auto).length;
  const ladder = pushupLadder();
  const sub = ladder.current != null
    ? `Push-up ladder · rung ${ladder.current + 1} of ${ladder.rungs.length + 1} — ${n} session${n === 1 ? '' : 's'}`
    : n ? `${n} session${n === 1 ? '' : 's'} logged`
        : 'The road to your first full set';
  return `
    <a class="progresso" href="#/progresso">
      <div class="progresso-mark">
        <svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20 L 12 4"/><path d="M13 20 L 20 4"/><path d="M7 15 H 16"/><path d="M9 9 H 18"/></g></svg>
      </div>
      <div>
        <div class="progresso-t">Progresso</div>
        <div class="progresso-s">${esc(sub)}</div>
      </div>
      <div class="progresso-chev">›</div>
    </a>`;
}

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

function slotCardHTML(day, slot) {
  const a = state.active && state.active.dayId === day.id ? state.active.entries[slot.id] : null;
  const note = a && a.note ? a.note : '';
  const done = !!(a && a.done);
  const menu = slot.menu && slot.menu.length ? rungsHTML(slot, a) : '';
  const partners = pairPartners(day, slot);
  const pairNote = partners.length
    ? `<div class="pair-note">Pair with ${esc(pairNames(day, slot))} — ${partners.length > 1 ? 'cycle through' : 'alternate sets'}</div>`
    : '';
  const warmup = slot.warmup
    ? `<div class="warmup"><span class="warmup-tag">Warm-up</span> ${esc(slot.warmup)}</div>` : '';
  let chip = '', chipEdit = '';
  if (slot.track) {
    const w = effectiveWeight(day.id, slot);
    // Empty chip invites instead of showing "— lb ×—" dashes; the numeric
    // spans stay in the DOM so live updates work before the next render.
    const empty = w === '' || w == null;
    const label = empty ? '—' : (slot.added ? '+' : '') + w;
    const r = slot.reps ? effectiveReps(day.id, slot) : null;
    const repsChip = slot.reps
      ? `<span class="chip-reps">×${r === '' || r == null ? '—' : esc(String(r))}</span>` : '';
    chip = `
      <button class="chip ${empty ? 'empty' : ''}" data-action="chip" data-slot="${slot.id}">
        <span class="chip-add">add weight</span>
        <span class="chip-num">${esc(String(label))}</span>
        <span class="chip-unit">${esc(state.settings.unit)}</span>
        ${repsChip}
        <span class="chip-caret">▾</span>
      </button>`;
    // Full-width row(s) below the footer — inside the flex footer this
    // forces the whole page past the viewport when revealed.
    const weightRow = `
        <button class="step" data-action="step" data-slot="${slot.id}" data-d="-5">−5</button>
        <input class="chip-input" type="number" inputmode="decimal" step="any"
               data-action="weight" data-slot="${slot.id}" value="${w === '' || w == null ? '' : esc(String(w))}">
        <button class="step" data-action="step" data-slot="${slot.id}" data-d="5">+5</button>`;
    chipEdit = slot.reps
      ? `
      <div class="chip-edit stacked hidden" data-edit="${slot.id}">
        <div class="edit-row"><span class="edit-tag">${esc(state.settings.unit)}</span>${weightRow}</div>
        <div class="edit-row"><span class="edit-tag">reps</span>
          <button class="step" data-action="rstep" data-slot="${slot.id}" data-d="-1">−1</button>
          <input class="chip-input" type="number" inputmode="numeric"
                 data-action="reps" data-slot="${slot.id}" value="${r === '' || r == null ? '' : esc(String(r))}">
          <button class="step" data-action="rstep" data-slot="${slot.id}" data-d="1">+1</button>
        </div>
      </div>`
      : `
      <div class="chip-edit hidden" data-edit="${slot.id}">${weightRow}</div>`;
  }
  return `
    <div class="slot ${done ? 'done' : ''}" data-slotcard="${slot.id}">
      <div class="slot-head">
        <button class="ring" data-action="done" data-slot="${slot.id}"
          aria-label="Mark done" aria-pressed="${done}"></button>
        <div class="slot-name">${esc(slot.name)}</div>
        <div class="slot-target">${esc(slot.target || '')}</div>
      </div>
      ${pairNote}
      ${slot.cue ? `<div class="slot-cue">${esc(slot.cue)}</div>` : ''}
      ${warmup}${menu}
      <div class="slot-foot">
        ${chip}
        <button class="notebtn ${note ? 'has-note' : ''}" data-action="note" data-slot="${slot.id}">✎ note</button>
      </div>
      ${chipEdit}
      <div class="note-edit hidden" data-noteedit="${slot.id}">
        <textarea rows="2" data-action="notetext" data-slot="${slot.id}"
          placeholder="How did it go?">${esc(note)}</textarea>
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

// First unchecked slot in program order — what she's on right now.
function currentSlot(dayId) {
  const day = findDay(dayId);
  if (!day) return null;
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  return day.slots.find((s) => !(a && a.entries[s.id] && a.entries[s.id].done)) || null;
}

function restDockHTML(dayId) {
  const n = state.settings.restNormal, h = state.settings.restHeavy;
  if (rest.running) {
    const left = (rest.endsAt - Date.now()) / 1000;
    const pct = Math.max(0, Math.min(100, (1 - left / rest.total) * 100));
    return `
      <div class="rest-running">
        <div class="rest-fill" data-rest-fill style="width:${pct}%"></div>
        <div class="rest-row">
          <div class="rest-time" data-rest-time>${fmtMMSS(left)}</div>
          <span class="rest-label">resting</span>
          <button class="rest-mini" data-action="rest-restart">↻</button>
          <button class="rest-mini" data-action="rest-cancel">✕</button>
        </div>
      </div>`;
  }
  if (rest.done) {
    return `<button class="rest-done" data-action="rest-ack">Rest done — go</button>`;
  }
  // The tier the current exercise wants takes the rose and says why.
  const cur = dayId ? currentSlot(dayId) : null;
  const heavyHint = !!(cur && cur.rest === 'heavy');
  const pairFor = !heavyHint && cur ? pairNames(findDay(dayId), cur) : '';
  return `
    <div class="rest-idle">
      <button class="restbtn ${heavyHint ? 'heavy' : ''}" data-action="rest" data-tier="normal">Rest <span>${fmtMMSS(n)}</span>${pairFor ? `<span class="rest-for">Pairs with ${esc(pairFor)}</span>` : ''}</button>
      <button class="restbtn ${heavyHint ? '' : 'heavy'}" data-action="rest" data-tier="heavy">Rest <span>${fmtMMSS(h)}</span>${heavyHint ? `<span class="rest-for">${esc(cur.name)} rests long</span>` : ''}</button>
    </div>`;
}

function renderRestDock() {
  const dock = $('#restdock');
  if (dock) dock.innerHTML = restDockHTML(currentDayId());
}

function trailHTML(dayId) {
  const day = findDay(dayId);
  if (!day) return '';
  const a = state.active && state.active.dayId === dayId ? state.active : null;
  const done = day.slots.filter((s) => a && a.entries[s.id] && a.entries[s.id].done).length;
  const pips = day.slots.map((s, i) => `<div class="pip ${i < done ? 'on' : ''}"></div>`).join('');
  return `${pips}<span class="trail-count">${done} of ${day.slots.length}</span>`;
}

function renderTrail() {
  const el = $('[data-trail]');
  const dayId = currentDayId();
  if (el && dayId) el.innerHTML = trailHTML(dayId);
}
function updateRestTime(left) {
  const t = $('[data-rest-time]');
  const f = $('[data-rest-fill]');
  if (t) t.textContent = fmtMMSS(left);
  if (f) f.style.width = Math.max(0, Math.min(100, (1 - left / rest.total) * 100)) + '%';
}

function viewDay(dayId) {
  const day = findDay(dayId);
  if (!day) { location.hash = '#/'; return ''; }
  return `
    ${topbar('#/')}
    <div class="dayhead">
      ${sprigHTML()}
      <div class="dayhead-name">${esc(day.name)} <span class="dayhead-sub">${esc(day.subtitle)}</span></div>
    </div>
    <div class="trail" data-trail>${trailHTML(day.id)}</div>
    <div id="restdock" class="restdock">${restDockHTML(day.id)}</div>
    <div class="slots">${day.slots.map((s) => slotCardHTML(day, s)).join('')}</div>
    <button class="finishbtn" data-action="finish" data-day="${day.id}">Finish session</button>`;
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
  const extras = [];
  for (const slot of day.slots) {
    const e = a ? a.entries[slot.id] : null;
    const rung = e && e.rung ? e.rung : '';
    if (slot.track) {
      const w = effectiveWeight(dayId, slot);
      const wtxt = w === '' || w == null ? '—' : `${slot.added ? '+' : ''}${w} ${state.settings.unit}`;
      let rtxt = '';
      if (slot.reps) {
        const r = effectiveReps(dayId, slot);
        rtxt = ` ×${r === '' || r == null ? '—' : r}`;
      }
      rows.push(`<div class="rrow"><span class="rname">${esc(slot.name)}</span><span class="rnum"><b>${esc(wtxt)}</b>${esc(rtxt)}</span></div>`);
    }
    if (rung) extras.push(`${slot.name} — ${rung}`);
  }
  const recap = rows.length || extras.length ? `
    <div class="recap">
      ${rows.join('')}
      ${extras.length ? `<div class="rmenu">${esc(extras.join(' · '))}</div>` : ''}
    </div>` : '';
  return `
    ${topbar('#/day/' + dayId)}
    <div class="finish-wrap">
      <div class="bloomwrap">${bloomHTML('bloom', 2.6)}</div>
      <div class="boa">Boa, Carolina!</div>
      <div class="fsub">${esc(sub.join(' · '))}</div>
      ${recap}
      <textarea id="finishnote" rows="3" placeholder="Session note (optional)"></textarea>
      <button class="finishbtn solid" data-action="finish-save" data-day="${day.id}">Save session</button>
    </div>`;
}

/* ---------- progresso ---------- */

function trendCards() {
  const seen = new Set();
  const cards = [];
  for (const day of state.program.days) {
    for (const s of day.slots) {
      if (!s.track) continue;
      const id = slug(s.name);
      if (seen.has(id)) continue;
      seen.add(id);
      const pts = [];
      for (const sess of state.sessions) {
        if (sess.auto) continue;
        const en = (sess.entries || []).find((e) => e.exerciseId === id && e.weight !== '' && e.weight != null);
        if (en) pts.push(en.weight);
      }
      if (pts.length < 2) continue;
      const view = pts.slice(-12);
      cards.push({ name: s.name, pts: view, first: view[0], last: view[view.length - 1], chin: /chin/i.test(s.name) });
    }
  }
  return cards;
}

function trendSuffix(c) {
  const d = +(c.last - c.first).toFixed(1);
  if (c.chin && d < 0) return ' · less help = stronger';
  if (d > 0) return ` · +${d}`;
  if (d < 0) return ` · −${Math.abs(d)}`;
  return ' · steady';
}

function sparkSVG(pts) {
  const w = 120, h = 38, pad = 5;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, pts.length - 1);
  const y = (v) => max === min ? h / 2 : h - pad - ((v - min) * (h - 2 * pad)) / span;
  const line = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="120" height="38" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts[pts.length - 1]).toFixed(1)}" r="3.6" fill="currentColor"/>
  </svg>`;
}

function rhythmHTML() {
  const real = state.sessions.filter((s) => !s.auto);
  if (!real.length) return '';
  const firstW = weekStart(real[0].endedAt);
  const nowW = weekStart(Date.now());
  const weeks = [];
  const d = new Date(nowW);
  while (weeks.length < 5 && d.getTime() >= firstW) {
    const ws = d.getTime();
    weeks.unshift({ start: ws, count: real.filter((s) => weekStart(s.endedAt) === ws).length });
    d.setDate(d.getDate() - 7);
  }
  const cols = weeks.map((wk) => {
    let dots = '';
    for (let i = 0; i < Math.min(wk.count, 4); i++) dots += '<div class="wdot"></div>';
    if (!wk.count) dots = '<div class="wdot zero"></div>';
    else if (wk.start === nowW && wk.count === 1) dots += '<div class="wdot faded"></div>';
    const label = new Date(wk.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<div class="week"><div class="wdots">${dots}</div><div class="wl">${esc(label)}</div></div>`;
  }).join('');
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].start === nowW) { if (weeks[i].count >= 2) streak++; continue; }
    if (weeks[i].count >= 2) streak++; else break;
  }
  const total = weeks.reduce((s, wk) => s + wk.count, 0);
  const line = streak >= 2
    ? `Two a week, ${streak} weeks straight`
    : weeks.length === 1
      ? `${total} session${total === 1 ? '' : 's'} this week`
      : `${total} session${total === 1 ? '' : 's'} in the last ${weeks.length} weeks`;
  return `
    <div class="eyebrow">Rhythm</div>
    <div class="trend rhythm-card">
      <div class="rhythm">${cols}</div>
      <div class="tline rhythm-line">${esc(line)}</div>
    </div>`;
}

function viewProgresso() {
  const ladder = pushupLadder();
  const firstDates = rungFirstDates();
  let ladderHTML = '';
  if (ladder.rungs.length) {
    const rows = [`
      <div class="lrow future">
        <div class="lrail"><div class="ldot next"></div><div class="lline"></div></div>
        <div class="lbody">
          <div class="lname">First set of full push-ups ${bloomHTML('goalmark', 5)}</div>
          <div class="ldesc">The goal — and it blooms</div>
        </div>
      </div>`];
    for (let i = ladder.rungs.length - 1; i >= 0; i--) {
      const r = ladder.rungs[i];
      const isNow = ladder.current === i;
      const isDone = ladder.current != null && i < ladder.current;
      const when = isNow ? 'Now' : (isDone && firstDates[r] ? fmtDate(firstDates[r]) : '');
      rows.push(`
        <div class="lrow ${isNow || isDone ? '' : 'future'}">
          <div class="lrail"><div class="ldot ${isNow ? 'now' : (isDone ? '' : 'next')}"></div>${i === 0 ? '' : '<div class="lline"></div>'}</div>
          <div class="lbody">
            ${when ? `<div class="lwhen">${esc(when)}</div>` : ''}
            <div class="lname">${esc(r)}</div>
          </div>
        </div>`);
    }
    const cap = ladder.current == null
      ? 'Pick a rung on the push-up card and the ladder starts moving.'
      : 'Moves when you pick a rung on the push-up card — no separate upkeep.';
    ladderHTML = `
      <div class="eyebrow" style="margin-top:4px">The road to your first full set</div>
      <div class="ladder">${rows.join('')}<div class="lcap">${esc(cap)}</div></div>`;
  }
  const cards = trendCards();
  const trends = cards.length
    ? cards.map((c) => `
      <div class="trend">
        <div class="tinfo">
          <div class="tname">${esc(c.name)}</div>
          <div class="tline">${esc(String(c.first))} → <b>${esc(String(c.last))} ${esc(state.settings.unit)}</b>${trendSuffix(c)}</div>
        </div>
        ${sparkSVG(c.pts)}
      </div>`).join('')
    : `<p class="finish-hint">Two more sessions and the lines appear.</p>`;
  return `
    ${topbar('#/', 'Progresso')}
    ${ladderHTML}
    <div class="eyebrow">In the gym</div>
    ${trends}
    ${rhythmHTML()}`;
}

function viewSettings() {
  const s = state.settings;
  const seg = (name, val, opts) => opts.map(([v, label]) =>
    `<button class="seg ${val === v ? 'on' : ''}" data-action="${name}" data-v="${v}">${label}</button>`
  ).join('');
  return `
    ${topbar('#/')}
    <div class="settings">
      <div class="setrow">
        <div class="setlabel">Theme</div>
        <div class="segwrap">${seg('theme', s.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}</div>
      </div>
      <div class="setrow">
        <div class="setlabel">Unit</div>
        <div class="segwrap">${seg('unit', s.unit, [['lb', 'lb'], ['kg', 'kg']])}</div>
      </div>
      <div class="setrow">
        <div class="setlabel">Rest — normal</div>
        <input class="setnum" type="number" inputmode="numeric" data-action="rest-normal" value="${s.restNormal}"> s
      </div>
      <div class="setrow">
        <div class="setlabel">Rest — heavy</div>
        <input class="setnum" type="number" inputmode="numeric" data-action="rest-heavy" value="${s.restHeavy}"> s
      </div>
      <div class="setrow">
        <div class="setlabel">Program</div>
        <a class="setbtn" href="#/program">Edit</a>
      </div>
      <div class="setrow">
        <div class="setlabel">Data</div>
        <div class="btnrow">
          <button class="setbtn" data-action="export">Export</button>
          <button class="setbtn" data-action="copy-json">Copy JSON</button>
          <a class="setbtn" href="#/import">Import</a>
        </div>
      </div>
      <div class="setrow">
        <div class="setlabel">Danger</div>
        <button class="setbtn danger" data-action="erase">Erase all data</button>
      </div>
      <div class="version">v${APP_VERSION} · ${state.sessions.length} sessions logged</div>
    </div>`;
}

function viewImport() {
  return `
    ${topbar('#/settings')}
    <div class="settings">
      <div class="eyebrow">Import</div>
      <p class="finish-hint">Paste a Forte JSON export. Replaces everything.</p>
      <textarea id="importbox" rows="8" placeholder="{ … }"></textarea>
      <button class="finishbtn solid" data-action="import-load">Load</button>
    </div>`;
}

function viewProgram() {
  const days = state.program.days.map((day) => `
    <div class="eyebrow">${esc(day.name)} — ${esc(day.subtitle)}</div>
    <div class="proglist">
      ${day.slots.map((s) => `
        <a class="progrow" href="#/program/${day.id}/${s.id}">
          <span>${esc(s.name)}</span>
          <span class="progrow-target">${esc(s.target || '')}</span>
        </a>`).join('')}
      <button class="setbtn" data-action="add-slot" data-day="${day.id}">+ Add exercise</button>
    </div>`).join('');
  return `${topbar('#/settings')}<div class="settings">${days}</div>`;
}

function viewSlotEdit(dayId, slotId) {
  const day = findDay(dayId);
  const slot = findSlot(day, slotId);
  if (!slot) { location.hash = '#/program'; return ''; }
  const field = (label, action, value, ph) => `
    <label class="editfield"><span>${label}</span>
      <input type="text" data-action="${action}" value="${esc(value || '')}" placeholder="${ph || ''}"></label>`;
  return `
    ${topbar('#/program')}
    <div class="settings" data-editing-day="${dayId}" data-editing-slot="${slotId}">
      ${field('Name', 'edit-name', slot.name)}
      ${field('Target', 'edit-target', slot.target, 'e.g. 3×6–8 · RIR 2–3')}
      ${field('Cue', 'edit-cue', slot.cue)}
      ${field('Warm-up', 'edit-warmup', slot.warmup)}
      <label class="editfield"><span>Menu (one per line)</span>
        <textarea rows="4" data-action="edit-menu">${esc((slot.menu || []).join('\n'))}</textarea></label>
      ${field('Pair (same letter = done together)', 'edit-pair', slot.pair, 'e.g. a')}
      <div class="setrow">
        <div class="setlabel">Track weight</div>
        <button class="seg ${slot.track ? 'on' : ''}" data-action="edit-track">${slot.track ? 'On' : 'Off'}</button>
      </div>
      <div class="setrow">
        <div class="setlabel">Added load (+)</div>
        <button class="seg ${slot.added ? 'on' : ''}" data-action="edit-added">${slot.added ? 'On' : 'Off'}</button>
      </div>
      <div class="setrow">
        <div class="setlabel">Track reps</div>
        <button class="seg ${slot.reps ? 'on' : ''}" data-action="edit-reps">${slot.reps ? 'On' : 'Off'}</button>
      </div>
      <div class="setrow">
        <div class="setlabel">Rest tier</div>
        <div class="segwrap">
          <button class="seg ${slot.rest !== 'heavy' ? 'on' : ''}" data-action="edit-rest" data-v="normal">Normal</button>
          <button class="seg ${slot.rest === 'heavy' ? 'on' : ''}" data-action="edit-rest" data-v="heavy">Heavy</button>
        </div>
      </div>
      <div class="btnrow">
        <button class="setbtn" data-action="edit-up">↑ Move up</button>
        <button class="setbtn" data-action="edit-down">↓ Move down</button>
        <button class="setbtn danger" data-action="edit-delete">Delete</button>
      </div>
    </div>`;
}

/* ============================== router ============================== */

function render() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/');
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

function currentDayId() {
  const m = (location.hash || '').match(/^#\/day\/([^/]+)/);
  return m ? m[1] : null;
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

  if (action === 'rest') { restStart(t.getAttribute('data-tier')); return; }
  if (action === 'rest-restart') { restStart(rest.tier || 'normal'); return; }
  if (action === 'rest-cancel') { restCancel(); return; }
  if (action === 'rest-ack') { rest.done = false; renderRestDock(); return; }

  if (action === 'done') {
    const slotId = t.getAttribute('data-slot');
    const e = activeEntry(dayId, slotId);
    e.done = !e.done;
    save();
    const card = $(`[data-slotcard="${slotId}"]`);
    if (card) card.classList.toggle('done', e.done);
    t.setAttribute('aria-pressed', e.done ? 'true' : 'false');
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
    return;
  }
  if (action === 'chip') {
    const box = $(`[data-edit="${t.getAttribute('data-slot')}"]`);
    if (box) {
      box.classList.toggle('hidden');
      t.classList.toggle('open', !box.classList.contains('hidden'));
    }
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
    const input = $(`[data-edit="${slotId}"] .chip-input`);
    if (input) input.value = e.weight;
    const chipNum = $(`[data-slotcard="${slotId}"] .chip-num`);
    if (chipNum) {
      chipNum.textContent = (slot.added ? '+' : '') + e.weight;
      chipNum.closest('.chip').classList.remove('empty');
    }
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
    const chipReps = $(`[data-slotcard="${slotId}"] .chip-reps`);
    if (chipReps) chipReps.textContent = '×' + e.reps;
    return;
  }
  if (action === 'note') {
    const box = $(`[data-noteedit="${t.getAttribute('data-slot')}"]`);
    if (box) {
      box.classList.toggle('hidden');
      if (!box.classList.contains('hidden')) box.querySelector('textarea').focus();
    }
    return;
  }

  if (action === 'finish') { location.hash = '#/finish/' + t.getAttribute('data-day'); return; }
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
    const day = findDay(dayId);
    const slot = findSlot(day, slotId);
    const chipNum = $(`[data-slotcard="${slotId}"] .chip-num`);
    if (chipNum && slot) {
      chipNum.textContent = e.weight === '' ? '—' : (slot.added ? '+' : '') + e.weight;
      if (e.weight !== '') chipNum.closest('.chip').classList.remove('empty');
    }
    saveSoon();
    return;
  }
  if (action === 'reps') {
    const slotId = t.getAttribute('data-slot');
    const e = activeEntry(dayId, slotId);
    e.reps = t.value === '' ? '' : parseInt(t.value, 10);
    if (!Number.isFinite(e.reps)) e.reps = '';
    const chipReps = $(`[data-slotcard="${slotId}"] .chip-reps`);
    if (chipReps) chipReps.textContent = '×' + (e.reps === '' ? '—' : e.reps);
    saveSoon();
    return;
  }
  if (action === 'notetext') {
    const e = activeEntry(dayId, t.getAttribute('data-slot'));
    e.note = t.value;
    const btn = $(`[data-slotcard="${t.getAttribute('data-slot')}"] .notebtn`);
    if (btn) btn.classList.toggle('has-note', !!t.value.trim());
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
applyTheme();
autoFinishStale();
render();
