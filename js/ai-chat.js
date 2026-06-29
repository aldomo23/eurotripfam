/**
 * ai-chat.js — Chat con IA (Gemini 2.5 Flash-Lite)
 * 
 * Envía preguntas al proxy de Cloudflare Workers,
 * que a su vez consulta la API de Gemini.
 * Requiere conexión a internet.
 */

let config = null;
let chatHistory = []; // Historial de mensajes para contexto

/**
 * Inicializa el módulo de chat.
 */
export function initChat(appConfig) {
  config = appConfig;
  setupChatListeners();
}

function setupChatListeners() {
  const input = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');

  if (!input || !btnSend) return;

  // Enviar con botón
  btnSend.addEventListener('click', () => sendMessage());

  // Enviar con Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Chips de sugerencias
  document.querySelectorAll('.chip-suggestion').forEach(chip => {
    chip.addEventListener('click', () => {
      const question = chip.dataset.question;
      if (question) {
        input.value = question;
        sendMessage();
      }
    });
  });
}

/**
 * Envía el mensaje del usuario y muestra la respuesta de la IA.
 */
async function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (!message) return;

  // Limpiar input
  input.value = '';

  // Ocultar pantalla de bienvenida
  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  // Mostrar burbuja del usuario
  appendBubble(message, 'user');

  // Mostrar indicador de carga
  const loadingBubble = appendLoadingBubble();

  try {
    const response = await queryGemini(message);
    loadingBubble.remove();
    appendBubble(response, 'ai');
  } catch (error) {
    loadingBubble.remove();
    appendError(error.message);
  }

  // Scroll al fondo
  scrollToBottom();
}

/**
 * Consulta a Gemini vía el proxy de Cloudflare Workers.
 */
async function queryGemini(userMessage) {
  const proxyUrl = config?.proxy_url;

  if (!proxyUrl || proxyUrl.includes('TU-SUBDOMINIO')) {
    // Si no hay proxy configurado, dar respuesta de fallback
    return getFallbackResponse(userMessage);
  }

  // Agregar mensaje al historial
  chatHistory.push({ role: 'user', content: userMessage });

  // Construir el body para Gemini API (vía proxy)
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildPrompt(userMessage) }]
      }
    ],
    generationConfig: {
      maxOutputTokens: 500,
      temperature: 0.7
    }
  };

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Demasiadas consultas. Espera un momento e intenta de nuevo.');
    }
    throw new Error('No se pudo conectar con la guía. Verifica tu conexión a internet.');
  }

  const data = await response.json();

  // Extraer texto de la respuesta de Gemini
  const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Lo siento, no pude generar una respuesta. Intenta de nuevo.';

  // Agregar respuesta al historial
  chatHistory.push({ role: 'assistant', content: aiText });

  // Mantener historial manejable (últimos 10 intercambios)
  if (chatHistory.length > 20) {
    chatHistory = chatHistory.slice(-20);
  }

  return aiText;
}

/**
 * Construye el prompt completo con system prompt y contexto.
 */
function buildPrompt(userMessage) {
  const systemPrompt = `Eres una guía turística experta y amable para una familia mexicana visitando Europa. Respondes en español mexicano (sin voseo). Tus respuestas son breves (máximo 3 párrafos), prácticas y con datos verificables. Si te preguntan por un lugar, recomiendas 2-3 cosas cercanas basadas en los gustos del usuario. No inventas horarios ni precios sin estar seguro. Si no sabes algo, lo dices.

Las ciudades del viaje son: Barcelona, Roma, Florencia y París (julio 2026).`;

  // Incluir historial reciente para contexto
  let context = '';
  if (chatHistory.length > 0) {
    const recent = chatHistory.slice(-6); // últimos 3 intercambios
    context = '\n\nConversación reciente:\n' + recent.map(m =>
      `${m.role === 'user' ? 'Usuario' : 'Guía'}: ${m.content}`
    ).join('\n');
  }

  return `${systemPrompt}${context}\n\nUsuario: ${userMessage}\n\nGuía:`;
}

/**
 * Respuesta de fallback cuando no hay proxy configurado.
 * Útil para testing sin servidor.
 */
function getFallbackResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('comer') || lower.includes('comida') || lower.includes('restaurante')) {
    return '🍽️ Para recomendaciones de comida, revisa las guías de comida en la sección de inicio. Cada ficha de lugar también tiene sugerencias de dónde comer cerca. ¡El pa amb tomàquet en Barcelona es imperdible!';
  }

  if (lower.includes('cerca') || lower.includes('cerquita')) {
    return '📍 Para ver qué hay cerca de donde estás, abre la ficha de cualquier lugar y revisa la sección "Dónde comer cerca". También puedes usar Google Maps con el botón "Cómo llegar" en cada ficha.';
  }

  if (lower.includes('recomiend') || lower.includes('sugi')) {
    return '⭐ Te recomiendo explorar los lugares en la sección "Recomendados para ti" en la pantalla de inicio. Están ordenados según los intereses que elegiste al inicio. ¡Toca cualquier tarjeta para ver el detalle!';
  }

  return '🤖 El chat con la guía inteligente necesita conexión a internet. Mientras tanto, puedes explorar todas las fichas de lugares, buscar por categoría, y escuchar las descripciones — todo funciona sin internet. Para activar el chat, configura la URL del proxy en data/config.json.';
}

// --- UI del chat ---

function appendBubble(text, type) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble chat-bubble-${type}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function appendLoadingBubble() {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-loading';
  bubble.innerHTML = `
    <div class="chat-dots">
      <div class="chat-dot"></div>
      <div class="chat-dot"></div>
      <div class="chat-dot"></div>
    </div>
  `;
  container.appendChild(bubble);
  scrollToBottom();
  return bubble;
}

function appendError(message) {
  const container = document.getElementById('chat-messages');
  const error = document.createElement('div');
  error.className = 'chat-error';
  error.textContent = `⚠️ ${message}`;
  container.appendChild(error);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  // Pequeño delay para que el DOM se actualice
  setTimeout(() => {
    container.scrollTop = container.scrollHeight;
  }, 50);
}
