// Stockage local (IndexedDB) d'une entreprise + file d'attente des modifications à envoyer.
// Tout fonctionne hors ligne ; la synchronisation envoie la file puis récupère les nouveautés de l'équipe.
import { api } from './api.js';

export const COLLECTIONS = ['contacts', 'deals', 'actions', 'meetings', 'objectives'];

function req(r) { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
function openIdb(name) {
  const r = indexedDB.open(name, 1);
  r.onupgradeneeded = () => { ['records', 'outbox', 'meta'].forEach((s) => r.result.createObjectStore(s)); };
  return req(r);
}
async function all(db, store) {
  const tx = db.transaction(store, 'readonly').objectStore(store);
  const [keys, values] = await Promise.all([req(tx.getAllKeys()), req(tx.getAll())]);
  return keys.map((k, i) => [k, values[i]]);
}
function write(db, store, ops) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    ops.forEach(([key, value]) => (value === undefined ? os.delete(key) : os.put(value, key)));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function openStore(tenantId) {
  const s = new Store(await openIdb(`zebre-${tenantId}`));
  await s.load();
  return s;
}
export function deleteStore(tenantId) { return req(indexedDB.deleteDatabase(`zebre-${tenantId}`)).catch(() => {}); }

class Store {
  constructor(db) {
    this.db = db;
    this.data = {};
    COLLECTIONS.forEach((c) => { this.data[c] = new Map(); });
    this.outbox = new Map();
    this.meta = {};
    this.listeners = new Set();
  }

  async load() {
    for (const [k, v] of await all(this.db, 'records')) {
      const [col, id] = k.split('/');
      if (this.data[col]) this.data[col].set(id, { ...v, id });
    }
    for (const [k, v] of await all(this.db, 'outbox')) this.outbox.set(k, v);
    for (const [k, v] of await all(this.db, 'meta')) this.meta[k] = v;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(kind) { this.listeners.forEach((fn) => fn(kind)); }

  list(col) { return [...this.data[col].values()]; }
  get(col, id) { return this.data[col].get(id); }
  pending() { return this.outbox.size; }

  async put(col, id, data) {
    const doc = { ...data, id };
    this.data[col].set(id, doc);
    const key = `${col}/${id}`;
    const change = { col, id, data: doc, deleted: false, rev: `${Date.now()}-${Math.random()}` };
    this.outbox.set(key, change);
    await Promise.all([write(this.db, 'records', [[key, doc]]), write(this.db, 'outbox', [[key, change]])]);
    this.emit('local');
  }

  async del(col, id) {
    this.data[col].delete(id);
    const key = `${col}/${id}`;
    const change = { col, id, deleted: true, rev: `${Date.now()}-${Math.random()}` };
    this.outbox.set(key, change);
    await Promise.all([write(this.db, 'records', [[key, undefined]]), write(this.db, 'outbox', [[key, change]])]);
    this.emit('local');
  }

  async setMeta(key, value) {
    this.meta[key] = value;
    await write(this.db, 'meta', [[key, value]]);
    this.emit('meta');
  }

  // Envoie les modifications locales par lots. Une entrée modifiée pendant l'envoi reste dans la file.
  async push(token) {
    while (this.outbox.size) {
      const batch = [...this.outbox.entries()].slice(0, 200);
      const res = await api('POST', '/api/sync', { changes: batch.map(([, c]) => ({ col: c.col, id: c.id, data: c.data, deleted: c.deleted })) }, token);
      const done = new Set([...res.accepted, ...res.rejected].map((a) => `${a.col}/${a.id}`));
      if (res.rejected.length) console.warn('Modifications refusées par le serveur', res.rejected);
      const ops = [];
      batch.forEach(([key, c]) => {
        if (done.has(key) && this.outbox.get(key) && this.outbox.get(key).rev === c.rev) { this.outbox.delete(key); ops.push([key, undefined]); }
      });
      await write(this.db, 'outbox', ops);
      if (!ops.length) break;
    }
    this.emit('sync');
  }

  // Récupère ce que l'équipe a changé depuis la dernière synchronisation.
  async pull(token) {
    let more = true;
    let changed = false;
    while (more) {
      const tenant = this.meta.tenant || {};
      const res = await api('GET', `/api/sync?since=${this.meta.cursor || 0}&tv=${tenant.version || 0}`, null, token);
      const ops = [];
      res.changes.forEach((c) => {
        const key = `${c.col}/${c.id}`;
        if (!this.data[c.col] || this.outbox.has(key)) return; // la version locale non envoyée garde la main
        if (c.deleted) { this.data[c.col].delete(c.id); ops.push([key, undefined]); } else { const doc = { ...c.data, id: c.id }; this.data[c.col].set(c.id, doc); ops.push([key, doc]); }
        changed = true;
      });
      if (ops.length) await write(this.db, 'records', ops);
      const t = res.tenant.logo === undefined ? { ...res.tenant, logo: tenant.logo || '' } : res.tenant;
      if (!this.meta.tenantDirty) this.meta.tenant = t;
      this.meta.team = res.team;
      this.meta.licence = res.licence;
      this.meta.user = res.user;
      this.meta.cursor = res.cursor;
      this.meta.lastSync = new Date().toISOString();
      await write(this.db, 'meta', Object.entries(this.meta).filter(([k]) => ['tenant', 'team', 'licence', 'user', 'cursor', 'lastSync'].includes(k)));
      more = res.more;
    }
    this.emit(changed ? 'remote' : 'sync');
  }
}
