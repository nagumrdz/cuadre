// Reemplazo de la API `window.storage` que usan los Artifacts de Claude.
// Esa API solo existe dentro de Claude.ai; aquí la recreamos usando
// localStorage del dispositivo, para que cada mini-app guarde su propio
// progreso sin necesidad de servidor ni cuenta (uso 100% personal y local).
//
// Misma forma que la original: get/set/delete/list, cada una recibe
// (key, shared) y regresa una promesa. "shared" no aplica aquí (no hay
// otros usuarios), pero se mantiene en la firma para no tener que tocar
// el código de las páginas migradas desde el Artifact.

const PREFIX = "furia-hub";

function fullKey(key, shared) {
  return `${PREFIX}:${shared ? "shared" : "personal"}:${key}`;
}

async function get(key, shared = false) {
  const raw = localStorage.getItem(fullKey(key, shared));
  if (raw === null) {
    // Igual que la API original: si la llave no existe, se lanza error
    // (las páginas migradas ya esperan esto con try/catch).
    throw new Error(`Key not found: ${key}`);
  }
  return { key, value: raw, shared };
}

async function set(key, value, shared = false) {
  try {
    localStorage.setItem(fullKey(key, shared), value);
    return { key, value, shared };
  } catch {
    return null;
  }
}

async function del(key, shared = false) {
  localStorage.removeItem(fullKey(key, shared));
  return { key, deleted: true, shared };
}

async function list(prefix = "", shared = false) {
  const scope = `${PREFIX}:${shared ? "shared" : "personal"}:`;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(scope + prefix)) {
      keys.push(k.slice(scope.length));
    }
  }
  return { keys, prefix, shared };
}

if (typeof window !== "undefined") {
  window.storage = { get, set, delete: del, list };
}
