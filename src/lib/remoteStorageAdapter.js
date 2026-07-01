// Reemplazo de `window.storage` respaldado en Upstash Redis (vía su REST
// API), para que el progreso se sincronice entre todos tus dispositivos
// (celular, laptop, etc.) en lugar de quedarse aislado en cada uno.
//
// Nota de seguridad: el token de Upstash queda visible en el código que
// llega al navegador (cualquiera con las herramientas de desarrollador
// podría verlo). Para esta bitácora personal, sin contraseñas ni datos
// bancarios reales, ese riesgo es bajo. Si más adelante quieres esconder
// el token, este es el único archivo que habría que cambiar (moviendo
// estas llamadas detrás de una función serverless de Vercel).

const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL;
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN;
const PREFIX = "furia-hub";

function fullKey(key, shared) {
  return `${PREFIX}:${shared ? "shared" : "personal"}:${key}`;
}

async function redisFetch(path, options = {}) {
  const res = await fetch(`${UPSTASH_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Upstash respondió ${res.status}`);
  }
  return res.json();
}

async function get(key, shared = false) {
  const data = await redisFetch(`/get/${encodeURIComponent(fullKey(key, shared))}`);
  if (data.result === null || data.result === undefined) {
    // Misma convención que la API original: llave inexistente = error,
    // las páginas ya lo atrapan con try/catch y tratan como "vacío".
    throw new Error(`Key not found: ${key}`);
  }
  return { key, value: data.result, shared };
}

async function set(key, value, shared = false) {
  try {
    const data = await redisFetch(`/set/${encodeURIComponent(fullKey(key, shared))}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: value,
    });
    if (data.result !== "OK") return null;
    return { key, value, shared };
  } catch {
    return null;
  }
}

async function del(key, shared = false) {
  await redisFetch(`/del/${encodeURIComponent(fullKey(key, shared))}`);
  return { key, deleted: true, shared };
}

async function list() {
  // No se usa por ahora en esta app (solo get/set), se deja como stub.
  return { keys: [], prefix: "", shared: false };
}

if (typeof window !== "undefined") {
  window.storage = { get, set, delete: del, list };
}
