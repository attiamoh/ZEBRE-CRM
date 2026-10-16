import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { deriveAuthKey } from '../server/security.js';

let server;
let base;
let dataDir;
const ADMIN = { email: 'editeur@zebre.test', password: 'MotDePasse-Admin-1' };

async function call(method, url, body, token) {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const login = async (email, password) => (await call('POST', '/api/login', { email, authKey: deriveAuthKey(email, password) })).body.token;
async function newLicence(adminToken, extra = {}) {
  const r = await call('POST', '/api/admin/licences', { plan: 'essentiel', maxUsers: 2, months: 12, customer: 'Client test', ...extra }, adminToken);
  assert.equal(r.status, 201);
  return r.body;
}
async function register(key, email, company = 'Entreprise Test', ids = {}) {
  return call('POST', '/api/register', {
    licenceKey: key,
    company: { name: company, currency: 'FCFA', id: ids.tenantId },
    user: { name: 'Gérante Test', email, authKey: deriveAuthKey(email, 'secret-123'), id: ids.userId },
  });
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zebre-test-'));
  const app = createApp({ dataDir, dbFile: ':memory:', superadmin: ADMIN });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test('le super administrateur crée une licence signée', async () => {
  const token = await login(ADMIN.email, ADMIN.password);
  assert.ok(token);
  const lic = await newLicence(token);
  assert.match(lic.key, /^ZB1\.[\w-]+\.[\w-]+$/);
  const check = await call('POST', '/api/licence/check', { key: lic.key });
  assert.deepEqual([check.body.valid, check.body.used, check.body.maxUsers], [true, false, 2]);
  const forged = lic.key.slice(0, -4) + (lic.key.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal((await call('POST', '/api/licence/check', { key: forged })).body.valid, false);
});

test('une entreprise s’inscrit avec sa licence, une seule fois', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const lic = await newLicence(admin);
  const r = await register(lic.key, 'gerante@fournil.test', 'Boulangerie Le Fournil');
  assert.equal(r.status, 201);
  assert.equal(r.body.user.role, 'owner');
  assert.equal(r.body.licence.plan, 'essentiel');
  const again = await register(lic.key, 'autre@test.test', 'Concurrent');
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'licence_used');
});

test('une inscription faite hors ligne garde ses identifiants et peut être renvoyée', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const lic = await newLicence(admin);
  const ids = { tenantId: 'ten_local123', userId: 'usr_local123' };
  const first = await register(lic.key, 'horsligne@test.test', 'Hors Ligne SARL', ids);
  assert.equal(first.status, 201);
  assert.equal(first.body.tenant.id, ids.tenantId);
  const replay = await register(lic.key, 'horsligne@test.test', 'Hors Ligne SARL', ids);
  assert.equal(replay.status, 201, 'le renvoi de la même inscription est accepté');
});

test('synchronisation et isolation entre entreprises', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const a = (await register((await newLicence(admin)).key, 'a@a.test', 'A')).body.token;
  const b = (await register((await newLicence(admin)).key, 'b@b.test', 'B')).body.token;
  const push = await call('POST', '/api/sync', { changes: [{ col: 'contacts', id: 'ct-1', data: { company: 'Client de A' } }, { col: 'hack', id: 'x', data: {} }] }, a);
  assert.equal(push.body.accepted.length, 1);
  assert.equal(push.body.rejected.length, 1);
  const pullA = await call('GET', '/api/sync?since=0', null, a);
  assert.equal(pullA.body.changes.length, 1);
  assert.equal(pullA.body.changes[0].data.company, 'Client de A');
  const pullB = await call('GET', '/api/sync?since=0', null, b);
  assert.equal(pullB.body.changes.length, 0, 'B ne voit pas les données de A');
  const again = await call('GET', `/api/sync?since=${pullA.body.cursor}`, null, a);
  assert.equal(again.body.changes.length, 0);
});

test('le nombre d’utilisateurs est limité par la licence', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const owner = (await register((await newLicence(admin, { maxUsers: 2 })).key, 'patron@seat.test', 'Seat')).body.token;
  const add = (email) => call('POST', '/api/team', { name: 'Commercial', email, role: 'sales', authKey: deriveAuthKey(email, 'provisoire-1') }, owner);
  assert.equal((await add('c1@seat.test')).status, 201);
  const full = await add('c2@seat.test');
  assert.equal(full.status, 402);
  assert.equal(full.body.error, 'seats_full');
  const member = await login('c1@seat.test', 'provisoire-1');
  assert.equal((await call('PUT', '/api/tenant', { name: 'Pirate' }, member)).status, 403, 'un commercial ne modifie pas l’entreprise');
});

test('une licence expirée ou suspendue bloque les modifications', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const lic = await newLicence(admin);
  const owner = (await register(lic.key, 'exp@test.test', 'Exp')).body.token;
  await call('PUT', `/api/admin/licences/${lic.id}`, { expiresAt: '2020-01-01' }, admin);
  const blocked = await call('POST', '/api/sync', { changes: [{ col: 'contacts', id: 'c', data: {} }] }, owner);
  assert.equal(blocked.status, 402);
  assert.equal(blocked.body.error, 'licence_expired');
  await call('PUT', `/api/admin/licences/${lic.id}`, { extendMonths: 12 }, admin);
  assert.equal((await call('POST', '/api/sync', { changes: [{ col: 'contacts', id: 'c', data: {} }] }, owner)).status, 200);
  await call('PUT', `/api/admin/licences/${lic.id}`, { status: 'suspended' }, admin);
  assert.equal((await call('POST', '/api/sync', { changes: [] }, owner)).body.error, 'licence_suspended');
});

test('le logo et la couleur de l’entreprise sont personnalisables', async () => {
  const admin = await login(ADMIN.email, ADMIN.password);
  const owner = (await register((await newLicence(admin)).key, 'logo@test.test', 'Logo')).body.token;
  const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const r = await call('PUT', '/api/tenant', { logo, brandColor: '#1F6F5C' }, owner);
  assert.equal(r.status, 200);
  assert.equal(r.body.brandColor, '#1F6F5C');
  assert.equal((await call('PUT', '/api/tenant', { logo: 'javascript:alert(1)' }, owner)).status, 400);
  const sync = await call('GET', `/api/sync?since=0&tv=${r.body.version}`, null, owner);
  assert.equal(sync.body.tenant.logo, undefined, 'le logo n’est renvoyé que lorsqu’il change');
});

test('les routes protégées refusent les jetons absents ou falsifiés', async () => {
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', null, 'abc.def')).status, 401);
  const owner = await login('logo@test.test', 'secret-123');
  assert.equal((await call('GET', '/api/admin/licences', null, owner)).status, 403);
});
