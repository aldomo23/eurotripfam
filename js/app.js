/**
 * app.js — Lógica principal de la Guía Europa 2026
 * 
 * Responsabilidades:
 * - Cargar datos (config, places, food, challenges)
 * - Router hash-based (SPA)
 * - Renderizar vistas (home, place, food, categorías)
 * - Gestionar selector de ciudad
 */

import { initSearch } from './search.js';
import { initSpeech } from './speech.js';
import { initChat } from './ai-chat.js';
import { initChallenges } from './challenges.js';
import { initPreferences, getPreferences, hasCompletedOnboarding } from './preferences.js';

// --- Estado global de la app ---
const state = {
  config: null,
  places: [],        // Todos los lugares (todas las ciudades)
  food: [],           // Guías de comida (solo Barcelona por ahora)
  challenges: null,
  currentCity: localStorage.getItem('guia-current-city') || 'barcelona',
  isReady: false
};

// Exponemos el estado para que otros módulos lo lean
export function getState() {
  return state;
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
    initModules();
    setupRouter();
    setupEventListeners();
    hideLoadingScreen();

    // Si es primer uso, mostrar onboarding; si no, ir al home
    if (!hasCompletedOnboarding()) {
      navigateTo('onboarding');
    } else {
      navigateTo('home');
    }

    state.isReady = true;
  } catch (error) {
    console.error('Error al inicializar la app:', error);
    document.getElementById('loading-screen').innerHTML = `
      <div class="loading-content">
        <span class="loading-emoji">⚠️</span>
        <p class="loading-text">Error al cargar. Recarga la página.</p>
      </div>
    `;
  }
});

// --- Carga de datos ---
async function loadAllData() {
  // Cargar config primero
  state.config = await fetchJSON('./data/config.json');

  // Cargar places de todas las ciudades en paralelo
  const placesPromises = state.config.cities.map(city =>
    fetchJSON(`./data/${city.data_file}`).catch(err => {
      console.warn(`No se pudo cargar ${city.data_file}:`, err);
      return []; // Si falla un archivo, continúa con los demás
    })
  );

  const placesArrays = await Promise.all(placesPromises);
  state.places = placesArrays.flat();

  // Cargar guías de comida (solo las ciudades que tienen)
  const foodPromises = state.config.cities
    .filter(city => city.has_food_guide)
    .map(city =>
      fetchJSON(`./data/food-${city.id}.json`).catch(err => {
        console.warn(`No se pudo cargar food-${city.id}.json:`, err);
        return [];
      })
    );

  const foodArrays = await Promise.all(foodPromises);
  state.food = foodArrays.flat();

  // Cargar retos
  state.challenges = await fetchJSON('./data/challenges.json');
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

// --- Inicializar módulos ---
function initModules() {
  initPreferences(state.config);
  initSearch(state);
  initSpeech();
  initChat(state.config);
  initChallenges(state.challenges);
}

// --- Router hash-based ---
function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
  const hash = window.location.hash || '#/home';
  const [path, param] = parseHash(hash);

  switch (path) {
    case '/onboarding':
      showView('onboarding');
      break;
    case '/home':
      showView('home');
      renderHome();
      break;
    case '/place':
      if (param) {
        showView('place');
        renderPlace(param);
      }
      break;
    case '/food':
      if (param) {
        showView('food');
        renderFoodGuide(param);
      }
      break;
    case '/search':
      showView('search');
      break;
    case '/challenges':
      showView('challenges');
      // Renderizar retos al entrar a la vista
      if (window.__renderChallenges) window.__renderChallenges();
      break;
    case '/chat':
      showView('chat');
      break;
    default:
      showView('home');
      renderHome();
  }
}

function parseHash(hash) {
  // Quitar el # inicial
  const clean = hash.replace('#', '');
  // Buscar estructura tipo /place/sagrada-familia
  const parts = clean.split('/').filter(Boolean);
  const path = '/' + (parts[0] || 'home');
  const param = parts[1] || null;
  return [path, param];
}

export function navigateTo(view, param) {
  if (param) {
    window.location.hash = `#/${view}/${param}`;
  } else {
    window.location.hash = `#/${view}`;
  }
}

function showView(viewName) {
  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(v => v.hidden = true);

  // Mostrar la vista solicitada
  const view = document.querySelector(`[data-view="${viewName}"]`);
  if (view) {
    view.hidden = false;
    // Scroll al inicio
    window.scrollTo(0, 0);
  }

  // Mostrar/ocultar navegación inferior
  const nav = document.getElementById('bottom-nav');
  const showNav = ['home', 'search', 'challenges', 'chat'].includes(viewName);
  nav.hidden = !showNav;
  document.body.classList.toggle('has-nav', showNav);

  // Actualizar tab activo
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isActive = tab.dataset.tab === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

// --- Event Listeners globales ---
function setupEventListeners() {
  // Navegación inferior
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      navigateTo(tab.dataset.tab);
    });
  });

  // Botón de búsqueda en home → ir a vista de búsqueda
  document.getElementById('btn-search-home')?.addEventListener('click', () => {
    navigateTo('search');
    // Auto-focus en el campo de búsqueda
    setTimeout(() => {
      document.getElementById('search-input')?.focus();
    }, 100);
  });

  // Botón de IA en home
  document.getElementById('btn-ai-home')?.addEventListener('click', () => {
    navigateTo('chat');
  });

  // Botones de volver atrás
  document.getElementById('btn-back-place')?.addEventListener('click', () => {
    window.history.back();
  });
  document.getElementById('btn-back-food')?.addEventListener('click', () => {
    window.history.back();
  });
}

// --- Pantalla de carga ---
function hideLoadingScreen() {
  const loading = document.getElementById('loading-screen');
  loading.classList.add('hidden');
  setTimeout(() => loading.remove(), 300);
}

// --- Renderizar HOME ---
export function renderHome() {
  renderCityPills();
  renderDailyChallengePreview();
  renderRecommended();
  renderFoodGuides();
  renderCategories();
}

function renderCityPills() {
  const container = document.getElementById('city-pills');
  container.innerHTML = '';

  state.config.cities.forEach(city => {
    const pill = document.createElement('button');
    pill.className = `city-pill ${city.id === state.currentCity ? 'active' : ''}`;
    pill.textContent = `${city.emoji} ${city.name}`;
    pill.setAttribute('aria-label', `Ver ${city.name}`);
    pill.setAttribute('aria-pressed', city.id === state.currentCity ? 'true' : 'false');

    pill.addEventListener('click', () => {
      state.currentCity = city.id;
      // Guardar preferencia
      localStorage.setItem('guia-current-city', city.id);
      renderHome();
    });

    container.appendChild(pill);
  });
}

function renderDailyChallengePreview() {
  const container = document.getElementById('home-daily-challenge');
  const dailyChallenge = getCurrentDailyChallenge();

  if (!dailyChallenge) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <div class="challenge-emoji" aria-hidden="true">${dailyChallenge.emoji}</div>
    <div class="challenge-title">Reto del día: ${dailyChallenge.title}</div>
    <p class="challenge-text">${dailyChallenge.challenge}</p>
    <button class="btn btn-secondary" onclick="window.location.hash='#/challenges'">
      📷 Ver retos
    </button>
  `;
}

function getCurrentDailyChallenge() {
  if (!state.challenges?.daily?.length) return null;

  const config = state.config;
  const today = new Date();
  const tripStart = new Date(config.trip_start_date + 'T00:00:00');
  const demoMode = config.demo_mode;

  if (demoMode) {
    // En modo demo, mostrar el reto del día 1
    return state.challenges.daily[0];
  }

  // Calcular día del viaje (1-indexed)
  const diffMs = today - tripStart;
  const dayNumber = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  if (dayNumber < 1 || dayNumber > state.challenges.daily.length) return null;
  return state.challenges.daily[dayNumber - 1];
}

function renderRecommended() {
  const container = document.getElementById('recommended-cards');
  const preferences = getPreferences();

  // Filtrar lugares de la ciudad actual
  let cityPlaces = state.places.filter(p => p.city === state.currentCity);

  // Si hay preferencias, priorizar las categorías elegidas
  if (preferences.length > 0) {
    cityPlaces = cityPlaces.sort((a, b) => {
      const aMatch = a.category.some(c => preferences.includes(c)) ? 1 : 0;
      const bMatch = b.category.some(c => preferences.includes(c)) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  // Mostrar máximo 6 tarjetas
  const toShow = cityPlaces.slice(0, 6);

  container.innerHTML = '';
  toShow.forEach(place => {
    container.appendChild(createMiniCard(place));
  });
}

function renderFoodGuides() {
  const section = document.getElementById('home-food-guides');
  const container = document.getElementById('food-guide-cards');

  // Solo mostrar si la ciudad actual tiene guías de comida
  const cityConfig = state.config.cities.find(c => c.id === state.currentCity);
  const cityFood = state.food.filter(f => f.city === state.currentCity);

  if (!cityConfig?.has_food_guide || cityFood.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  container.innerHTML = '';

  cityFood.forEach(food => {
    const card = document.createElement('div');
    card.className = 'place-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Guía: ${food.name}`);

    const emoji = food.category.includes('Postres') ? '🍮' : '🍴';
    card.innerHTML = `
      <div class="place-card-img img-placeholder">${emoji}</div>
      <div class="place-card-info">
        <div class="place-card-name">${food.name}</div>
        <div class="place-card-meta">${food.category.join(' · ')}</div>
      </div>
    `;

    card.addEventListener('click', () => navigateTo('food', food.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') navigateTo('food', food.id);
    });

    container.appendChild(card);
  });
}

function renderCategories() {
  const container = document.getElementById('category-list');
  const cityPlaces = state.places.filter(p => p.city === state.currentCity);

  // Contar lugares por categoría
  const categoryCounts = {};
  cityPlaces.forEach(place => {
    place.category.forEach(cat => {
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  });

  // Renderizar solo categorías con al menos 1 lugar
  container.innerHTML = '';
  state.config.categories.forEach(cat => {
    const count = categoryCounts[cat.id] || 0;
    if (count === 0) return;

    const row = document.createElement('div');
    row.className = 'category-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `${cat.label}: ${count} lugares`);

    row.innerHTML = `
      <span class="category-emoji" aria-hidden="true">${cat.emoji}</span>
      <span class="category-name">${cat.label}</span>
      <span class="category-count">${count}</span>
    `;

    row.addEventListener('click', () => {
      // Navegar a búsqueda con la categoría como filtro
      navigateTo('search');
      setTimeout(() => {
        const input = document.getElementById('search-input');
        if (input) {
          input.value = cat.label;
          input.dispatchEvent(new Event('input'));
        }
      }, 100);
    });

    row.addEventListener('keydown', e => {
      if (e.key === 'Enter') row.click();
    });

    container.appendChild(row);
  });
}

// --- Crear tarjeta mini (para scroll horizontal) ---
function createMiniCard(place) {
  const card = document.createElement('div');
  card.className = 'place-card-mini';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', place.name);

  const priceText = place.price === 'Gratis'
    ? '<span class="place-price-free">Gratis</span>'
    : `<span class="place-price">${place.price}</span>`;

  card.innerHTML = `
    <img
      class="place-card-mini-img"
      src="${place.photo}"
      alt="${place.name}"
      loading="lazy"
      onerror="this.outerHTML='<div class=\\'place-card-mini-img img-placeholder\\'>🏛️</div>'"
    >
    <div class="place-card-mini-body">
      <div class="place-card-mini-name">${place.name}</div>
      <div class="place-card-mini-meta">${priceText}</div>
    </div>
  `;

  card.addEventListener('click', () => navigateTo('place', place.id));
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigateTo('place', place.id);
  });

  return card;
}

// --- Renderizar FICHA DE LUGAR ---
function renderPlace(placeId) {
  const container = document.getElementById('place-content');
  const place = state.places.find(p => p.id === placeId);

  if (!place) {
    container.innerHTML = '<p>Lugar no encontrado.</p>';
    return;
  }

  // Detectar si es la ficha especial de Florencia
  const isSpecialItinerary = place.type === 'special_itinerary';
  // Detectar si es un day trip
  const isDayTrip = place.type === 'day_trip';

  let html = '';

  // Foto principal
  html += `
    <img
      class="place-photo"
      src="${place.photo}"
      alt="${place.name}"
      onerror="this.outerHTML='<div class=\\'place-photo img-placeholder\\'>📷</div>'"
    >
  `;

  // Título y meta
  html += `<h1 class="place-title">${place.name}</h1>`;
  html += '<div class="place-meta">';
  if (place.price) {
    const isFree = place.price.toLowerCase() === 'gratis';
    html += isFree
      ? '<span class="place-price-free">Gratis</span>'
      : `<span class="place-price">${place.price}</span>`;
  }
  place.category.forEach(cat => {
    html += `<span class="place-category-tag">${cat}</span>`;
  });
  html += '</div>';

  // Resumen
  html += `<p class="place-summary">${place.summary}</p>`;

  // Botón de escuchar
  if (place.speech_text) {
    html += `
      <button class="btn btn-sea btn-listen" id="btn-listen" data-speech-text="${escapeAttr(place.speech_text)}">
        ▶ Escuchar
      </button>
    `;
  }

  // Logística (para day trips)
  if (isDayTrip && place.sections?.how_to_get) {
    html += `<div class="place-logistics"><strong>🚂 Cómo llegar:</strong><br>${place.sections.how_to_get}</div>`;
  }

  // Secciones expandibles (acordeones)
  html += '<div class="accordion">';

  if (isSpecialItinerary) {
    // Florencia: secciones especiales
    const specialSections = [
      { key: 'logistics', title: '🚂 Cómo llegar' },
      { key: 'day_1', title: '📅 Día 1' },
      { key: 'day_2', title: '📅 Día 2' },
      { key: 'advance_booking', title: '🎫 Reservar con anticipación' },
      { key: 'fun_facts', title: '💡 Datos curiosos' }
    ];
    specialSections.forEach(sec => {
      if (place.sections?.[sec.key]) {
        html += createAccordionItem(sec.title, place.sections[sec.key]);
      }
    });
  } else {
    // Fichas normales
    const normalSections = [
      { key: 'history', title: '📜 Historia' },
      { key: 'context', title: '🎨 Contexto' },
      { key: 'what_to_see', title: '👀 Qué ver aquí' },
      { key: 'fun_facts', title: '💡 Datos curiosos' }
    ];
    normalSections.forEach(sec => {
      if (place.sections?.[sec.key]) {
        html += createAccordionItem(sec.title, place.sections[sec.key]);
      }
    });
  }
  html += '</div>';

  // Galería
  if (place.gallery?.length > 0) {
    html += `
      <div class="place-gallery">
        <h2 class="section-title">📷 Galería</h2>
        <div class="gallery-scroll">
          ${place.gallery.map(img => `
            <img
              class="gallery-img"
              src="${img}"
              alt="Foto de ${place.name}"
              loading="lazy"
              onerror="this.style.display='none'"
            >
          `).join('')}
        </div>
      </div>
    `;
  }

  // Comida cerca
  if (place.food_nearby?.length > 0) {
    html += `
      <div class="place-food-section">
        <h2 class="section-title">🍴 Dónde comer cerca</h2>
        ${place.food_nearby.map(food => `
          <div class="food-item">
            <div class="food-item-name">${food.name}</div>
            <div class="food-item-meta">${food.type} · ${food.distance} · ${food.price_range}</div>
            ${food.highlight ? `<div class="food-item-highlight">"${food.highlight}"</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Botones de acción
  html += '<div class="place-actions">';
  if (place.maps_url) {
    html += `
      <a href="${place.maps_url}" target="_blank" rel="noopener" class="btn btn-primary btn-large">
        📍 Cómo llegar
      </a>
    `;
  }
  if (place.video_url) {
    html += `
      <a href="${place.video_url}" target="_blank" rel="noopener" class="btn btn-secondary btn-large">
        🎬 Ver video
      </a>
    `;
  }
  html += '</div>';

  // Tips / advertencias
  if (place.tips) {
    html += `<div class="place-tips">${place.tips}</div>`;
  }

  container.innerHTML = html;

  // Conectar eventos de acordeones
  container.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      item.classList.toggle('open');
    });
  });
}

function createAccordionItem(title, content) {
  return `
    <div class="accordion-item">
      <button class="accordion-header" aria-expanded="false">
        ${title}
        <svg class="accordion-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div class="accordion-body">${content}</div>
    </div>
  `;
}

// --- Renderizar GUÍA DE COMIDA ---
function renderFoodGuide(foodId) {
  const container = document.getElementById('food-content');
  const food = state.food.find(f => f.id === foodId);

  if (!food) {
    container.innerHTML = '<p>Guía no encontrada.</p>';
    return;
  }

  let html = `
    <h1 class="place-title">${food.name}</h1>
    <div class="place-meta">
      ${food.category.map(c => `<span class="place-category-tag">${c}</span>`).join('')}
    </div>
    <p class="food-description">${food.description}</p>
  `;

  // Botón de escuchar
  if (food.speech_text) {
    html += `
      <button class="btn btn-sea btn-listen" id="btn-listen" data-speech-text="${escapeAttr(food.speech_text)}">
        ▶ Escuchar
      </button>
    `;
  }

  // Dónde probarlo
  if (food.where_to_try?.length > 0) {
    html += `
      <div class="food-where-section">
        <h2 class="section-title">📍 Dónde probarlo</h2>
        ${food.where_to_try.map(place => `
          <div class="food-where-item">
            <div class="food-where-name">${place.name}</div>
            <div class="food-where-location">${place.location}</div>
            <div class="food-where-why">${place.why}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Dato curioso
  if (food.fun_fact) {
    html += `<div class="food-fun-fact">${food.fun_fact}</div>`;
  }

  container.innerHTML = html;
}

// --- Utilidades ---
function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Registrar Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.warn('Service Worker no se pudo registrar:', err));
  });
}
