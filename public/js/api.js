// Appels à l'API. Une panne réseau devient une ApiError « offline » pour basculer en mode hors ligne.
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
  get offline() { return this.status === 0; }
}

export async function api(method, path, body, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'offline', 'Pas de connexion Internet.');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.message || 'Le serveur a refusé la demande.');
  return data;
}
