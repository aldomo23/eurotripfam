/**
 * gemini-proxy.js — Proxy para Cloudflare Workers
 * 
 * Protege la API key de Gemini. Recibe peticiones del frontend,
 * agrega la API key y reenvía a la API de Gemini.
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Ir a https://workers.cloudflare.com y crear una cuenta (gratis)
 * 2. Crear un nuevo Worker
 * 3. Pegar este código
 * 4. En Settings > Variables, agregar la variable GEMINI_API_KEY con tu key
 * 5. En la variable ALLOWED_ORIGIN, poner la URL de tu app (ej: https://aldo.github.io)
 * 6. Hacer deploy
 * 7. Copiar la URL del Worker y ponerla en data/config.json como proxy_url
 */

// Modelo de Gemini a usar
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Rate limiting simple (en memoria, se reinicia al re-deployar)
const rateLimitMap = new Map();
const MAX_REQUESTS_PER_IP = 100; // por día
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 horas

export default {
  async fetch(request, env) {
    // CORS: solo aceptar peticiones del dominio de la app
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';

    // Manejar preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Solo aceptar POST
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Método no permitido' }, 405, allowedOrigin);
    }

    // Verificar API key está configurada
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'API key no configurada' }, 500, allowedOrigin);
    }

    // Rate limiting por IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isRateLimited(clientIP)) {
      return jsonResponse({ error: 'Demasiadas consultas. Intenta más tarde.' }, 429, allowedOrigin);
    }

    try {
      // Leer el body del frontend
      const body = await request.json();

      // Reenviar a Gemini con la API key
      const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await geminiResponse.json();

      // Incrementar contador de rate limiting
      incrementRateLimit(clientIP);

      return jsonResponse(data, geminiResponse.status, allowedOrigin);

    } catch (error) {
      return jsonResponse(
        { error: 'Error al procesar la consulta' },
        500,
        allowedOrigin
      );
    }
  }
};

// --- Utilidades ---

function jsonResponse(data, status, allowedOrigin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowedOrigin
    }
  });
}

function isRateLimited(ip) {
  const record = rateLimitMap.get(ip);
  if (!record) return false;

  // Verificar si la ventana expiró
  if (Date.now() - record.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.delete(ip);
    return false;
  }

  return record.count >= MAX_REQUESTS_PER_IP;
}

function incrementRateLimit(ip) {
  const record = rateLimitMap.get(ip);
  if (!record || Date.now() - record.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: Date.now() });
  } else {
    record.count++;
  }
}
