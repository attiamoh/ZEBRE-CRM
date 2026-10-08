// Dérivation du mot de passe, vérification des licences et comptes enregistrés sur l'appareil.
import config from '/config.js';

const enc = new TextEncoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64u = (s) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

// Même calcul que server/security.js (deriveAuthKey) : le mot de passe ne quitte jamais l'appareil en clair.
export async function deriveAuthKey(email, password) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(`zebre:${email.trim().toLowerCase()}`), iterations: 150000 }, base, 256);
  return b64(bits);
}
export async function verifierOf(authKey) { return b64(await crypto.subtle.digest('SHA-256', enc.encode(`verif:${authKey}`))); }

let pubKey;
export async function readLicence(key) {
  const parts = String(key || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'ZB1') return null;
  try {
    pubKey = pubKey || await crypto.subtle.importKey('jwk', { ...config.licencePublicKey, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, fromB64u(parts[2]), enc.encode(parts[1]));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(parts[1])));
    const plan = (config.plans || {})[p.p] || {};
    return { id: p.i, plan: p.p, planLabel: plan.label || p.p, maxUsers: p.u, expiresAt: p.e, customer: p.c || '' };
  } catch { return null; }
}
export const plans = () => config.plans || {};

// ---------- Comptes connus sur cet appareil ----------
const KEY = 'zebre-accounts';
export function accounts() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
export function saveAccount(acc) { const all = accounts(); all[acc.email] = acc; localStorage.setItem(KEY, JSON.stringify(all)); return acc; }
export function removeAccount(email) { const all = accounts(); delete all[email]; localStorage.setItem(KEY, JSON.stringify(all)); }
export function currentEmail() { return localStorage.getItem('zebre-current') || ''; }
export function setCurrent(email) { if (email) localStorage.setItem('zebre-current', email); else localStorage.removeItem('zebre-current'); }
export const uuid = (p) => `${p}_${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '').slice(0, 16)}`;
