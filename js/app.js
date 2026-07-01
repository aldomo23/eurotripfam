/**
 * app.js — Lógica principal de la Guía Europa 2026
 *
 * Responsabilidades:
 * - Cargar datos (config, places, food, challenges)
 * - Router hash-based (SPA)
 * - Renderizar vistas (home, place, food, categorías)
 * - Gestionar selector de ciudad
 *
 * Clases CSS: alineadas con styles.css v2.0 (Chat 3)
 */

import { initSearch } from './search.js';
import { initSpeech } from './speech.js';
import { initChat } from './ai-chat.js';
import { initChallenges } from './challenges.js';
import { initPreferences, getPreferences, hasCompletedOnboarding } from './preferences.js';

// --- Estado global de la app ---
const state = {
  config: null,
  places: [],      // Todas las fichas (todas las ciudades)
  food: [],        // Guías de comida (Barcelona por ahora)
  challenges: null,
  currentCity: localStorage.getItem('guia-current-city') || 'barcelona',
  isReady: false
};

export function getState() { return state; }

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAllData();
    initModules();
    setupRouter();
    setupEventListeners();
    hideLoadingScreen();

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
  state.config = await fetchJSON('./data/config.json');

  // Validar que la ciudad guardada exista en config
  const validCities = state.config.cities.map(c => c.id);
  if (!validCities.includes(state.currentCity)) {
    state.currentCity = state.config.cities[0].id;
  }

  const placesPromises = state.config.cities.map(city =>
    fetchJSON(`./data/${city.data_file}`).catch(err => {
      console.warn(`No se pudo cargar ${city.data_file}:`, err);
      return [];
    })
  );
  const placesArrays = await Promise.all(placesPromises);
  state.places = placesArrays.flat();

  const foodPromises = state.config.cities
    .filter(city => city.has_food_guide)
    .map(city =>
      fetchJSON(`./data/food-${city.id}.json`).catch(() => [])
    );
  const foodArrays = await Promise.all(foodPromises);
  state.food = foodArrays.flat();

  state.challenges = await fetchJSON('./data/challenges.json');
}

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

// --- Módulos ---
function initModules() {
  initPreferences(state.config);
  initSearch(state);
  initSpeech();
  initChat(state.config);
  initChallenges(state.challenges);
}

// --- Router ---
function setupRouter() {
  window.addEventListener('hashchange', handleRoute);
}

function handleRoute() {
  const hash = window.location.hash || '#/home';
  const [path, param] = parseHash(hash);

  switch (path) {
    case '/onboarding': showView('onboarding'); break;
    case '/home':
      showView('home');
      renderHome();
      break;
    case '/place':
      if (param) { showView('place'); renderPlace(param); }
      break;
    case '/food':
      if (param) { showView('food'); renderFoodGuide(param); }
      break;
    case '/search': showView('search'); break;
    case '/challenges':
      showView('challenges');
      if (window.__renderChallenges) window.__renderChallenges();
      break;
    case '/chat': showView('chat'); break;
    default:
      showView('home');
      renderHome();
  }
}

function parseHash(hash) {
  const clean = hash.replace('#', '');
  const parts = clean.split('/').filter(Boolean);
  return ['/' + (parts[0] || 'home'), parts[1] || null];
}

export function navigateTo(view, param) {
  if (param) {
    window.location.hash = `#/${view}/${param}`;
  } else {
    window.location.hash = `#/${view}`;
  }
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.hidden = true);
  const view = document.querySelector(`[data-view="${viewName}"]`);
  if (view) { view.hidden = false; window.scrollTo(0, 0); }

  const nav = document.getElementById('bottom-nav');
  const showNav = ['home', 'search', 'challenges', 'chat'].includes(viewName);
  nav.hidden = !showNav;
  document.body.classList.toggle('has-nav', showNav);

  document.querySelectorAll('.nav-tab').forEach(tab => {
    const isActive = tab.dataset.tab === viewName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

// --- Listeners globales ---
function setupEventListeners() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigateTo(tab.dataset.tab));
  });

  document.getElementById('btn-search-home')?.addEventListener('click', () => {
    navigateTo('search');
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  });

  document.getElementById('btn-ai-home')?.addEventListener('click', () => navigateTo('chat'));
  document.getElementById('btn-back-place')?.addEventListener('click', () => window.history.back());
  document.getElementById('btn-back-food')?.addEventListener('click', () => window.history.back());
}

function hideLoadingScreen() {
  const loading = document.getElementById('loading-screen');
  // El CSS oculta con [hidden] attribute (no con clase .hidden)
  setTimeout(() => loading.setAttribute('hidden', ''), 200);
}

// ============================================================
// HOME
// ============================================================
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
    pill.className = `city-pill${city.id === state.currentCity ? ' active' : ''}`;
    pill.textContent = `${city.emoji} ${city.name}`;
    pill.setAttribute('aria-pressed', city.id === state.currentCity ? 'true' : 'false');

    pill.addEventListener('click', () => {
      state.currentCity = city.id;
      localStorage.setItem('guia-current-city', city.id);
      renderHome();
    });
    container.appendChild(pill);
  });
}

function renderDailyChallengePreview() {
  const container = document.getElementById('home-daily-challenge');
  const challenge = getCurrentDailyChallenge();
  if (!challenge) { container.hidden = true; return; }

  container.hidden = false;
  // card-challenge ya tiene los estilos en CSS (fondo ink, texto blanco)
  container.innerHTML = `
    <div style="font-size:24px;margin-bottom:6px;" aria-hidden="true">${challenge.emoji}</div>
    <div style="font-family:var(--serif);font-size:17px;font-weight:600;color:white;margin-bottom:4px;">
      Reto del día: ${challenge.title}
    </div>
    <p style="font-size:15px;color:rgba(255,255,255,0.8);margin-bottom:14px;">${challenge.challenge}</p>
    <button class="btn btn-secondary" onclick="window.location.hash='#/challenges'" style="background:rgba(255,255,255,0.15);color:white;border:1.5px solid rgba(255,255,255,0.25);">
      📷 Ver retos
    </button>
  `;
}

function getCurrentDailyChallenge() {
  if (!state.challenges?.daily?.length) return null;
  const demoMode = state.config?.demo_mode;
  if (demoMode) return state.challenges.daily[0];

  const tripStart = new Date(state.config.trip_start_date + 'T00:00:00');
  const dayNumber = Math.floor((new Date() - tripStart) / 86400000) + 1;
  if (dayNumber < 1 || dayNumber > state.challenges.daily.length) return null;
  return state.challenges.daily[dayNumber - 1];
}

function renderRecommended() {
  const container = document.getElementById('recommended-cards');
  const preferences = getPreferences();

  // Excluir day_trips de recomendados (tienen su categoría "Escapada")
  // NO excluir special_itinerary: Florencia solo tiene una ficha con ese type
  const cityPlaces = state.places.filter(p =>
    p.city === state.currentCity && p.type !== 'day_trip'
  );

  let toShow = [];

  if (preferences.length > 0) {
    // Primero: lugares que coinciden con las preferencias del usuario
    const matched = cityPlaces.filter(p =>
      p.category.some(c => preferences.includes(c))
    );
    toShow = matched;

    // Si hay menos de 6 coincidencias, rellenar con los demás
    if (toShow.length < 6) {
      const rest = cityPlaces.filter(p => !matched.includes(p));
      toShow = [...toShow, ...rest];
    }
  } else {
    // Sin preferencias: mostrar todos en orden original
    toShow = cityPlaces;
  }

  container.innerHTML = '';
  toShow.slice(0, 6).forEach(place => {
    container.appendChild(createPlaceCard(place));
  });
}

function renderFoodGuides() {
  const section = document.getElementById('home-food-guides');
  const container = document.getElementById('food-guide-cards');
  const cityConfig = state.config.cities.find(c => c.id === state.currentCity);
  const cityFood = state.food.filter(f => f.city === state.currentCity);

  if (!cityConfig?.has_food_guide || cityFood.length === 0) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  container.innerHTML = '';

  cityFood.forEach(food => {
    const emoji = food.category?.includes('Postres') ? '🍮' : food.category?.includes('Vida local') ? '🍷' : '🍴';
    const card = document.createElement('div');
    card.className = 'food-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.innerHTML = `
      <div class="food-card-emoji">${emoji}</div>
      <div>
        <div class="food-card-name">${food.name}</div>
        <div class="food-card-desc">${food.summary || ''}</div>
      </div>
    `;
    card.addEventListener('click', () => navigateTo('food', food.id));
    card.addEventListener('keydown', e => { if (e.key === 'Enter') navigateTo('food', food.id); });
    container.appendChild(card);
  });
}

function renderCategories() {
  const container = document.getElementById('category-list');

  // Incluir todos los places de la ciudad (normales + day_trips)
  const cityPlaces = state.places.filter(p => p.city === state.currentCity);

  const counts = {};
  cityPlaces.forEach(place => {
    place.category.forEach(cat => {
      counts[cat] = (counts[cat] || 0) + 1;
    });
  });

  container.innerHTML = '';
  state.config.categories.forEach(cat => {
    const count = counts[cat.id] || 0;
    if (count === 0) return;

    const row = document.createElement('div');
    // CSS usa .category-item / .category-item-left / .category-icon / .category-name / .category-count
    row.className = 'category-item';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `${cat.label}: ${count} lugares`);
    row.innerHTML = `
      <div class="category-item-left">
        <div class="category-icon" aria-hidden="true">${cat.emoji}</div>
        <span class="category-name">${cat.label}</span>
      </div>
      <span class="category-count">${count}</span>
    `;
    row.addEventListener('click', () => {
      navigateTo('search');
      setTimeout(() => {
        const input = document.getElementById('search-input');
        if (input) { input.value = cat.label; input.dispatchEvent(new Event('input')); }
      }, 100);
    });
    row.addEventListener('keydown', e => { if (e.key === 'Enter') row.click(); });
    container.appendChild(row);
  });
}

// Tarjeta de lugar (scroll horizontal en home) — usa .place-card del CSS
function createPlaceCard(place) {
  const card = document.createElement('div');
  card.className = 'place-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', place.name);

  const isFree = place.price?.toLowerCase() === 'gratis';
  const priceHtml = place.price
    ? `<span class="${isFree ? 'place-card-free' : 'place-card-price'}">${isFree ? 'Gratis' : place.price}</span>`
    : '';

  card.innerHTML = `
    <div class="place-card-img" role="img" aria-label="${place.name}">
      ${place.photo
        ? `<img src="${place.photo}" alt="${place.name}" loading="lazy" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='🏛️'">`
        : '🏛️'}
    </div>
    <div class="place-card-body">
      <div class="place-card-name">${place.name}</div>
      <div class="place-card-meta">${priceHtml}</div>
    </div>
  `;

  card.addEventListener('click', () => navigateTo('place', place.id));
  card.addEventListener('keydown', e => { if (e.key === 'Enter') navigateTo('place', place.id); });
  return card;
}

// ============================================================
// FICHA DE LUGAR
// ============================================================
function renderPlace(placeId) {
  const container = document.getElementById('place-content');
  const place = state.places.find(p => p.id === placeId);
  if (!place) { container.innerHTML = '<p style="padding:22px">Lugar no encontrado.</p>'; return; }

  const isSpecialItinerary = place.type === 'special_itinerary';
  const isDayTrip = place.type === 'day_trip';

  let html = '';

  // --- Hero image (.place-hero del CSS) ---
  if (place.photo) {
    html += `<img class="place-hero" src="${place.photo}" alt="${place.name}" onerror="this.style.display='none'">`;
  } else {
    html += `<div class="place-hero" role="img" aria-label="${place.name}" style="display:flex;align-items:center;justify-content:center;font-size:48px;">🏛️</div>`;
  }

  // --- Pills de categoría (.place-categories / .pill / .pill-terra) ---
  if (place.category?.length) {
    html += '<div class="place-categories">';
    place.category.forEach(cat => {
      html += `<span class="pill pill-terra">${cat}</span>`;
    });
    html += '</div>';
  }

  // --- Nombre (.place-name del CSS) ---
  html += `<h1 class="place-name">${place.name}</h1>`;

  // --- Meta: precio (.place-meta / .place-price / .place-price.free) ---
  const isFree = place.price?.toLowerCase() === 'gratis';
  html += `<div class="place-meta">`;
  if (place.price) {
    html += `<span class="place-price${isFree ? ' free' : ''}">${place.price}</span>`;
  }
  // Para day_trips: mostrar estimated_time y effort_level
  if (isDayTrip) {
    if (place.estimated_time) html += `<span class="place-rating">⏱ ${place.estimated_time}</span>`;
    if (place.effort_level) html += `<span class="place-rating">🥾 ${place.effort_level}</span>`;
  }
  html += `</div>`;

  // --- Resumen (.place-summary) ---
  html += `<p class="place-summary">${place.summary}</p>`;

  // --- Botón Escuchar (.btn-listen / .btn-listen-icon) ---
  if (place.speech_text) {
    html += `
      <button class="btn-listen" id="btn-listen" data-speech-text="${escapeAttr(place.speech_text)}">
        <div class="btn-listen-icon">▶</div>
        Escuchar descripción
      </button>
    `;
  }

  // --- Cómo llegar para day_trips (info destacada, como tip-box en teal) ---
  if (isDayTrip && place.how_to_get) {
    html += `
      <div class="tip-box" style="border-left-color:var(--sea);background:rgba(43,116,108,0.07);">
        <div class="tip-label" style="color:var(--sea);">🚂 Cómo llegar</div>
        <div class="tip-text">${place.how_to_get}</div>
      </div>
    `;
  }

  // --- Tips / avisos (.tip-box) ---
  if (place.tips) {
    html += `
      <div class="tip-box">
        <div class="tip-label">⚠️ Antes de ir</div>
        <div class="tip-text">${place.tips}</div>
      </div>
    `;
  }

  // --- Secciones acordeón ---
  html += '<div class="accordion">';

  if (isSpecialItinerary) {
    // Florencia: secciones especiales
    const florSections = [
      { key: 'logistics',       title: '🚂 Cómo llegar', icon: '🚂' },
      { key: 'day_1',           title: '📅 Día 1',        icon: '📅' },
      { key: 'day_2',           title: '📅 Día 2',        icon: '📅' },
      { key: 'advance_booking', title: '🎫 Reservas',     icon: '🎫' },
      { key: 'fun_facts',       title: '💡 Datos curiosos', icon: '💡' }
    ];
    florSections.forEach(sec => {
      if (place.sections?.[sec.key]) html += createAccordion(sec.icon, sec.title, place.sections[sec.key]);
    });
  } else {
    // Fichas normales (incluyendo day_trips — mismas secciones)
    const normalSections = [
      { key: 'history',    title: 'Historia',       icon: '📜' },
      { key: 'context',    title: 'Contexto',       icon: '🎨' },
      { key: 'what_to_see', title: 'Qué ver aquí', icon: '👀' },
      { key: 'fun_facts',  title: 'Datos curiosos', icon: '💡' }
    ];
    normalSections.forEach(sec => {
      if (place.sections?.[sec.key]) html += createAccordion(sec.icon, sec.title, place.sections[sec.key]);
    });
  }
  html += '</div>'; // .accordion

  // --- Galería (.place-gallery) ---
  if (place.gallery?.length > 0) {
    html += `
      <div style="margin:18px 0 4px;">
        <div style="font-family:var(--serif);font-size:18px;font-weight:600;margin-bottom:8px;">📷 Galería</div>
        <div class="place-gallery">
          ${place.gallery.map(img => `<img src="${img}" alt="Foto de ${place.name}" loading="lazy" onerror="this.remove()">`).join('')}
        </div>
      </div>
    `;
  }

  // --- Comida cerca (.food-nearby-title / .food-nearby-item / ...) ---
  if (place.food_nearby?.length > 0) {
    html += `<div class="food-nearby-title">🍴 Dónde comer cerca</div>`;
    place.food_nearby.forEach(food => {
      html += `
        <div class="food-nearby-item">
          <div class="food-nearby-icon">🍽️</div>
          <div>
            <div class="food-nearby-name">${food.name}</div>
            <div class="food-nearby-detail">${food.type || ''} · ${food.distance || ''} · ${food.price_range || ''}</div>
            ${food.highlight ? `<div class="food-nearby-detail" style="margin-top:2px;font-style:italic;">"${food.highlight}"</div>` : ''}
          </div>
        </div>
      `;
    });
  }

  // --- Botón de Maps (.btn-maps) ---
  if (place.maps_url) {
    html += `
      <a href="${place.maps_url}" target="_blank" rel="noopener" class="btn-maps">
        📍 Cómo llegar — Google Maps
      </a>
    `;
  }

  // --- Video ---
  if (place.video_url) {
    html += `
      <a href="${place.video_url}" target="_blank" rel="noopener" class="btn btn-secondary" style="width:100%;margin-top:8px;text-decoration:none;">
        🎬 Ver video
      </a>
    `;
  }

  container.innerHTML = html;

  // Conectar acordeones
  container.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const chevron = header.querySelector('.accordion-chevron');
      const body = header.nextElementSibling;
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      if (chevron) chevron.classList.toggle('open', !isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

// Acordeón — usa clases del CSS: .accordion-header / .accordion-title / .accordion-icon
// .accordion-chevron / .accordion-body / .accordion-body.open / .accordion-text
function createAccordion(icon, title, content) {
  return `
    <div>
      <button class="accordion-header" aria-expanded="false">
        <div class="accordion-title">
          <span class="accordion-icon" aria-hidden="true">${icon}</span>
          ${title}
        </div>
        <span class="accordion-chevron" aria-hidden="true">›</span>
      </button>
      <div class="accordion-body">
        <p class="accordion-text">${content}</p>
      </div>
    </div>
  `;
}

// ============================================================
// GUÍA DE COMIDA (detalle)
// ============================================================
function renderFoodGuide(foodId) {
  const container = document.getElementById('food-content');
  const food = state.food.find(f => f.id === foodId);
  if (!food) { container.innerHTML = '<p style="padding:22px">Guía no encontrada.</p>'; return; }

  const emoji = food.category?.includes('Postres') ? '🍮' : food.category?.includes('Vida local') ? '🍷' : '🍴';

  let html = `
    <div style="font-size:56px;text-align:center;margin:16px 0 4px;">${emoji}</div>
    <div class="place-categories">
      ${(food.category || []).map(c => `<span class="pill pill-terra">${c}</span>`).join('')}
    </div>
    <h1 class="place-name">${food.name}</h1>
    <p class="place-summary">${food.description || ''}</p>
  `;

  // Escuchar
  if (food.speech_text) {
    html += `
      <button class="btn-listen" id="btn-listen" data-speech-text="${escapeAttr(food.speech_text)}">
        <div class="btn-listen-icon">▶</div>
        Escuchar descripción
      </button>
    `;
  }

  // Temporada (campo extra que tienen los food JSONs)
  if (food.season) {
    html += `
      <div class="tip-box" style="border-left-color:var(--sea);background:rgba(43,116,108,0.07);">
        <div class="tip-label" style="color:var(--sea);">📅 Temporada</div>
        <div class="tip-text">${food.season}</div>
      </div>
    `;
  }

  // Dónde probarlo (.food-nearby-*)
  if (food.where_to_try?.length > 0) {
    html += `<div class="food-nearby-title">📍 Dónde probarlo</div>`;
    food.where_to_try.forEach(place => {
      html += `
        <div class="food-nearby-item">
          <div class="food-nearby-icon">🍽️</div>
          <div>
            <div class="food-nearby-name">${place.name}</div>
            <div class="food-nearby-detail">${place.type || ''} · ${place.address || place.location || ''} · ${place.price_range || ''}</div>
            ${place.highlight ? `<div class="food-nearby-detail" style="margin-top:2px;font-style:italic;">"${place.highlight}"</div>` : ''}
          </div>
        </div>
      `;
    });
  }

  // Dato curioso (.tip-box con gold)
  if (food.fun_fact) {
    html += `
      <div class="tip-box">
        <div class="tip-label">💡 Dato curioso</div>
        <div class="tip-text">${food.fun_fact}</div>
      </div>
    `;
  }

  // Video
  if (food.video_url) {
    html += `
      <a href="${food.video_url}" target="_blank" rel="noopener" class="btn btn-secondary" style="width:100%;margin-top:16px;text-decoration:none;">
        🎬 Ver video
      </a>
    `;
  }

  container.innerHTML = html;
}

// ============================================================
// Utilidades
// ============================================================
function escapeAttr(str) {
  return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.warn('SW error:', err));
  });
}
