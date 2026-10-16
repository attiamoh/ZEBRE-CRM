// Session d'un utilisateur : connexion en ligne ou hors ligne, inscription différée, synchronisation.
import { api, ApiError } from './api.js';
import { deriveAuthKey, verifierOf, readLicence, accounts, saveAccount, setCurrent, uuid } from './auth.js';
import { openStore } from './store.js';

const today = () => new Date().toISOString().slice(0, 10);
const ADMIN = ['owner', 'admin'];

async function seedMeta(store, res) {
  await store.setMeta('user', res.user);
  await store.setMeta('tenant', res.tenant);
  await store.setMeta('team', res.team);
  await store.setMeta('licence', res.licence);
}

// ---------- Connexion ----------
export async function login(email, password) {
  email = email.trim().toLowerCase();
  const authKey = await deriveAuthKey(email, password);
  const verifier = await verifierOf(authKey);
  try {
    const res = await api('POST', '/api/login', { email, authKey });
    if (res.user.role === 'superadmin') { const acc = saveAccount({ email, superadmin: true, token: res.token, verifier }); setCurrent(email); return acc; }
    const acc = saveAccount({ email, userId: res.user.id, tenantId: res.user.tenantId, verifier, token: res.token });
    const store = await openStore(acc.tenantId);
    await seedMeta(store, res);
    setCurrent(email);
    return acc;
  } catch (e) {
    if (!(e instanceof ApiError) || !e.offline) throw e;
    const acc = accounts()[email];
    if (!acc) throw new Error('Pas de connexion Internet. La première connexion sur un appareil doit se faire en ligne.');
    if (acc.verifier !== verifier) throw new Error('Mot de passe incorrect.');
    if (acc.superadmin) throw new Error('La console des licences nécessite une connexion Internet.');
    setCurrent(email);
    return acc;
  }
}

// ---------- Inscription d'une entreprise ----------
// En ligne : création immédiate sur le serveur. Hors ligne : la licence est vérifiée sur l'appareil,
// le compte est créé localement et l'inscription est envoyée dès le retour de la connexion.
export async function registerCompany({ licenceKey, companyName, currency, name, email, password }) {
  email = email.trim().toLowerCase();
  const lic = await readLicence(licenceKey);
  if (!lic) throw new Error('Clé de licence invalide. Vérifiez qu’elle a été copiée en entier.');
  if (lic.expiresAt < today()) throw new Error(`Cette licence a expiré le ${lic.expiresAt}.`);
  const authKey = await deriveAuthKey(email, password);
  const verifier = await verifierOf(authKey);
  const tenantId = uuid('ten');
  const userId = uuid('usr');
  const payload = {
    licenceKey: licenceKey.trim(),
    company: { id: tenantId, name: companyName.trim(), currency },
    user: { id: userId, name: name.trim(), email, authKey, title: 'Gérant(e)', color: '#B7791F' },
  };
  try {
    const res = await api('POST', '/api/register', payload);
    const acc = saveAccount({ email, userId: res.user.id, tenantId: res.tenant.id, verifier, token: res.token });
    await seedMeta(await openStore(acc.tenantId), res);
    setCurrent(email);
    return { acc, online: true };
  } catch (e) {
    if (!(e instanceof ApiError) || !e.offline) throw e;
    const acc = saveAccount({ email, userId, tenantId, verifier, token: null, pending: payload });
    const store = await openStore(tenantId);
    const user = { id: userId, email, name: payload.user.name, role: 'owner', title: payload.user.title, color: payload.user.color, active: true, tenantId };
    await seedMeta(store, {
      user,
      tenant: { id: tenantId, name: payload.company.name, currency, brandColor: '', logo: '', version: 0 },
      team: [user],
      licence: { ...lic, status: 'active', usable: true, expired: false, seatsUsed: 1 },
    });
    setCurrent(email);
    return { acc, online: false };
  }
}

// ---------- Session active ----------
export async function startSession(account) {
  const store = await openStore(account.tenantId);
  let acc = account;
  let status = { state: 'idle', message: '' };
  const statusListeners = new Set();
  let running = false;
  let again = false;
  let timer = 0;

  const setStatus = (state, message = '') => { status = { state, message }; statusListeners.forEach((fn) => fn(status)); };
  const saveAcc = (patch) => { acc = saveAccount({ ...acc, ...patch }); };

  async function completeRegistration() {
    const res = await api('POST', '/api/register', acc.pending);
    saveAcc({ token: res.token, pending: null, userId: res.user.id });
    await store.setMeta('user', res.user);
    await store.setMeta('team', res.team);
    await store.setMeta('licence', res.licence);
    if (!store.meta.tenantDirty) await store.setMeta('tenant', res.tenant);
  }

  async function syncNow() {
    if (running) { again = true; return; }
    running = true;
    setStatus('syncing');
    try {
      if (!navigator.onLine) throw new ApiError(0, 'offline', '');
      if (acc.pending) await completeRegistration();
      if (!acc.token) { setStatus('auth', 'Reconnectez-vous pour synchroniser vos données.'); return; }
      if (store.meta.tenantDirty && ADMIN.includes((store.meta.user || {}).role)) {
        const t = store.meta.tenant;
        const saved = await api('PUT', '/api/tenant', { name: t.name, currency: t.currency, brandColor: t.brandColor || '', logo: t.logo || '' }, acc.token);
        await store.setMeta('tenant', saved);
        await store.setMeta('tenantDirty', false);
      }
      await store.push(acc.token);
      await store.pull(acc.token);
      setStatus('ok');
    } catch (e) {
      if (e instanceof ApiError && e.offline) setStatus('offline');
      else if (e.status === 401) { saveAcc({ token: null }); setStatus('auth', 'Votre session a expiré. Reconnectez-vous pour synchroniser.'); }
      else if (e.status === 402) { await store.pull(acc.token).catch(() => {}); setStatus('licence', e.message); }
      else setStatus('error', e.message || 'La synchronisation a échoué.');
    } finally {
      running = false;
      if (again) { again = false; scheduleSync(300); }
    }
  }
  function scheduleSync(delay = 800) { clearTimeout(timer); timer = setTimeout(syncNow, delay); }

  const onOnline = () => syncNow();
  const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', onVisible);
  const poll = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 20000);
  store.on((kind) => { if (kind === 'local') scheduleSync(); });

  const me = () => store.meta.user || {};
  const session = {
    store,
    get account() { return acc; },
    get status() { return status; },
    me,
    tenant: () => store.meta.tenant || {},
    team: () => store.meta.team || [me()],
    licence: () => store.meta.licence || {},
    isAdmin: () => ADMIN.includes(me().role),
    canEditObjectives: () => ['owner', 'admin', 'manager'].includes(me().role),
    canWrite: () => { const l = store.meta.licence || {}; return l.usable !== false && l.expiresAt >= today() && status.state !== 'licence'; },
    onStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); },
    syncNow,
    scheduleSync,
    async saveTenant(patch) {
      await store.setMeta('tenant', { ...store.meta.tenant, ...patch });
      await store.setMeta('tenantDirty', true);
      scheduleSync(100);
    },
    async call(method, path, body) {
      if (!acc.token) throw new ApiError(401, 'unauthenticated', acc.pending ? 'Votre inscription n’est pas encore envoyée au serveur. Connectez-vous à Internet puis réessayez.' : 'Reconnectez-vous pour faire cette action.');
      try { return await api(method, path, body, acc.token); } catch (e) {
        if (e.status === 401) { saveAcc({ token: null }); setStatus('auth', 'Votre session a expiré. Reconnectez-vous pour synchroniser.'); }
        throw e;
      }
    },
    async refreshTeam() {
      const r = await session.call('GET', '/api/team');
      await store.setMeta('team', r.team);
      await store.setMeta('licence', r.licence);
    },
    async changePassword(oldPassword, newPassword) {
      const email = acc.email;
      const oldAuthKey = await deriveAuthKey(email, oldPassword);
      const newAuthKey = await deriveAuthKey(email, newPassword);
      await session.call('POST', '/api/password', { oldAuthKey, newAuthKey });
      saveAcc({ verifier: await verifierOf(newAuthKey) });
    },
    async relogin(password) {
      const fresh = await login(acc.email, password);
      acc = fresh;
      syncNow();
    },
    stop() {
      clearInterval(poll);
      clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
  return session;
}
