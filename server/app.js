// API ZEBRE CRM : entreprises (locataires), licences, comptes, équipe et synchronisation hors ligne.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, nextSeq, tx } from './db.js';
import {
  loadSecrets, signToken, readToken, hashSecret, verifySecret, deriveAuthKey,
  createLicenceKey, parseLicenceKey, PLANS, newId, licenceId,
} from './security.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const COLLECTIONS = ['contacts', 'deals', 'actions', 'meetings', 'objectives'];
const ROLES = ['owner', 'admin', 'manager', 'sales'];
const ADMIN_ROLES = ['owner', 'admin'];
const OBJECTIVE_ROLES = ['owner', 'admin', 'manager'];
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LOGO_RE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const MAX_LOGO = 400 * 1024;
const MAX_DOC = 64 * 1024;

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const addMonths = (months) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };

export function createApp({ dataDir = path.join(ROOT, 'data'), dbFile, superadmin } = {}) {
  const secrets = loadSecrets(dataDir);
  const db = openDb(dbFile || path.join(dataDir, 'zebre.db'));
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Frame-Options', 'DENY');
    next();
  });

  // ---------- Super administrateur (vous, l'éditeur de ZEBRE CRM) ----------
  function ensureSuperadmin(email, password) {
    if (!email || !password) return;
    const e = email.trim().toLowerCase();
    const hash = hashSecret(deriveAuthKey(e, password));
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(e);
    if (existing) db.prepare("UPDATE users SET pass_hash = ?, role = 'superadmin', tenant_id = NULL, active = 1 WHERE id = ?").run(hash, existing.id);
    else db.prepare("INSERT INTO users(id, tenant_id, email, name, role, pass_hash, created_at) VALUES (?, NULL, ?, 'Administrateur ZEBRE', 'superadmin', ?, ?)").run(newId('usr'), e, hash, nowIso());
  }
  const sa = superadmin || { email: process.env.SUPERADMIN_EMAIL, password: process.env.SUPERADMIN_PASSWORD };
  ensureSuperadmin(sa.email, sa.password);

  // ---------- Lecture ----------
  const tenantRow = (id) => db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  const licenceRow = (tenantId) => db.prepare('SELECT * FROM licences WHERE tenant_id = ?').get(tenantId);
  const userRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const seatsUsed = (tenantId) => db.prepare('SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND active = 1').get(tenantId).n;

  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, title: u.title || '', color: u.color || '#B7791F', active: !!u.active, tenantId: u.tenant_id });
  const publicTenant = (t, withLogo = true) => (t ? { id: t.id, name: t.name, currency: t.currency, brandColor: t.brand_color || '', logo: withLogo ? t.logo || '' : undefined, version: t.version } : null);
  function publicLicence(l, tenantId) {
    if (!l) return null;
    const expired = l.expires_at < today();
    return {
      id: l.id, plan: l.plan, planLabel: (PLANS[l.plan] || {}).label || l.plan, maxUsers: l.max_users, expiresAt: l.expires_at,
      status: l.status, usable: l.status === 'active' && !expired, expired, seatsUsed: tenantId ? seatsUsed(tenantId) : undefined,
    };
  }
  function session(u) {
    const token = signToken(secrets.sessionSecret, { uid: u.id, tid: u.tenant_id, role: u.role });
    return { token, ...profile(u) };
  }
  function profile(u) {
    if (u.role === 'superadmin') return { user: publicUser(u), tenant: null, licence: null, team: [] };
    return { user: publicUser(u), tenant: publicTenant(tenantRow(u.tenant_id)), licence: publicLicence(licenceRow(u.tenant_id), u.tenant_id), team: team(u.tenant_id) };
  }
  const team = (tenantId) => db.prepare('SELECT * FROM users WHERE tenant_id = ? ORDER BY name').all(tenantId).map(publicUser);

  // ---------- Middleware d'authentification ----------
  function auth(req, res, next) {
    const h = req.get('authorization') || '';
    const claims = readToken(secrets.sessionSecret, h.startsWith('Bearer ') ? h.slice(7) : '');
    if (!claims) return next(new HttpError(401, 'unauthenticated', 'Session expirée. Reconnectez-vous.'));
    const u = userRow(claims.uid);
    if (!u || !u.active) return next(new HttpError(401, 'unauthenticated', 'Compte désactivé.'));
    req.user = u;
    next();
  }
  const role = (...allowed) => (req, res, next) => (allowed.includes(req.user.role) ? next() : next(new HttpError(403, 'forbidden', 'Action réservée aux administrateurs.')));
  function requireUsableLicence(tenantId) {
    const l = licenceRow(tenantId);
    if (!l) fail(402, 'licence_missing', 'Aucune licence pour cette entreprise.');
    if (l.status !== 'active') fail(402, 'licence_suspended', 'La licence de votre entreprise est suspendue. Contactez ZEBRE CRM.');
    if (l.expires_at < today()) fail(402, 'licence_expired', `La licence a expiré le ${l.expires_at}. Contactez ZEBRE CRM pour la renouveler.`);
    return l;
  }

  // Limitation simple des tentatives de connexion (mémoire du processus).
  const attempts = new Map();
  function throttle(key) {
    const now = Date.now();
    const a = attempts.get(key) || { n: 0, t: now };
    if (now - a.t > 15 * 60000) { a.n = 0; a.t = now; }
    a.n += 1;
    attempts.set(key, a);
    if (a.n > 10) fail(429, 'too_many_attempts', 'Trop de tentatives. Réessayez dans quelques minutes.');
  }

  const str = (v, max = 120) => String(v ?? '').trim().slice(0, max);
  function cleanId(v, prefix) {
    if (v == null || v === '') return newId(prefix);
    if (!ID_RE.test(String(v))) fail(400, 'invalid_id', 'Identifiant invalide.');
    return String(v);
  }

  const api = express.Router();

  // Clé publique de vérification des licences, pour l'activation hors ligne.
  app.get('/config.js', (req, res) => {
    res.type('application/javascript').set('Cache-Control', 'no-cache');
    res.send(`export default ${JSON.stringify({ licencePublicKey: secrets.publicJwk, plans: PLANS })};\n`);
  });

  api.get('/health', (req, res) => res.json({ ok: true, time: nowIso() }));

  api.post('/licence/check', (req, res) => {
    const p = parseLicenceKey(secrets.publicKey, req.body.key);
    if (!p) return res.json({ valid: false });
    const row = db.prepare('SELECT * FROM licences WHERE id = ?').get(p.id);
    res.json({ valid: true, plan: p.plan, maxUsers: p.maxUsers, expiresAt: row ? row.expires_at : p.expiresAt, used: !!(row && row.tenant_id), status: row ? row.status : 'active' });
  });

  // Inscription d'une entreprise avec une licence. Les identifiants peuvent venir du navigateur
  // quand l'inscription a d'abord été faite hors ligne : les données locales gardent ainsi leurs liens.
  api.post('/register', (req, res) => {
    const { licenceKey, company = {}, user = {} } = req.body || {};
    const lic = parseLicenceKey(secrets.publicKey, licenceKey);
    if (!lic) fail(400, 'licence_invalid', 'Clé de licence invalide. Vérifiez qu’elle a été copiée en entier.');
    const email = str(user.email, 160).toLowerCase();
    const name = str(user.name);
    const companyName = str(company.name);
    if (!EMAIL_RE.test(email)) fail(400, 'invalid_email', 'Adresse e-mail invalide.');
    if (!name || !companyName) fail(400, 'missing_fields', 'Nom et entreprise obligatoires.');
    if (!user.authKey || String(user.authKey).length < 20) fail(400, 'invalid_password', 'Mot de passe invalide.');
    const currency = str(company.currency || 'FCFA', 8) || 'FCFA';
    const tenantId = cleanId(company.id, 'ten');
    const userId = cleanId(user.id, 'usr');
    const out = tx(db, () => {
      let row = db.prepare('SELECT * FROM licences WHERE id = ?').get(lic.id);
      if (row && row.tenant_id) {
        // Renvoi d'une inscription hors ligne déjà enregistrée : on reconnaît le même compte.
        const same = row.tenant_id === tenantId && userRow(userId) && userRow(userId).email === email;
        if (same && verifySecret(user.authKey, userRow(userId).pass_hash)) return session(userRow(userId));
        fail(409, 'licence_used', 'Cette licence est déjà utilisée par une autre entreprise.');
      }
      if (row && row.status !== 'active') fail(402, 'licence_suspended', 'Cette licence est suspendue.');
      if ((row ? row.expires_at : lic.expiresAt) < today()) fail(402, 'licence_expired', 'Cette licence a expiré.');
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'email_used', 'Un compte existe déjà avec cette adresse e-mail.');
      if (tenantRow(tenantId) || userRow(userId)) fail(409, 'id_used', 'Identifiant déjà utilisé.');
      const t = nowIso();
      db.prepare('INSERT INTO tenants(id, name, currency, created_at) VALUES (?, ?, ?, ?)').run(tenantId, companyName, currency, t);
      if (!row) {
        db.prepare('INSERT INTO licences(id, plan, max_users, expires_at, customer, licence_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(lic.id, lic.plan, lic.maxUsers, lic.expiresAt, lic.customer || companyName, String(licenceKey).trim(), t);
      }
      db.prepare('UPDATE licences SET tenant_id = ?, activated_at = ? WHERE id = ?').run(tenantId, t, lic.id);
      db.prepare('INSERT INTO users(id, tenant_id, email, name, role, title, color, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(userId, tenantId, email, name, 'owner', str(user.title) || 'Gérant(e)', COLOR_RE.test(user.color || '') ? user.color : '#B7791F', hashSecret(String(user.authKey)), t);
      return session(userRow(userId));
    });
    res.status(201).json(out);
  });

  api.post('/login', (req, res) => {
    const email = str(req.body.email, 160).toLowerCase();
    throttle(`${req.ip}|${email}`);
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!u || !u.active || !verifySecret(String(req.body.authKey || ''), u.pass_hash)) fail(401, 'bad_credentials', 'E-mail ou mot de passe incorrect.');
    res.json(session(u));
  });

  api.get('/me', auth, (req, res) => res.json(profile(req.user)));

  api.post('/password', auth, (req, res) => {
    const { oldAuthKey, newAuthKey } = req.body || {};
    if (!verifySecret(String(oldAuthKey || ''), req.user.pass_hash)) fail(400, 'bad_credentials', 'Mot de passe actuel incorrect.');
    if (!newAuthKey || String(newAuthKey).length < 20) fail(400, 'invalid_password', 'Nouveau mot de passe invalide.');
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashSecret(String(newAuthKey)), req.user.id);
    res.json({ ok: true });
  });

  // ---------- Personnalisation de l'entreprise ----------
  api.put('/tenant', auth, role(...ADMIN_ROLES), (req, res) => {
    const t = tenantRow(req.user.tenant_id);
    const b = req.body || {};
    const name = b.name != null ? str(b.name) : t.name;
    if (!name) fail(400, 'missing_fields', 'Le nom de l’entreprise est obligatoire.');
    const currency = b.currency != null ? str(b.currency, 8) || t.currency : t.currency;
    let brand = t.brand_color;
    if (b.brandColor != null) { if (b.brandColor && !COLOR_RE.test(b.brandColor)) fail(400, 'invalid_color', 'Couleur invalide.'); brand = b.brandColor || null; }
    let logo = t.logo;
    if (b.logo != null) {
      if (b.logo && (!LOGO_RE.test(b.logo) || b.logo.length > MAX_LOGO * 1.37)) fail(400, 'invalid_logo', 'Logo invalide : PNG, JPEG, WebP ou SVG de 400 Ko maximum.');
      logo = b.logo || null;
    }
    db.prepare('UPDATE tenants SET name = ?, currency = ?, brand_color = ?, logo = ?, version = version + 1 WHERE id = ?').run(name, currency, brand, logo, t.id);
    res.json(publicTenant(tenantRow(t.id)));
  });

  // ---------- Équipe ----------
  api.get('/team', auth, (req, res) => res.json({ team: team(req.user.tenant_id), licence: publicLicence(licenceRow(req.user.tenant_id), req.user.tenant_id) }));

  api.post('/team', auth, role(...ADMIN_ROLES), (req, res) => {
    const tid = req.user.tenant_id;
    const lic = requireUsableLicence(tid);
    const b = req.body || {};
    const email = str(b.email, 160).toLowerCase();
    if (!EMAIL_RE.test(email)) fail(400, 'invalid_email', 'Adresse e-mail invalide.');
    if (!str(b.name)) fail(400, 'missing_fields', 'Le nom est obligatoire.');
    if (!b.authKey || String(b.authKey).length < 20) fail(400, 'invalid_password', 'Mot de passe provisoire invalide.');
    const r = ROLES.includes(b.role) && b.role !== 'owner' ? b.role : 'sales';
    const u = tx(db, () => {
      if (seatsUsed(tid) >= lic.max_users) fail(402, 'seats_full', `Votre licence ${(PLANS[lic.plan] || {}).label || lic.plan} est limitée à ${lic.max_users} utilisateurs. Passez à une licence supérieure pour en ajouter.`);
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) fail(409, 'email_used', 'Un compte existe déjà avec cette adresse e-mail.');
      const id = newId('usr');
      db.prepare('INSERT INTO users(id, tenant_id, email, name, role, title, color, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, tid, email, str(b.name), r, str(b.title), COLOR_RE.test(b.color || '') ? b.color : '#2F6F8F', hashSecret(String(b.authKey)), nowIso());
      return userRow(id);
    });
    res.status(201).json(publicUser(u));
  });

  api.put('/team/:id', auth, role(...ADMIN_ROLES), (req, res) => {
    const u = userRow(req.params.id);
    if (!u || u.tenant_id !== req.user.tenant_id) fail(404, 'not_found', 'Utilisateur introuvable.');
    const b = req.body || {};
    const next = {
      name: b.name != null ? str(b.name) || u.name : u.name,
      title: b.title != null ? str(b.title) : u.title,
      color: COLOR_RE.test(b.color || '') ? b.color : u.color,
      role: b.role != null && ROLES.includes(b.role) ? b.role : u.role,
      active: b.active != null ? (b.active ? 1 : 0) : u.active,
    };
    if (u.role === 'owner' && (next.role !== 'owner' || !next.active)) {
      const owners = db.prepare("SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND role = 'owner' AND active = 1").get(u.tenant_id).n;
      if (owners <= 1) fail(400, 'last_owner', 'L’entreprise doit garder au moins un propriétaire actif.');
    }
    if (next.role === 'owner' && u.role !== 'owner' && req.user.role !== 'owner') fail(403, 'forbidden', 'Seul un propriétaire peut nommer un autre propriétaire.');
    if (!u.active && next.active) {
      const lic = requireUsableLicence(u.tenant_id);
      if (seatsUsed(u.tenant_id) >= lic.max_users) fail(402, 'seats_full', 'Toutes les places de la licence sont utilisées.');
    }
    db.prepare('UPDATE users SET name = ?, title = ?, color = ?, role = ?, active = ? WHERE id = ?').run(next.name, next.title, next.color, next.role, next.active, u.id);
    if (b.authKey) db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashSecret(String(b.authKey)), u.id);
    res.json(publicUser(userRow(u.id)));
  });

  // ---------- Synchronisation ----------
  api.get('/sync', auth, (req, res) => {
    const tid = req.user.tenant_id;
    if (!tid) fail(400, 'no_tenant', 'Ce compte n’appartient à aucune entreprise.');
    const since = Math.max(0, Number(req.query.since) || 0);
    const rows = db.prepare('SELECT col, id, data, deleted, seq, updated_at, updated_by FROM records WHERE tenant_id = ? AND seq > ? ORDER BY seq LIMIT 2000').all(tid, since);
    const cursor = rows.length ? rows[rows.length - 1].seq : since;
    const t = tenantRow(tid);
    const tv = Number(req.query.tv) || 0;
    res.json({
      changes: rows.map((r) => ({ col: r.col, id: r.id, data: JSON.parse(r.data), deleted: !!r.deleted, seq: r.seq, updatedAt: r.updated_at, updatedBy: r.updated_by })),
      cursor,
      more: rows.length === 2000,
      tenant: publicTenant(t, t.version !== tv),
      licence: publicLicence(licenceRow(tid), tid),
      team: team(tid),
      user: publicUser(req.user),
    });
  });

  api.post('/sync', auth, (req, res) => {
    const tid = req.user.tenant_id;
    if (!tid) fail(400, 'no_tenant', 'Ce compte n’appartient à aucune entreprise.');
    requireUsableLicence(tid);
    const changes = Array.isArray(req.body.changes) ? req.body.changes : [];
    if (changes.length > 500) fail(413, 'too_many_changes', 'Trop de modifications en une fois.');
    const accepted = [];
    const rejected = [];
    tx(db, () => {
      for (const c of changes) {
        if (!COLLECTIONS.includes(c.col) || !ID_RE.test(String(c.id || ''))) { rejected.push({ col: c.col, id: c.id, reason: 'invalid' }); continue; }
        if (c.col === 'objectives' && !OBJECTIVE_ROLES.includes(req.user.role)) { rejected.push({ col: c.col, id: c.id, reason: 'forbidden' }); continue; }
        const data = c.deleted ? {} : c.data;
        if (!c.deleted && (!data || typeof data !== 'object' || Array.isArray(data))) { rejected.push({ col: c.col, id: c.id, reason: 'invalid' }); continue; }
        const json = JSON.stringify(data);
        if (json.length > MAX_DOC) { rejected.push({ col: c.col, id: c.id, reason: 'too_large' }); continue; }
        const seq = nextSeq(db);
        db.prepare(`INSERT INTO records(tenant_id, col, id, data, deleted, seq, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id, col, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, seq = excluded.seq, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
          .run(tid, c.col, String(c.id), json, c.deleted ? 1 : 0, seq, nowIso(), req.user.id);
        accepted.push({ col: c.col, id: c.id, seq });
      }
    });
    res.json({ accepted, rejected });
  });

  // ---------- Console éditeur : licences ----------
  const sadmin = [auth, role('superadmin')];
  function licenceView(l) {
    const t = l.tenant_id ? tenantRow(l.tenant_id) : null;
    return {
      ...publicLicence(l, l.tenant_id), customer: l.customer || '', key: l.licence_key, createdAt: l.created_at, activatedAt: l.activated_at,
      tenant: t ? { id: t.id, name: t.name, logo: t.logo || '' } : null,
      owner: t ? (db.prepare("SELECT email, name FROM users WHERE tenant_id = ? AND role = 'owner' ORDER BY created_at LIMIT 1").get(t.id) || null) : null,
    };
  }
  api.get('/admin/licences', ...sadmin, (req, res) => {
    const rows = db.prepare('SELECT * FROM licences ORDER BY created_at DESC').all().map(licenceView);
    const stats = {
      companies: db.prepare('SELECT COUNT(*) AS n FROM tenants').get().n,
      users: db.prepare('SELECT COUNT(*) AS n FROM users WHERE tenant_id IS NOT NULL AND active = 1').get().n,
      active: rows.filter((l) => l.usable && l.tenant).length,
      available: rows.filter((l) => !l.tenant && l.usable).length,
      expired: rows.filter((l) => l.expired || l.status !== 'active').length,
    };
    res.json({ licences: rows, stats, plans: PLANS });
  });
  api.post('/admin/licences', ...sadmin, (req, res) => {
    const b = req.body || {};
    const plan = PLANS[b.plan] ? b.plan : 'pro';
    const maxUsers = Math.max(1, Math.min(1000, Number(b.maxUsers) || PLANS[plan].maxUsers));
    const months = Math.max(1, Math.min(120, Number(b.months) || 12));
    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt || '') ? b.expiresAt : addMonths(months);
    const id = licenceId();
    const customer = str(b.customer, 60);
    const key = createLicenceKey(secrets.privateKey, { id, plan, maxUsers, expiresAt, customer });
    db.prepare('INSERT INTO licences(id, plan, max_users, expires_at, customer, licence_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, plan, maxUsers, expiresAt, customer, key, nowIso());
    res.status(201).json(licenceView(db.prepare('SELECT * FROM licences WHERE id = ?').get(id)));
  });
  api.put('/admin/licences/:id', ...sadmin, (req, res) => {
    const l = db.prepare('SELECT * FROM licences WHERE id = ?').get(req.params.id);
    if (!l) fail(404, 'not_found', 'Licence introuvable.');
    const b = req.body || {};
    const status = ['active', 'suspended'].includes(b.status) ? b.status : l.status;
    const plan = PLANS[b.plan] ? b.plan : l.plan;
    const maxUsers = b.maxUsers != null ? Math.max(1, Math.min(1000, Number(b.maxUsers) || l.max_users)) : l.max_users;
    let expires = l.expires_at;
    if (/^\d{4}-\d{2}-\d{2}$/.test(b.expiresAt || '')) expires = b.expiresAt;
    if (b.extendMonths) {
      const base = new Date(Math.max(Date.parse(l.expires_at), Date.now()));
      base.setMonth(base.getMonth() + Math.min(120, Number(b.extendMonths) || 0));
      expires = base.toISOString().slice(0, 10);
    }
    db.prepare('UPDATE licences SET status = ?, plan = ?, max_users = ?, expires_at = ?, customer = COALESCE(?, customer) WHERE id = ?')
      .run(status, plan, maxUsers, expires, b.customer != null ? str(b.customer, 60) : null, l.id);
    res.json(licenceView(db.prepare('SELECT * FROM licences WHERE id = ?').get(l.id)));
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'Route inconnue.' }));

  // ---------- Application web ----------
  const pub = path.join(ROOT, 'public');
  app.get('/sw.js', (req, res) => { res.set('Cache-Control', 'no-cache'); res.sendFile(path.join(pub, 'sw.js')); });
  app.use(express.static(pub, { index: 'index.html', maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(pub, 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large', message: 'Contenu trop volumineux.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: 'Requête invalide.' });
    console.error(err);
    res.status(500).json({ error: 'server_error', message: 'Erreur interne du serveur.' });
  });

  app.locals.db = db;
  app.locals.secrets = secrets;
  return app;
}
