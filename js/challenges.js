/**
 * challenges.js — Retos de fotos
 * 
 * Maneja retos diarios y lista scavenger hunt.
 * Estado (completados) guardado en localStorage.
 * Flujo de foto: cámara → compartir via navigator.share.
 */

let challengesData = null;
const STORAGE_KEY = 'guia-challenges-state';

/**
 * Inicializa el módulo de retos.
 */
export function initChallenges(data) {
  challengesData = data;
  // Exponer función de renderizado para que el router la llame
  window.__renderChallenges = renderChallengesView;
  setupChallengesListeners();
}

function setupChallengesListeners() {
  // Listener para el input de cámara
  const cameraInput = document.getElementById('camera-input');
  if (cameraInput) {
    cameraInput.addEventListener('change', handlePhotoCapture);
  }
}

/**
 * Renderiza la vista completa de retos.
 */
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
      <div class="challenge-emoji">🎉</div>
      <div class="challenge-title">¡Todos los retos completados!</div>
      <p class="challenge-text">Han completado todos los retos diarios del viaje.</p>
    `;
    return;
  }

  const dayLabel = getDemoMode()
    ? `Día ${challenge.day}`
    : `Reto del día (Día ${challenge.day})`;

  container.innerHTML = `
    <div class="challenge-emoji" aria-hidden="true">${challenge.emoji}</div>
    <div class="challenge-title">${dayLabel}: ${challenge.title}</div>
    <p class="challenge-text">${challenge.challenge}</p>
    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
      <button class="btn btn-primary" id="btn-take-photo" style="flex: 1; min-width: 140px;">
        📷 Tomar foto
      </button>
    </div>
  `;

  // Conectar botón de tomar foto
  container.querySelector('#btn-take-photo')?.addEventListener('click', () => {
    document.getElementById('camera-input')?.click();
  });
}

function getCurrentDailyChallenge() {
  if (!challengesData?.daily?.length) return null;

  if (getDemoMode()) {
    // En modo demo, mostrar el primer reto no completado
    // o el primer reto si ninguno se ha completado
    return challengesData.daily[0];
  }

  const tripStart = new Date(challengesData.trip_start_date + 'T00:00:00');
  const today = new Date();
  const dayNumber = Math.floor((today - tripStart) / (1000 * 60 * 60 * 24)) + 1;

  if (dayNumber < 1 || dayNumber > challengesData.daily.length) return null;
  return challengesData.daily[dayNumber - 1];
}

function getDemoMode() {
  // Leer de config.json (cargada vía app.js)
  try {
    const config = JSON.parse(localStorage.getItem('guia-config-cache') || '{}');
    return config.demo_mode !== false; // Default: true
  } catch {
    return true;
  }
}

// --- Lista Scavenger Hunt ---

function renderScavengerList() {
  const container = document.getElementById('scavenger-list');
  if (!container || !challengesData?.scavenger) return;

  const completedIds = getCompletedScavenger();
  container.innerHTML = '';

  challengesData.scavenger.forEach(item => {
    const isCompleted = completedIds.includes(item.id);

    const el = document.createElement('div');
    el.className = `scavenger-item ${isCompleted ? 'completed' : ''}`;
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', isCompleted ? 'true' : 'false');
    el.setAttribute('tabindex', '0');

    el.innerHTML = `
      <div class="scavenger-checkbox">${isCompleted ? '✓' : ''}</div>
      <span class="scavenger-text">${item.challenge}</span>
      <span class="scavenger-points">${item.points} pts</span>
    `;

    el.addEventListener('click', () => toggleScavenger(item.id));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleScavenger(item.id);
      }
    });

    container.appendChild(el);
  });
}

function toggleScavenger(id) {
  const completed = getCompletedScavenger();
  const index = completed.indexOf(id);

  if (index === -1) {
    completed.push(id);
  } else {
    completed.splice(index, 1);
  }

  saveCompletedScavenger(completed);

  // Re-renderizar
  renderScavengerList();
  renderScore();
}

// --- Puntuación ---

function renderScore() {
  const container = document.getElementById('challenge-score');
  if (!container || !challengesData) return;

  const completed = getCompletedScavenger();
  let totalPoints = 0;

  // Sumar puntos de scavenger completados
  challengesData.scavenger.forEach(item => {
    if (completed.includes(item.id)) {
      totalPoints += item.points;
    }
  });

  // Determinar nivel
  const levels = challengesData.scoring?.levels || [];
  let currentLevel = levels[0]?.label || '';
  for (const level of levels) {
    if (totalPoints >= level.min) {
      currentLevel = level.label;
    }
  }

  container.innerHTML = `
    <div class="score-number">${totalPoints} puntos</div>
    <div class="score-label">Puntos del scavenger hunt</div>
    <div class="score-level">${currentLevel}</div>
  `;
}

// --- Manejo de fotos ---

async function handlePhotoCapture(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Intentar compartir la foto
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Reto de fotos — Guía Europa 2026',
        text: '📸 ¡Reto completado!'
      });
    } catch (err) {
      // El usuario canceló el share, o no se soporta
      if (err.name !== 'AbortError') {
        console.warn('Error al compartir:', err);
        offerDownload(file);
      }
    }
  } else {
    // Fallback: ofrecer descargar la foto
    offerDownload(file);
  }

  // Limpiar el input para permitir otra foto
  event.target.value = '';
}

/**
 * Fallback cuando navigator.share no soporta archivos.
 * Crea un link de descarga temporal.
 */
function offerDownload(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reto-${Date.now()}.jpg`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Persistencia en localStorage ---

function getCompletedScavenger() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return state.completedScavenger || [];
  } catch {
    return [];
  }
}

function saveCompletedScavenger(ids) {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state.completedScavenger = ids;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('No se pudo guardar el estado de retos:', err);
  }
}
