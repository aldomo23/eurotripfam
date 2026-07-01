/**
 * ai-chat.js — Chat con IA (Gemini 2.5 Flash-Lite)
 *
 * Clases CSS alineadas con styles.css v2.0:
 * - .chat-bubble-user / .chat-bubble-bot (NO -ai)
 * - .chat-typing > span (NO .chat-dots/.chat-dot)
 */

let config = null;
let chatHistory = [];

export function initChat(appConfig) {
  config = appConfig;
  setupChatListeners();
}

function setupChatListeners() {
  const input = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');
  if (!input || !btnSend) return;

  btnSend.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  document.querySelectorAll('.chip-suggestion').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.dataset.question;
      if (q) { input.value = q; sendMessage(); }
    });
  });
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';

  // Ocultar bienvenida
  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // Burbuja del usuario — CSS: .chat-bubble-user
  appendBubble(message, 'user');

  // Indicador de carga — CSS: .chat-typing > span
  const loading = appendTypingIndicator();

  try {
    const response = await queryGemini(message);
    loading.remove();
    appendBubble(response, 'bot'); // CSS: .chat-bubble-bot (no -ai)
  } catch (error) {
    loading.remove();
    appendError(error.message);
  }

  scrollToBottom();
}

async function queryGemini(userMessage) {
  const proxyUrl = config?.proxy_url;

  if (!proxyUrl || proxyUrl.includes('TU-SUBDOMINIO')) {
    return getFallbackResponse(userMessage);
  }

  chatHistory.push({ role: 'user', content: userMessage });

  const body = {
    contents: [
      { role: 'user', parts: [{ text: buildPrompt(userMessage) }] }
    ],
    generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
  };

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error('Demasiadas consultas. Espera un momento.');
    throw new Error('No se pudo conectar. Verifica tu conexión a internet.');
  }

  const data = await response.json();
  const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Lo siento, no pude generar una respuesta. Intenta de nuevo.';

  chatHistory.push({ role: 'assistant', content: aiText });
  if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

  return aiText;
}

function buildPrompt(userMessage) {
  const systemPrompt = `Eres una guía turística experta y amable para una familia mexicana visitando Europa. Respondes en español mexicano (sin voseo). Tus respuestas son breves (máximo 3 párrafos), prácticas y con datos verificables. Si te preguntan por un lugar, recomiendas 2-3 cosas cercanas. No inventas horarios ni precios sin estar seguro. Si no sabes algo, lo dices.

Las ciudades del viaje son: Barcelona, Roma, Florencia y París (julio 2026).`;

  let context = '';
  if (chatHistory.length > 0) {
    const recent = chatHistory.slice(-6);
    context = '\n\nConversación reciente:\n' + recent.map(m =>
      `${m.role === 'user' ? 'Usuario' : 'Guía'}: ${m.content}`
    ).join('\n');
  }

  return `${systemPrompt}${context}\n\nUsuario: ${userMessage}\n\nGuía:`;
}

function getFallbackResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('comer') || lower.includes('comida') || lower.includes('restaurante'))
    return '🍽️ Revisa las guías de comida en la sección de inicio. Cada ficha también tiene sugerencias de dónde comer cerca. ¡El pa amb tomàquet en Barcelona es imperdible!';

  if (lower.includes('cerca') || lower.includes('cerquita'))
    return '📍 Abre la ficha de cualquier lugar y revisa "Dónde comer cerca". También puedes usar Google Maps con el botón "Cómo llegar" en cada ficha.';

  if (lower.includes('recomiend') || lower.includes('sugi'))
    return '⭐ Explora la sección "Recomendados para ti" en la pantalla de inicio. Están filtrados según los intereses que elegiste.';

  return '🤖 El chat necesita conexión a internet para funcionar. Mientras tanto, puedes explorar las fichas de lugares, buscar por categoría y escuchar las descripciones — todo funciona sin internet.';
}

// --- UI del chat ---

function appendBubble(text, type) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  // type = 'user' o 'bot' → .chat-bubble-user o .chat-bubble-bot
  bubble.className = `chat-bubble-${type}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

// CSS: .chat-typing > span (3 dots con animación)
function appendTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  el.className = 'chat-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  scrollToBottom();
  return el;
}

function appendError(message) {
  const container = document.getElementById('chat-messages');
  const el = document.createElement('div');
  // Reutilizar estilo de burbuja bot con color de error
  el.className = 'chat-bubble-bot';
  el.style.color = 'var(--terra)';
  el.style.borderColor = 'rgba(194,86,47,0.3)';
  el.textContent = `⚠️ ${message}`;
  container.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}
