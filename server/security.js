// Mots de passe, jetons de session et licences signées.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Doit rester identique à public/js/auth.js : le navigateur dérive la même clé,
// ce qui permet l'inscription et la connexion hors ligne sans jamais stocker le mot de passe.
export const PBKDF2_ITERATIONS = 150000;
export function deriveAuthKey(email, password) {
  return crypto.pbkdf2Sync(password, `zebre:${email.trim().toLowerCase()}`, PBKDF2_ITERATIONS, 32, 'sha256').toString('base64');
}

export function hashSecret(authKey) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(authKey, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifySecret(authKey, stored) {
  const [kind, salt, hash] = String(stored).split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(String(authKey), Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');

export function loadSecrets(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'secrets.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* premier démarrage */ }
  let changed = false;
  if (!saved.sessionSecret) { saved.sessionSecret = crypto.randomBytes(32).toString('base64'); changed = true; }
  if (!saved.licencePrivateKey) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    saved.licencePrivateKey = privateKey.export({ type: 'pkcs8', format: 'pem' });
    changed = true;
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(saved, null, 2), { mode: 0o600 });
  const sessionSecret = process.env.SESSION_SECRET || saved.sessionSecret;
  const privatePem = process.env.LICENCE_PRIVATE_KEY ? process.env.LICENCE_PRIVATE_KEY.replace(/\\n/g, '\n') : saved.licencePrivateKey;
  const privateKey = crypto.createPrivateKey(privatePem);
  const publicKey = crypto.createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });
  return { sessionSecret, privateKey, publicKey, publicJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } };
}

// ---------- Jetons de session ----------
export function signToken(secret, claims, days = 30) {
  const body = b64u(JSON.stringify({ ...claims, exp: Date.now() + days * 86400000 }));
  const mac = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${mac}`;
}

export function readToken(secret, token) {
  if (!token || typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  const given = unb64u(mac);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(unb64u(body).toString('utf8'));
    return claims.exp > Date.now() ? claims : null;
  } catch { return null; }
}

// ---------- Licences ----------
// Format : ZB1.<charge utile base64url>.<signature ECDSA P-256 base64url>
// La signature se vérifie dans le navigateur (WebCrypto), d'où l'activation possible hors ligne.
export const PLANS = {
  essentiel: { label: 'Essentiel', maxUsers: 3 },
  pro: { label: 'Pro', maxUsers: 10 },
  entreprise: { label: 'Entreprise', maxUsers: 50 },
};

export function createLicenceKey(privateKey, { id, plan, maxUsers, expiresAt, customer }) {
  const payload = { v: 1, i: id, p: plan, u: maxUsers, e: expiresAt };
  if (customer) payload.c = String(customer).slice(0, 60);
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign('sha256', Buffer.from(body), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `ZB1.${body}.${b64u(sig)}`;
}

export function parseLicenceKey(publicKey, key) {
  const parts = String(key || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'ZB1') return null;
  const [, body, sig] = parts;
  let ok = false;
  try { ok = crypto.verify('sha256', Buffer.from(body), { key: publicKey, dsaEncoding: 'ieee-p1363' }, unb64u(sig)); } catch { ok = false; }
  if (!ok) return null;
  try {
    const p = JSON.parse(unb64u(body).toString('utf8'));
    if (!p.i || !p.p || !p.u || !p.e) return null;
    return { id: String(p.i), plan: String(p.p), maxUsers: Number(p.u), expiresAt: String(p.e), customer: p.c || '' };
  } catch { return null; }
}

export const newId = (prefix) => `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
export const licenceId = () => crypto.randomBytes(6).toString('hex').toUpperCase();
