/**
 * preferences.js — Onboarding y preferencias de categorías
 * 
 * Maneja la pantalla de selección de intereses (primer uso)
 * y almacena las preferencias en localStorage.
 */

import { navigateTo, renderHome } from './app.js';

const STORAGE_KEY = 'guia-preferences';
const ONBOARDING_KEY = 'guia-onboarding-done';

let appConfig = null;

/**
 * Inicializa el módulo de preferencias.
 */
export function initPreferences(config) {
  appConfig = config;
  setupOnboardingUI();
  setupOnboardingListeners();

  // Guardar config en localStorage para que challenges.js pueda leerla
  try {
    localStorage.setItem('guia-config-cache', JSON.stringify({
      demo_mode: config.demo_mode,
      trip_start_date: config.trip_start_date
    }));
  } catch { /* localStorage no disponible */ }

  // Restaurar ciudad guardada
  const savedCity = localStorage.getItem('guia-current-city');
  if (savedCity && config.cities.some(c => c.id === savedCity)) {
    // Se accede via getState() en app.js, aquí solo notificamos
    // (el state se actualiza directamente en app.js al cargar)
  }
}

/**
 * Verifica si el usuario ya completó el onboarding.
 */
export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === 'true';
}

/**
 * Retorna las preferencias guardadas (array de IDs de categoría).
 */
export function getPreferences() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Guarda las preferencias.
 */
function savePreferences(categories) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.warn('No se pudieron guardar las preferencias:', err);
  }
}

/**
 * Marca el onboarding como completado.
 */
function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch { /* ok */ }
}

// --- UI del Onboarding ---

function setupOnboardingUI() {
  const container = document.getElementById('onboarding-categories');
  if (!container || !appConfig?.categories) return;

  container.innerHTML = '';
  const selectedCategories = new Set();

  appConfig.categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.setAttribute('role', 'checkbox');
    chip.setAttribute('aria-checked', 'false');
    chip.setAttribute('aria-label', cat.label);
    chip.textContent = `${cat.emoji} ${cat.label}`;

    chip.addEventListener('click', () => {
      const isSelected = chip.classList.toggle('selected');
      chip.setAttribute('aria-checked', isSelected ? 'true' : 'false');

      if (isSelected) {
        selectedCategories.add(cat.id);
      } else {
        selectedCategories.delete(cat.id);
      }

      // Habilitar botón "Empezar" si hay al menos 1 selección
      const btnStart = document.getElementById('btn-start');
      if (btnStart) {
        btnStart.disabled = selectedCategories.size === 0;
      }
    });

    container.appendChild(chip);
  });

  // Guardar referencia a las categorías seleccionadas para el botón
  container._selectedCategories = selectedCategories;
}

function setupOnboardingListeners() {
  const btnStart = document.getElementById('btn-start');
  if (!btnStart) return;

  btnStart.addEventListener('click', () => {
    const container = document.getElementById('onboarding-categories');
    const selectedCategories = container?._selectedCategories;

    if (selectedCategories && selectedCategories.size > 0) {
      savePreferences([...selectedCategories]);
      markOnboardingDone();
      navigateTo('home');
      // Pequeño delay para que la vista cambie antes de renderizar
      setTimeout(() => renderHome(), 50);
    }
  });
}
