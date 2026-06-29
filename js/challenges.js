/**
 * challenges.js — Retos de fotos
 *
 * Clases CSS alineadas con styles.css v2.0:
 * - .scavenger-item / .scavenger-check / .scavenger-check.done
 * - .scavenger-text / .scavenger-text.done / .scavenger-points
 * - .score-card / .score-label / .score-level / .score-value
 * - .card-challenge-full (contenedor del reto diario)
 */

let challengesData = null;
const STORAGE_KEY = 'guia-challenges-state';

export function initChallenges(data) {
  challengesData = data;
  window.__renderChallenges = renderChallengesView;
  setupChallengesListeners();
}

function setupChallengesListeners() {
  const cameraInput = document.getElementById('camera-input');
  if (cameraInput) cameraInput.addEventListener('change', handlePhotoCapture);
}

function renderChallengesView() {
  if (!challengesData) return;
  renderDailyChallenge();
  renderScavengerList();
  renderScore();
}

// --- Reto del día ---
function renderDailyChallenge() {
  const container = document.getElementById('challenge-daily');
  if (!container) return;

  const challenge = getCurrentDailyChallenge();
  if (!challenge) {
    container.innerHTML = `
      <div style="font-size:32px;margin-bottom:8px;">🎉</div>
      <div style="font-family:var(--serif);font-size:19px;font-weight:600;color:white;margin-bottom:6px;">¡Todos los retos completados!</div>
      <p style="font-size:15px;color:rgba(255,255,255,0.75);">Han completado todos los retos diarios del viaje.</p>
    `;
    return;
  }

  const dayLabel = getDemoMode() ? `Día ${challenge.day}` : `Día ${challenge.day}`;

  container.innerHTML = `
    <div style="font-size:32px;margin-bottom:8px;" aria-hidden="true">${challenge.emoji}</div>
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:4px;">${dayLabel}</div>
    <div style="font-family:var(--serif);font-size:22px;font-weight:600;color:white;margin-bottom:8px;">${challenge.title}</div>
    <p style="font-size:16px;color:rgba(255,255,255,0.8);margin-bottom:18px;line-height:1.5;">${challenge.challenge}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button id="btn-take-photo" class="btn btn-primary" style="flex:1;min-width:140px;background:rgba(255,255,255,0.18);border:1.5px solid rgba(255,255,255,0.3);box-shadow:none;">
        📷 Tomar foto
      </button>
    </div>
  `;

  container.querySelector('#btn-take-photo')?.addEventListener('click', () => {
    document.getElementById('camera-input')?.click();
  });
}

function getCurrentDailyChallenge() {
  if (!challengesData?.daily?.length) return null;
  if (getDemoMode()) return challengesData.daily[0];

  const tripStart = new Date((challengesData.trip_start_date || '2026-07-10') + 'T00:00:00');
  const dayNumber = Math.floor((new Date() - tripStart) / 86400000) + 1;
  if (dayNumber < 1 || dayNumber > challengesData.daily.length) return null;
  return challengesData.daily[dayNumber - 1];
}

function getDemoMode() {
  try {
    const cfg = JSON.parse(localStorage.getItem('guia-config-cache') || '{}');
    return cfg.demo_mode !== false;
  } catch { return true; }
}

// --- Scavenger Hunt ---
function renderScavengerList() {
  const container = document.getElementById('scavenger-list');
  if (!container || !challengesData?.scavenger) return;

  const completedIds = getCompletedScavenger();
  container.innerHTML = '';

  challengesData.scavenger.forEach(item => {
    const isDone = completedIds.includes(item.id);

    const el = document.createElement('div');
    el.className = 'scavenger-item';
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', String(isDone));
    el.setAttribute('tabindex', '0');

    // CSS: .scavenger-check / .scavenger-check.done / .scavenger-text / .scavenger-text.done / .scavenger-points
    el.innerHTML = `
      <div class="scavenger-check${isDone ? ' done' : ''}">${isDone ? '✓' : ''}</div>
      <span class="scavenger-text${isDone ? ' done' : ''}">${item.challenge}</span>
      <span class="scavenger-points">${item.points} pts</span>
    `;

    el.addEventListener('click', () => toggleScavenger(item.id));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleScavenger(item.id); }
    });

    container.appendChild(el);
  });
}

function toggleScavenger(id) {
  const completed = getCompletedScavenger();
  const idx = completed.indexOf(id);
  if (idx === -1) completed.push(id); else completed.splice(idx, 1);
  saveCompletedScavenger(completed);
  renderScavengerList();
  renderScore();
}

// --- Puntuación ---
function renderScore() {
  const container = document.getElementById('challenge-score');
  if (!container || !challengesData) return;

  const completed = getCompletedScavenger();
  let totalPoints = 0;
  challengesData.scavenger.forEach(item => {
    if (completed.includes(item.id)) totalPoints += item.points;
  });

  const levels = challengesData.scoring?.levels || [];
  let currentLevel = levels[0]?.label || '';
  for (const level of levels) {
    if (totalPoints >= level.min) currentLevel = level.label;
  }

  // CSS: .score-card / .score-label / .score-level / .score-value
  container.innerHTML = `
    <div>
      <div class="score-label">Puntos del scavenger hunt</div>
      <div class="score-level">${currentLevel}</div>
    </div>
    <div class="score-value">${totalPoints}</div>
  `;
}

// --- Foto ---
async function handlePhotoCapture(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Reto de fotos — Guía Europa 2026',
        text: '📸 ¡Reto completado!'
      });
    } catch (err) {
      if (err.name !== 'AbortError') offerDownload(file);
    }
  } else {
    offerDownload(file);
  }

  event.target.value = '';
}

function offerDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reto-${Date.now()}.jpg`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Persistencia ---
function getCompletedScavenger() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').completedScavenger || [];
  } catch { return []; }
}

function saveCompletedScavenger(ids) {
  try {
    const st = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    st.completedScavenger = ids;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
  } catch { /* ok */ }
}
