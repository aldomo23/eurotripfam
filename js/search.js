/**
 * search.js — Motor de búsqueda offline
 *
 * Clases CSS alineadas con styles.css v2.0:
 * - .search-result-item / .search-result-name / .search-result-meta
 */

import { navigateTo } from './app.js';

let appState = null;

export function initSearch(state) {
  appState = state;
  setupSearchListeners();
}

function setupSearchListeners() {
  const input = document.getElementById('search-input');
  const btnClear = document.getElementById('btn-clear-search');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim();
      renderResults(query);
      if (btnClear) btnClear.hidden = query.length === 0;
    }, 200);
  });

  btnClear?.addEventListener('click', () => {
    input.value = '';
    btnClear.hidden = true;
    renderResults('');
    input.focus();
  });
}

function renderResults(query) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (!query || query.length < 2) {
    container.innerHTML = '<p class="search-hint">Escribe para buscar entre todos los lugares y guías de comida.</p>';
    return;
  }

  const results = search(query);

  if (results.length === 0) {
    container.innerHTML = `<p class="search-hint">No se encontraron resultados para "${query}".</p>`;
    return;
  }

  container.innerHTML = '';
  results.forEach(result => {
    const isFood = result.type === 'food_guide';
    const isDayTrip = result.type === 'day_trip';
    const emoji = isFood ? '🍴' : isDayTrip ? '🚂' : '🏛️';
    const cityLabel = getCityLabel(result.city);

    // CSS: .search-result-item / .search-result-name / .search-result-meta
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.innerHTML = `
      <div style="font-size:24px;flex-shrink:0;" aria-hidden="true">${emoji}</div>
      <div>
        <div class="search-result-name">${result.name}</div>
        <div class="search-result-meta">${cityLabel} · ${(result.category || []).join(', ')}</div>
      </div>
    `;

    const viewType = isFood ? 'food' : 'place';
    item.addEventListener('click', () => navigateTo(viewType, result.id));
    item.addEventListener('keydown', e => { if (e.key === 'Enter') navigateTo(viewType, result.id); });
    container.appendChild(item);
  });
}

function search(query) {
  const q = normalize(query);
  const results = [];

  [...appState.places, ...appState.food].forEach(item => {
    const score = calculateScore(item, q);
    if (score > 0) results.push({ ...item, _score: score });
  });

  return results.sort((a, b) => b._score - a._score);
}

function calculateScore(item, query) {
  let score = 0;
  const name = normalize(item.name || '');

  if (name.includes(query)) {
    score += 100;
    if (name.startsWith(query)) score += 50;
  }

  (item.category || []).forEach(cat => {
    if (normalize(cat).includes(query)) score += 60;
  });

  (item.tags || []).forEach(tag => {
    if (normalize(tag).includes(query)) score += 40;
  });

  if (score === 0 && query.length >= 3 && fuzzyMatch(name, query)) {
    score += 20;
  }

  const text = normalize(item.summary || item.description || '');
  if (text.includes(query)) score += 10;

  return score;
}

function fuzzyMatch(target, query) {
  if (query.length < 3) return false;
  let matchCount = 0, targetIdx = 0;
  for (const char of query) {
    const found = target.indexOf(char, targetIdx);
    if (found !== -1) { matchCount++; targetIdx = found + 1; }
  }
  return matchCount / query.length >= 0.7;
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getCityLabel(cityId) {
  const labels = { barcelona: '🇪🇸 Barcelona', roma: '🇮🇹 Roma', florencia: '🇮🇹 Florencia', paris: '🇫🇷 París' };
  return labels[cityId] || cityId;
}
