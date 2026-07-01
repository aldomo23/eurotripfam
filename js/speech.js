/**
 * speech.js — Text-to-speech (lectura en voz alta)
 * 
 * Usa la API nativa speechSynthesis del navegador.
 * Funciona offline (usa las voces instaladas en el teléfono).
 * No consume datos ni tokens.
 */

let isPlaying = false;

/**
 * Inicializa el módulo de speech.
 * Conecta el evento de click en botones "Escuchar" (delegación de eventos).
 */
export function initSpeech() {
  // Delegación de eventos: escuchar clicks en cualquier botón con id="btn-listen"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btn-listen');
    if (!btn) return;

    const text = btn.dataset.speechText;
    if (!text) return;

    // Si speechSynthesis fue cancelado externamente (ej. al navegar),
    // re-sincronizar el flag antes de decidir
    if (isPlaying && !window.speechSynthesis.speaking) {
      isPlaying = false;
    }

    if (isPlaying) {
      stop();
      updateButtonState(btn, false);
    } else {
      speak(text, btn);
    }
  });
}

/**
 * Lee un texto en voz alta.
 */
function speak(text, button) {
  // Verificar soporte
  if (!('speechSynthesis' in window)) {
    console.warn('speechSynthesis no soportado en este navegador.');
    return;
  }

  // Detener cualquier lectura anterior
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';  // Español (las voces en español mexicano son escasas)
  utterance.rate = 0.9;       // Velocidad ligeramente reducida para claridad
  utterance.pitch = 1.0;

  // Intentar seleccionar una voz en español
  const voices = window.speechSynthesis.getVoices();
  const spanishVoice = voices.find(v => v.lang.startsWith('es'));
  if (spanishVoice) {
    utterance.voice = spanishVoice;
  }

  // Actualizar estado del botón
  updateButtonState(button, true);
  isPlaying = true;

  utterance.onend = () => {
    updateButtonState(button, false);
    isPlaying = false;
  };

  utterance.onerror = () => {
    updateButtonState(button, false);
    isPlaying = false;
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Detiene la lectura en voz alta.
 */
function stop() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isPlaying = false;
}

/**
 * Actualiza el texto y estilo del botón de escuchar.
 * Preserva la estructura HTML (.btn-listen-icon + texto).
 */
function updateButtonState(button, playing) {
  if (!button) return;
  // Preservar la estructura del botón con su ícono circular
  button.innerHTML = playing
    ? '<div class="btn-listen-icon">⏹</div> Detener'
    : '<div class="btn-listen-icon">▶</div> Escuchar descripción';
}

// Precargar voces (algunos navegadores las cargan de forma asíncrona)
if ('speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
