/**
 * search.js — Motor de búsqueda offline
 * 
 * Busca en places y food por nombre, categoría y tags.
 * Búsqueda fuzzy básica (tolera errores menores de escritura).
 * Resultados en tiempo real mientras el usuario escribe.
 */

import { navigateTo } from './app.js';

let appState = null;

/**
 * Inicializa el módulo de búsqueda con el estado de la app.
 */
export function initSearch(state) {
  appState = state;
  setupSearchListeners();
}

function setupSearchListeners() {
  const input = document.getElementById('search-input');
  const btnClear = document.getElementById('btn-clear-search');

  if (!input) return;

  // Buscar mientras el usuario escribe (con debounce)
  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim();
      renderResults(query);

      // Mostrar/ocultar botón de limpiar
      if (btnClear) {
        btnClear.hidden = query.length === 0;
      }
    }, 200); // 200ms de debounce
  });

  // Botón de limpiar
  btnClear?.addEventListener('click', () => {
    input.value = '';
    btnClear.hidden = true;
    renderResults('');
    input.focus();
  });
}

/**
 * Ejecuta la búsqueda y renderiza resultados.
 */
function renderResults(query) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (!query || query.length < 2) {
    container.innerHTML = '<p class="search-hint">Escribe para buscar entre todos los lugares y guías de comida.</p>';
    return;
  }

  const results = search(query);

  if (results.length === 0) {
    container.innerHTML = `<p class="search-no-results">No se encontraron resultados para "${query}".</p>`;
    return;
  }

  container.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'cards-list';

  results.forEach(result => {
    const card = document.createElement('div');
    card.className = 'place-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    const isFood = result.type === 'food_guide';
    const emoji = isFood ? '🍴' : '🏛️';
    const cityLabel = getCityLabel(result.city);

    card.innerHTML = `
      <div class="place-card-img img-placeholder">${emoji}</div>
      <div class="place-card-info">
        <div class="place-card-name">${result.name}</div>
        <div class="place-card-meta">${cityLabel} · ${result.category.join(', ')}</div>
      </div>
    `;

    const viewType = isFood ? 'food' : 'place';
    card.addEventListener('click', () => navigateTo(viewType, result.id));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') navigateTo(viewType, result.id);
    });

    list.appendChild(card);
  });

  container.appendChild(list);
}

/**
 * Busca en todos los datos (places + food).
 * Retorna un array ordenado por relevancia.
 */
function search(query) {
  const normalizedQuery = normalize(query);
  const results = [];

  // Buscar en places
  appState.places.forEach(place => {
    const score = calculateScore(place, normalizedQuery);
    if (score > 0) {
      results.push({ ...place, _score: score });
    }
  });

  // Buscar en food
  appState.food.forEach(food => {
    const score = calculateScore(food, normalizedQuery);
    if (score > 0) {
      results.push({ ...food, _score: score });
    }
  });

  // Ordenar por relevancia (score más alto primero)
  results.sort((a, b) => b._score - a._score);

  return results;
}

/**
 * Calcula un score de relevancia para un item dado un query.
 */
function calculateScore(item, query) {
  let score = 0;

  // Coincidencia exacta en nombre (prioridad máxima)
  const normalizedName = normalize(item.name);
  if (normalizedName.includes(query)) {
    score += 100;
    // Bonus si empieza con el query
    if (normalizedName.startsWith(query)) score += 50;
  }

  // Coincidencia en categorías
  if (item.category) {
    item.category.forEach(cat => {
      if (normalize(cat).includes(query)) score += 60;
    });
  }

  // Coincidencia en tags
  if (item.tags) {
    item.tags.forEach(tag => {
      if (normalize(tag).includes(query)) score += 40;
    });
  }

  // Coincidencia fuzzy en nombre (tolerar errores menores)
  if (score === 0 && query.length >= 3) {
    if (fuzzyMatch(normalizedName, query)) {
      score += 20;
    }
  }

  // Coincidencia en resumen/descripción (prioridad baja)
  const text = normalize(item.summary || item.description || '');
  if (text.includes(query)) {
    score += 10;
  }

  return score;
}

/**
 * Búsqueda fuzzy simple: verifica si al menos el 70% de los caracteres
 * del query están en la misma secuencia dentro del target.
 */
function fuzzyMatch(target, query) {
  if (query.length < 3) return false;

  let matchCount = 0;
  let targetIndex = 0;

  for (let i = 0; i < query.length; i++) {
    const char = query[i];
    const found = target.indexOf(char, targetIndex);
    if (found !== -1) {
      matchCount++;
      targetIndex = found + 1;
    }
  }

  return matchCount / query.length >= 0.7;
}

/**
 * Normaliza texto para búsqueda: minúsculas, sin acentos.
 */
function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .trim();
}

/**
 * Obtiene el nombre legible de la ciudad.
 */
function getCityLabel(cityId) {
  const labels = {
    barcelona: '🇪🇸 Barcelona',
    roma: '🇮🇹 Roma',
    florencia: '🇮🇹 Florencia',
    paris: '🇫🇷 París'
  };
  return labels[cityId] || cityId;
}
