// Interface du CRM : modules commerciaux, paramètres de l'entreprise et équipe.
// Les données viennent du stockage local (store.js) et sont synchronisées par la session (session.js).
import { makeDemo } from './demo.js';
import { COLLECTIONS } from './store.js';
import { deriveAuthKey } from './auth.js';

export function mountCrm(session, { onLogout }) {
  const store = session.store;

  // ---------- Référentiels ----------
  const STAGES = [
    { id: 'nouveau', label: 'Nouveau', prob: 10, color: '#8A9189' },
    { id: 'qualifie', label: 'Qualifié', prob: 25, color: '#2C6A88' },
    { id: 'proposition', label: 'Proposition', prob: 50, color: '#7A4E9C' },
    { id: 'negociation', label: 'Négociation', prob: 75, color: '#B7791F' },
    { id: 'gagne', label: 'Gagné', prob: 100, color: '#2B7A4B' },
    { id: 'perdu', label: 'Perdu', prob: 0, color: '#B23A30' },
  ];
  const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const OPEN = (d) => d.stage !== 'gagne' && d.stage !== 'perdu';
  const ACT_TYPES = { appel: 'Appel', whatsapp: 'WhatsApp', email: 'E-mail', relance: 'Relance', visite: 'Visite' };
  const SOURCES = ['WhatsApp', 'Appel entrant', 'Site web', 'Salon', 'Recommandation', 'Prospection terrain', 'Réseaux sociaux', 'Autre'];
  const REP_COLORS = ['#B7791F', '#2F6F8F', '#7A4E9C', '#3C8B5A', '#B23A30', '#4B5563', '#9C4E7A', '#2E7D7D'];
  const COLS = COLLECTIONS;
  const ROLE_LABEL = { owner: 'Propriétaire', admin: 'Administrateur', manager: 'Manager', sales: 'Commercial' };
  const VIEWS = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'home' },
    { id: 'contacts', label: 'Prospects & clients', icon: 'users' },
    { id: 'pipeline', label: 'Opportunités', icon: 'columns' },
    { id: 'actions', label: 'Relances & actions', icon: 'bell' },
    { id: 'planning', label: 'Rendez-vous & planning', icon: 'cal' },
    { id: 'objectives', label: 'Objectifs & performances', icon: 'target' },
    { id: 'reports', label: 'Rapports d’équipe', icon: 'chart' },
  ];

  const ICONS = {
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.3-1.4M17.7 6.3l1.4-1.4"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .8 3.2 2.6 3.5 5.2"/>',
    columns: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 6l-6 6 6 6"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    appel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.2 1.8.8-.4 1.4c-3.4.4-7.5-3.7-7.1-7.1l1.4-.4.8 1.8z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    relance: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    visite: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  // ---------- Utilitaires ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k, d) => { try { const v = localStorage.getItem('zebre-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem('zebre-' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoMonth = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const parseDT = (s) => { if (!s) return null; const d = parseDate(s); const [h, mi] = (s.slice(11, 16) || '00:00').split(':').map(Number); d.setHours(h || 0, mi || 0); return d; };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const todayISO = () => isoDate(new Date());
  const fmtDay = (s) => { const d = parseDate(s); return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—'; };
  const fmtDayLong = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtTime = (d) => `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); const s = new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return s[0].toUpperCase() + s.slice(1); };
  const shiftMonth = (m, n) => { const [y, mo] = m.split('-').map(Number); return isoMonth(new Date(y, mo - 1 + n, 1)); };
  const cur = () => settings().currency || 'FCFA';
  const money = (n) => `${Math.round(n || 0).toLocaleString('fr-FR')} ${cur()}`;
  const moneyShort = (n) => {
    const a = Math.abs(n || 0);
    if (a >= 1e9) return `${(n / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md ${cur()}`;
    if (a >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M ${cur()}`;
    if (a >= 1e4) return `${Math.round(n / 1e3).toLocaleString('fr-FR')} k ${cur()}`;
    return money(n);
  };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  // ---------- État ----------
  const ui = {
    view: VIEWS.some((v) => v.id === location.hash.slice(1)) ? location.hash.slice(1) : lsGet('view', 'dashboard'),
    scope: lsGet('scope', 'team'),
    contactType: 'all', contactOwner: '', contactSource: '', contactQuery: '',
    actionTab: 'late',
    weekStart: startOfWeek(new Date()),
    objMonth: isoMonth(new Date()),
    period: 'month',
    drawer: null,
    dragging: false,
    pendingRender: false,
    search: '',
    lastView: '',
  };
  Object.defineProperty(ui, 'me', { get: () => session.me().id || '' });
  const isReadOnly = () => !session.canWrite();

  const list = (c) => store.list(c);
  const get = (c, id) => store.get(c, id);
  const settings = () => session.tenant();
  const teamAll = () => session.team().map((u) => ({ ...u, role: u.title || ROLE_LABEL[u.role] || '', access: u.role }));
  const reps = () => teamAll().filter((u) => u.active !== false).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const rep = (id) => teamAll().find((u) => u.id === id);
  const contact = (id) => get('contacts', id);
  const inScope = (x) => ui.scope !== 'me' || !ui.me || x.ownerId === ui.me;
  const defaultOwner = () => (ui.me && rep(ui.me) ? ui.me : (reps()[0] || {}).id || '');

  // ---------- Persistance (locale d'abord, synchronisée ensuite) ----------
  function blockedMessage() {
    const l = session.licence();
    if (session.status.state === 'licence') return session.status.message;
    return l.status === 'suspended' ? 'La licence de votre entreprise est suspendue. Contactez ZEBRE CRM.' : `La licence de votre entreprise a expiré${l.expiresAt ? ' le ' + fmtDay(l.expiresAt) : ''}. Contactez ZEBRE CRM pour la renouveler.`;
  }
  async function put(col, id, data) {
    if (isReadOnly()) { toast(blockedMessage()); return false; }
    try { await store.put(col, id, data); return true; } catch (e) { console.error(e); toast('Enregistrement impossible sur cet appareil (stockage plein ou bloqué).'); return false; }
  }
  async function del(col, id) {
    if (isReadOnly()) { toast(blockedMessage()); return false; }
    try { await store.del(col, id); return true; } catch (e) { console.error(e); toast('Suppression impossible sur cet appareil.'); return false; }
  }
  async function loadDemo() {
    if (isReadOnly()) { toast(blockedMessage()); return; }
    const demo = makeDemo(new Date(), reps().map((r) => r.id));
    toast('Chargement des données de démonstration…');
    for (const c of COLS) {
      if (c === 'objectives' && !session.canEditObjectives()) continue;
      for (const x of demo[c]) { if (!(await put(c, x.id, x))) return; }
    }
    toast('Données de démonstration chargées. Elles seront partagées avec l’équipe à la prochaine synchronisation.');
  }
  async function clearDemo() {
    const targets = [];
    COLS.forEach((c) => list(c).forEach((x) => { if (x.demo) targets.push([c, x.id]); }));
    for (const [c, id] of targets) { if (!(await del(c, id))) return; }
    toast(`${targets.length} éléments de démonstration supprimés.`);
  }

  // ---------- Calculs ----------
  const wonIn = (from, to, owner) => list('deals').filter((d) => d.stage === 'gagne' && d.closeDate >= from && d.closeDate <= to && (!owner || d.ownerId === owner));
  const lostIn = (from, to, owner) => list('deals').filter((d) => d.stage === 'perdu' && d.closeDate >= from && d.closeDate <= to && (!owner || d.ownerId === owner));
  const doneIn = (from, to, owner) => list('actions').filter((a) => a.done && (a.doneAt || a.due) >= from && (a.doneAt || a.due) <= to && (!owner || a.ownerId === owner));
  const monthRange = (m) => { const [y, mo] = m.split('-').map(Number); return [`${m}-01`, isoDate(new Date(y, mo, 0))]; };
  const sum = (arr, f = (x) => x.amount) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const weighted = (d) => (Number(d.amount) || 0) * (STAGE[d.stage] ? STAGE[d.stage].prob : 0) / 100;
  function actionState(a) {
    if (a.done) return 'done';
    const t = todayISO();
    if (a.due < t) return 'late';
    if (a.due === t) return 'today';
    return 'next';
  }
  const lateCount = () => list('actions').filter((a) => inScope(a) && actionState(a) === 'late').length;
  function nextActionFor(contactId) {
    return list('actions').filter((a) => a.contactId === contactId && !a.done).sort((a, b) => a.due.localeCompare(b.due))[0];
  }

  // ---------- Petits composants ----------
  const ownerChip = (id, withName = true) => {
    const r = rep(id);
    if (!r) return '<span class="muted">Non attribué</span>';
    return `<span class="owner"><span class="av" style="background:${esc(r.color)}">${esc(initials(r.name))}</span>${withName ? esc(r.name) : ''}</span>`;
  };
  const typePill = (t) => (t === 'client' ? '<span class="pill client">Client</span>' : '<span class="pill prospect">Prospect</span>');
  const statePill = (a) => {
    const s = actionState(a);
    if (s === 'late') return `<span class="pill late">En retard · ${esc(fmtDay(a.due))}</span>`;
    if (s === 'today') return '<span class="pill today">Aujourd’hui</span>';
    if (s === 'done') return `<span class="pill">Fait ${a.doneAt ? '· ' + esc(fmtDay(a.doneAt)) : ''}</span>`;
    return `<span class="pill">${esc(fmtDay(a.due))}</span>`;
  };
  const meter = (v, max, ok) => `<div class="meter ${ok ? 'ok' : ''}"><i style="width:${Math.min(100, pct(v, max))}%"></i></div>`;
  const opt = (value, label, sel) => `<option value="${esc(value)}" ${String(value) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;
  const repOptions = (sel, allLabel) => (allLabel !== undefined ? opt('', allLabel, sel) : '') + reps().map((r) => opt(r.id, r.name, sel)).join('');

  function actionRow(a, opts = {}) {
    const c = contact(a.contactId);
    const d = a.dealId ? get('deals', a.dealId) : null;
    return `<div class="row ${a.done ? 'done' : ''}">
      <button class="check ${a.done ? 'on' : ''}" data-act="toggle-action" data-id="${esc(a.id)}" aria-label="${a.done ? 'Marquer comme à faire' : 'Marquer comme fait'}">${a.done ? icon('check') : ''}</button>
      <span class="type" title="${esc(ACT_TYPES[a.type] || '')}">${icon(a.type)}</span>
      <div class="body" data-act="edit-action" data-id="${esc(a.id)}">
        <b>${esc(a.title)}</b>
        <small>${c ? esc(c.company) : 'Sans contact'}${d ? ' · ' + esc(d.title) : ''}</small>
      </div>
      ${opts.noOwner ? '' : ownerChip(a.ownerId, false)}
      ${statePill(a)}
    </div>`;
  }

  // ---------- Coquille ----------
  const ago = (iso) => {
    if (!iso) return '';
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`;
  };
  function applyBrand() {
    const t = settings();
    const root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(t.brandColor || '')) root.style.setProperty('--brand', t.brandColor); else root.style.removeProperty('--brand');
    document.title = `${t.name || 'ZEBRE CRM'} · ZEBRE CRM`;
  }
  const brandMark = (cls = '') => {
    const t = settings();
    return t.logo ? `<img class="logo ${cls}" src="${esc(t.logo)}" alt="Logo ${esc(t.name || '')}">` : `<span class="mark ${cls}" aria-hidden="true"></span>`;
  };

  function shell() {
    document.getElementById('app').innerHTML = `
      <div class="app">
        <aside class="side">
          <div class="brand" id="brand"></div>
          <nav class="nav" id="nav" aria-label="Modules"></nav>
          <div class="side-foot">
            <button class="sync" id="sync" data-act="sync-click"><i></i><span>…</span></button>
            <div class="menu-wrap up">
              <button class="me-card" id="me-card" data-act="user-menu" aria-haspopup="menu"></button>
              <div class="menu" id="user-menu" hidden role="menu">
                <button data-act="settings" role="menuitem">${icon('gear')} Paramètres & équipe</button>
                <button data-act="password" role="menuitem">${icon('key')} Changer mon mot de passe</button>
                <button data-act="theme" role="menuitem" id="theme-item">${icon('moon')} Thème sombre</button>
                <button data-act="logout" role="menuitem">${icon('logout')} Se déconnecter</button>
              </div>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="top">
            <h1 id="view-title"></h1>
            <div class="search">${icon('search')}<input id="global-search" type="search" placeholder="Rechercher un contact, une opportunité…" autocomplete="off" aria-label="Recherche"><div class="results" id="search-results" hidden></div></div>
            <div class="menu-wrap"><button class="btn primary" data-act="new-menu" aria-haspopup="menu">${icon('plus')} Nouveau</button>
              <div class="menu" id="new-menu" hidden role="menu">
                <button data-act="new-contact" role="menuitem">${icon('users')} Prospect ou client</button>
                <button data-act="new-deal" role="menuitem">${icon('columns')} Opportunité</button>
                <button data-act="new-action" role="menuitem">${icon('bell')} Relance ou action</button>
                <button data-act="new-meeting" role="menuitem">${icon('cal')} Rendez-vous</button>
              </div>
            </div>
          </header>
          <main class="content" id="content"></main>
        </div>
      </div>
      <div id="drawer-root"></div><div id="modal-root"></div><div id="toast-root"></div>`;
  }

  function syncLabel() {
    const st = session.status.state;
    const n = store.pending();
    const waiting = n ? ` · ${n} en attente` : '';
    if (session.account.pending && st !== 'error') return ['warn', 'Inscription en attente d’envoi', 'Votre entreprise sera enregistrée sur le serveur dès le retour de la connexion.'];
    if (st === 'syncing') return ['busy', 'Synchronisation…', ''];
    if (st === 'offline') return ['warn', `Hors ligne${waiting}`, 'Vous pouvez continuer à travailler. Les modifications partiront au retour de la connexion.'];
    if (st === 'auth') return ['bad', 'Reconnexion nécessaire', session.status.message];
    if (st === 'licence') return ['bad', 'Licence inactive', session.status.message];
    if (st === 'error') return ['bad', 'Synchronisation en échec', session.status.message];
    return ['ok', `À jour ${ago(store.meta.lastSync)}${waiting}`, 'Cliquez pour synchroniser maintenant.'];
  }

  function renderChrome() {
    const late = lateCount();
    const t = settings();
    $('#brand').innerHTML = `${brandMark()}<div><b>${esc(t.name || 'ZEBRE CRM')}</b><small>ZEBRE CRM · ${esc(session.licence().planLabel || '')}</small></div>`;
    $('#nav').innerHTML = VIEWS.map((v) => `<button data-act="go" data-view="${v.id}" ${ui.view === v.id ? 'aria-current="page"' : ''}>${icon(v.icon)}<span>${esc(v.label)}</span>${v.id === 'actions' && late ? `<span class="count">${late}</span>` : ''}</button>`).join('');
    $('#view-title').textContent = VIEWS.find((v) => v.id === ui.view).label;
    const m = session.me();
    $('#me-card').innerHTML = `<span class="av" style="background:${esc(m.color || '#B7791F')}">${esc(initials(m.name))}</span><span class="who-txt"><b>${esc(m.name || '')}</b><small>${esc(ROLE_LABEL[m.role] || '')}</small></span>`;
    const [kind, label, title] = syncLabel();
    const sync = $('#sync');
    sync.className = `sync ${kind}`;
    sync.title = title || '';
    sync.querySelector('span').textContent = label;
    const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    $('#theme-item').innerHTML = `${icon(dark ? 'sun' : 'moon')} ${dark ? 'Thème clair' : 'Thème sombre'}`;
    applyBrand();
  }

  function banners() {
    const out = [];
    const l = session.licence();
    const st = session.status;
    const days = l.expiresAt ? Math.ceil((parseDate(l.expiresAt) - parseDate(todayISO())) / 86400000) : null;
    if (session.account.pending) out.push(`<div class="banner info"><span><b>Entreprise créée sur cet appareil.</b> Elle sera enregistrée sur le serveur dès le retour de la connexion Internet. Vous pouvez travailler normalement en attendant.</span><button class="btn sm" data-act="sync-click">Réessayer maintenant</button></div>`);
    if (isReadOnly()) out.push(`<div class="banner bad"><span><b>Modifications bloquées.</b> ${esc(blockedMessage())}</span></div>`);
    else if (days != null && days <= 15) out.push(`<div class="banner warn"><span><b>Votre licence ${esc(l.planLabel || '')} expire ${days <= 0 ? 'aujourd’hui' : `dans ${days} jour${days > 1 ? 's' : ''}`}.</b> Contactez ZEBRE CRM pour la renouveler sans interruption.</span></div>`);
    if (st.state === 'auth') out.push(`<div class="banner bad"><span><b>Reconnexion nécessaire.</b> ${esc(st.message)} Vos données restent enregistrées sur cet appareil.</span><button class="btn sm" data-act="relogin">Se reconnecter</button></div>`);
    if (st.state === 'error') out.push(`<div class="banner bad"><span><b>La synchronisation a échoué.</b> ${esc(st.message)}</span><button class="btn sm" data-act="sync-click">Réessayer</button></div>`);
    const demoCount = COLS.reduce((n, c) => n + list(c).filter((x) => x.demo).length, 0);
    if (demoCount) out.push(`<div class="banner"><span><b>Données de démonstration.</b> Les entreprises et chiffres affichés sont des exemples fictifs.</span><button class="btn sm" data-act="settings">Les supprimer</button></div>`);
    return out.join('');
  }

  function render() {
    if (ui.dragging) { ui.pendingRender = true; return; }
    renderChrome();
    const el = $('#content');
    const entering = ui.lastView !== ui.view;
    ui.lastView = ui.view;
    if (!list('contacts').length && !list('deals').length) {
      el.innerHTML = banners() + `<div class="empty-state hero-empty">${brandMark('xl')}<h2>Bienvenue dans ${esc(settings().name || 'ZEBRE CRM')}</h2>
        <p>Centralisez ici vos prospects, opportunités, relances et rendez-vous. Ajoutez votre premier prospect, invitez votre équipe ou découvrez l’outil avec un jeu de démonstration.</p>
        <div class="actions-bar"><button class="btn primary" data-act="new-contact">${icon('plus')} Ajouter un prospect</button>${session.isAdmin() ? '<button class="btn" data-act="settings">Inviter mon équipe</button>' : ''}<button class="btn" data-act="load-demo">Charger la démonstration</button></div></div>`;
    } else {
      el.innerHTML = banners() + (VIEW_RENDER[ui.view] || VIEW_RENDER.dashboard)();
    }
    if (entering) {
      el.classList.remove('enter');
      void el.offsetWidth;
      el.classList.add('enter');
      countUp(el);
    }
    if (ui.drawer) renderDrawer();
  }
  function scheduleRender() {
    if (scheduleRender.t) return;
    scheduleRender.t = requestAnimationFrame(() => { scheduleRender.t = 0; render(); });
  }
  // Animation des chiffres clés à l'arrivée sur une vue.
  function countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach((node) => {
      const target = Number(node.dataset.count) || 0;
      const fmt = node.dataset.fmt === 'money' ? moneyShort : (v) => Math.round(v).toLocaleString('fr-FR');
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / 700);
        node.textContent = fmt(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1 && node.isConnected) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  const scopeToggle = () => `<div class="seg" role="group" aria-label="Périmètre">
    <button data-act="scope" data-v="team" aria-pressed="${ui.scope === 'team'}">Équipe</button>
    <button data-act="scope" data-v="me" aria-pressed="${ui.scope === 'me'}">Mes données</button></div>`;

  // ---------- Vues ----------
  const VIEW_RENDER = {};

  VIEW_RENDER.dashboard = () => {
    const now = new Date();
    const m = isoMonth(now);
    const [from, to] = monthRange(m);
    const owner = ui.scope === 'me' ? ui.me : '';
    const won = wonIn(from, to, owner);
    const objs = list('objectives').filter((o) => o.month === m && (!owner || o.repId === owner));
    const target = sum(objs, (o) => o.targetRevenue);
    const open = list('deals').filter((d) => OPEN(d) && inScope(d));
    const late = list('actions').filter((a) => inScope(a) && actionState(a) === 'late');
    const today = list('actions').filter((a) => inScope(a) && actionState(a) === 'today');
    const t = todayISO();
    const meetToday = list('meetings').filter((x) => inScope(x) && x.start.slice(0, 10) === t).sort((a, b) => a.start.localeCompare(b.start));
    const me = rep(ui.me);
    const todo = [...late.sort((a, b) => a.due.localeCompare(b.due)), ...today];
    const byStage = STAGES.filter((s) => OPEN({ stage: s.id })).map((s) => ({ s, deals: open.filter((d) => d.stage === s.id) }));
    const maxStage = Math.max(1, ...byStage.map((x) => sum(x.deals)));
    const recentWon = list('deals').filter((d) => d.stage === 'gagne' && inScope(d)).sort((a, b) => b.closeDate.localeCompare(a.closeDate)).slice(0, 5);
    return `
      <div class="toolbar"><div class="grow"><h2 style="font-size:18px">Bonjour${me ? ' ' + esc(me.name.split(' ')[0]) : ''}</h2><span class="muted">${esc(fmtDayLong(now))}</span></div>${scopeToggle()}</div>
      <section class="kpis">
        <div class="kpi"><span class="lbl">CA signé · ${esc(monthLabel(m))}</span><span class="val" data-count="${sum(won)}" data-fmt="money">${esc(moneyShort(sum(won)))}</span>
          ${target ? `${meter(sum(won), target, sum(won) >= target)}<span class="note">${pct(sum(won), target)} % de l’objectif (${esc(moneyShort(target))})</span>` : '<span class="note">Aucun objectif défini ce mois</span>'}</div>
        <div class="kpi"><span class="lbl">Pipeline pondéré</span><span class="val" data-count="${sum(open, weighted)}" data-fmt="money">${esc(moneyShort(sum(open, weighted)))}</span><span class="note">${open.length} opportunités ouvertes · ${esc(moneyShort(sum(open)))} brut</span></div>
        <div class="kpi ${late.length ? 'bad' : ''}"><span class="lbl">Relances en retard</span><span class="val" data-count="${late.length}">${late.length}</span><span class="note">${today.length} prévues aujourd’hui</span></div>
        <div class="kpi"><span class="lbl">Rendez-vous aujourd’hui</span><span class="val" data-count="${meetToday.length}">${meetToday.length}</span><span class="note">${meetToday[0] ? 'Prochain à ' + esc(fmtTime(parseDT(meetToday[0].start))) : 'Journée libre'}</span></div>
      </section>
      <div class="grid2">
        <section class="panel"><header><h2>À faire aujourd’hui</h2><span class="sub">${todo.length} actions</span><button class="btn sm right" data-act="go" data-view="actions">Tout voir</button></header>
          <div class="list">${todo.slice(0, 8).map((a) => actionRow(a)).join('') || '<p class="empty">Rien en attente. Toutes les relances sont à jour.</p>'}</div></section>
        <section class="panel"><header><h2>Agenda du jour</h2><button class="btn sm right" data-act="go" data-view="planning">Planning</button></header>
          <div class="list">${meetToday.map((x) => { const c = contact(x.contactId); const d = parseDT(x.start); return `<div class="row"><span class="type">${icon('cal')}</span><div class="body" data-act="edit-meeting" data-id="${esc(x.id)}"><b>${esc(fmtTime(d))} · ${esc(x.title)}</b><small>${esc(x.location || '')}${c ? ' · ' + esc(c.name) : ''} · ${x.durationMin} min</small></div>${ownerChip(x.ownerId, false)}</div>`; }).join('') || '<p class="empty">Aucun rendez-vous aujourd’hui.</p>'}</div></section>
      </div>
      <div class="grid2">
        <section class="panel"><header><h2>Pipeline par étape</h2><span class="sub">Montants bruts des opportunités ouvertes</span></header>
          <div class="hbars">${byStage.map(({ s, deals }) => `<div class="hbar"><span>${esc(s.label)} <span class="muted">(${deals.length})</span></span><div class="track"><i style="width:${pct(sum(deals), maxStage)}%;background:${s.color}"></i></div><span class="money">${esc(moneyShort(sum(deals)))}</span></div>`).join('')}</div></section>
        <section class="panel"><header><h2>Dernières affaires gagnées</h2></header>
          <div class="list">${recentWon.map((d) => { const c = contact(d.contactId); return `<div class="row"><div class="body" data-act="edit-deal" data-id="${esc(d.id)}"><b>${esc(d.title)}</b><small>${c ? esc(c.company) : ''} · ${esc(fmtDay(d.closeDate))}</small></div>${ownerChip(d.ownerId, false)}<span class="money">${esc(moneyShort(d.amount))}</span></div>`; }).join('') || '<p class="empty">Pas encore d’affaire gagnée.</p>'}</div></section>
      </div>`;
  };

  VIEW_RENDER.contacts = () => {
    const q = ui.contactQuery.trim().toLowerCase();
    const rows = list('contacts')
      .filter((c) => ui.contactType === 'all' || c.type === ui.contactType)
      .filter((c) => !ui.contactOwner || c.ownerId === ui.contactOwner)
      .filter((c) => !ui.contactSource || c.source === ui.contactSource)
      .filter((c) => !q || [c.company, c.name, c.city, c.phone, c.email].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.company.localeCompare(b.company, 'fr'));
    const all = list('contacts');
    const counts = { all: all.length, prospect: all.filter((c) => c.type === 'prospect').length, client: all.filter((c) => c.type === 'client').length };
    return `
      <div class="toolbar">
        <div class="seg" role="group" aria-label="Type">
          ${[['all', 'Tous'], ['prospect', 'Prospects'], ['client', 'Clients']].map(([v, l]) => `<button data-act="ctype" data-v="${v}" aria-pressed="${ui.contactType === v}">${l} <span class="muted">${counts[v]}</span></button>`).join('')}
        </div>
        <input id="contact-q" class="grow" type="search" placeholder="Filtrer par nom, ville, téléphone…" value="${esc(ui.contactQuery)}" aria-label="Filtrer les contacts">
        <select id="contact-owner" aria-label="Responsable">${repOptions(ui.contactOwner, 'Tous les commerciaux')}</select>
        <select id="contact-source" aria-label="Source">${opt('', 'Toutes les sources', ui.contactSource)}${SOURCES.map((s) => opt(s, s, ui.contactSource)).join('')}</select>
        <button class="btn primary" data-act="new-contact">${icon('plus')} Ajouter</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Entreprise · contact</th><th>Statut</th><th>Ville</th><th>Source</th><th>Responsable</th><th class="num">Pipeline ouvert</th><th>Prochaine action</th></tr></thead>
        <tbody>${rows.map((c) => {
          const open = list('deals').filter((d) => d.contactId === c.id && OPEN(d));
          const na = nextActionFor(c.id);
          return `<tr class="click" data-act="open-contact" data-id="${esc(c.id)}">
            <td class="cell-main"><b>${esc(c.company)}</b><small>${esc(c.name)}${c.title ? ' · ' + esc(c.title) : ''}</small></td>
            <td>${typePill(c.type)}</td><td>${esc(c.city || '—')}</td><td>${esc(c.source || '—')}</td><td>${ownerChip(c.ownerId)}</td>
            <td class="num">${open.length ? `<span class="money">${esc(moneyShort(sum(open)))}</span> <span class="muted">(${open.length})</span>` : '<span class="muted">—</span>'}</td>
            <td>${na ? statePill(na) : '<span class="pill late">Aucune relance</span>'}</td></tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">Aucun contact ne correspond à ces filtres.</td></tr>'}</tbody>
      </table></div>`;
  };

  VIEW_RENDER.pipeline = () => {
    const deals = list('deals').filter(inScope);
    const open = deals.filter(OPEN);
    const t = todayISO();
    return `
      <div class="toolbar"><div class="grow muted">Glissez une carte d’une colonne à l’autre pour changer son étape. ${open.length} opportunités ouvertes, ${esc(moneyShort(sum(open)))} au total, ${esc(moneyShort(sum(open, weighted)))} pondérés.</div>${scopeToggle()}<button class="btn primary" data-act="new-deal">${icon('plus')} Opportunité</button></div>
      <div class="board-wrap"><div class="board">${STAGES.map((s) => {
        let items = deals.filter((d) => d.stage === s.id);
        if (!OPEN({ stage: s.id })) items = items.sort((a, b) => b.closeDate.localeCompare(a.closeDate)).slice(0, 12);
        else items = items.sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''));
        const total = deals.filter((d) => d.stage === s.id);
        return `<div class="col" data-stage="${s.id}">
          <header><span class="t"><span class="stage-dot" style="background:${s.color}"></span>${esc(s.label)}<span class="n">${total.length}</span></span><span class="sum">${esc(moneyShort(sum(total)))}${OPEN({ stage: s.id }) ? ` · ${s.prob} %` : ''}</span></header>
          ${items.map((d) => { const c = contact(d.contactId); const late = OPEN(d) && d.closeDate && d.closeDate < t; return `<article class="card" draggable="true" data-id="${esc(d.id)}" data-act="edit-deal" tabindex="0">
            <b>${esc(d.title)}</b><span class="co">${c ? esc(c.company) : 'Sans contact'}</span>
            <div class="meta"><span class="money">${esc(moneyShort(d.amount))}</span><span class="${late ? 'late' : 'muted'}">${d.closeDate ? esc(fmtDay(d.closeDate)) : ''}</span>${ownerChip(d.ownerId, false)}</div></article>`; }).join('')}
          ${total.length > items.length ? `<span class="muted" style="font-size:12px;padding:0 4px">+ ${total.length - items.length} plus anciennes (voir Rapports)</span>` : ''}
        </div>`;
      }).join('')}</div></div>`;
  };

  VIEW_RENDER.actions = () => {
    const acts = list('actions').filter(inScope);
    const groups = { late: [], today: [], next: [], done: [] };
    acts.forEach((a) => groups[actionState(a)].push(a));
    groups.late.sort((a, b) => a.due.localeCompare(b.due));
    groups.next.sort((a, b) => a.due.localeCompare(b.due));
    groups.done.sort((a, b) => (b.doneAt || b.due).localeCompare(a.doneAt || a.due));
    const tabs = [['late', 'En retard'], ['today', 'Aujourd’hui'], ['next', 'À venir'], ['done', 'Terminées']];
    const items = groups[ui.actionTab].slice(0, ui.actionTab === 'done' ? 50 : 500);
    const noFollow = list('contacts').filter((c) => inScope(c) && c.type === 'prospect' && !nextActionFor(c.id));
    return `
      <div class="toolbar"><div class="seg" role="group" aria-label="Échéance">${tabs.map(([v, l]) => `<button data-act="atab" data-v="${v}" aria-pressed="${ui.actionTab === v}">${l} <span class="muted">${groups[v].length}</span></button>`).join('')}</div><div class="grow"></div>${scopeToggle()}<button class="btn primary" data-act="new-action">${icon('plus')} Action</button></div>
      <div class="grid2" style="grid-template-columns:minmax(0,2fr) minmax(min(280px,100%),1fr)">
        <section class="panel"><div class="list">${items.map((a) => actionRow(a)).join('') || `<p class="empty">${ui.actionTab === 'late' ? 'Aucune relance en retard. Bravo.' : 'Aucune action dans cette liste.'}</p>`}</div></section>
        <section class="panel"><header><h2>Prospects sans relance</h2><span class="sub">${noFollow.length}</span></header>
          <p class="muted" style="margin:0 0 8px;font-size:13px">Ces prospects n’ont aucune action prévue. Planifiez un suivi pour qu’ils ne se perdent pas.</p>
          <div class="list">${noFollow.slice(0, 10).map((c) => `<div class="row"><div class="body" data-act="open-contact" data-id="${esc(c.id)}"><b>${esc(c.company)}</b><small>${esc(c.name)} · ${esc(c.source || '')}</small></div><button class="btn sm" data-act="new-action" data-contact="${esc(c.id)}">Planifier</button></div>`).join('') || '<p class="empty">Tous les prospects ont une relance prévue.</p>'}</div></section>
      </div>`;
  };

  VIEW_RENDER.planning = () => {
    const ws = ui.weekStart;
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const t = todayISO();
    const H0 = 7; const H1 = 20; const PX = 48;
    const meets = list('meetings').filter(inScope);
    const acts = list('actions').filter(inScope);
    const label = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const dayEvents = (d) => meets.filter((x) => x.start.slice(0, 10) === isoDate(d)).sort((a, b) => a.start.localeCompare(b.start));
    const layout = (evs) => { // colonnes simples pour les chevauchements
      const lanes = [];
      return evs.map((x) => {
        const s = parseDT(x.start); const e = new Date(s.getTime() + (x.durationMin || 60) * 60000);
        let lane = lanes.findIndex((end) => end <= s);
        if (lane < 0) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
        return { x, s, e, lane };
      }).map((o, _, arr) => ({ ...o, lanes: Math.max(...arr.filter((p) => p.s < o.e && p.e > o.s).map((p) => p.lane)) + 1 }));
    };
    const grid = `<div class="cal-wrap"><div class="cal">
      <div class="dh"></div>
      ${days.map((d) => { const iso = isoDate(d); const ta = acts.filter((a) => a.due === iso); return `<div class="dh ${iso === t ? 'today' : ''}">${esc(d.toLocaleDateString('fr-FR', { weekday: 'short' }))}<b>${d.getDate()}</b>
        <div class="tasks">${ta.slice(0, 3).map((a) => `<button class="${a.done ? 'done' : ''}" data-act="edit-action" data-id="${esc(a.id)}" title="${esc(a.title)}">${esc(ACT_TYPES[a.type] || '')} · ${esc(a.title)}</button>`).join('')}${ta.length > 3 ? `<span class="muted" style="font-size:11px">+ ${ta.length - 3} actions</span>` : ''}</div></div>`; }).join('')}
      <div class="hours">${[...Array(H1 - H0)].map((_, i) => `<div>${H0 + i}h</div>`).join('')}</div>
      ${days.map((d) => `<div class="day ${isoDate(d) === t ? 'today' : ''}" data-act="slot" data-date="${isoDate(d)}" style="height:${(H1 - H0) * PX}px">
        ${layout(dayEvents(d)).map(({ x, s, lane, lanes }) => { const r = rep(x.ownerId); const top = Math.max(0, (s.getHours() + s.getMinutes() / 60 - H0) * PX); const h = Math.max(22, (x.durationMin || 60) / 60 * PX - 2); return `<div class="ev" data-act="edit-meeting" data-id="${esc(x.id)}" style="top:${top}px;height:${h}px;background:${esc(r ? r.color : '#4B5563')};left:calc(${(lane / lanes) * 100}% + 3px);width:calc(${100 / lanes}% - 6px);right:auto"><b>${esc(fmtTime(s))} ${esc(x.title)}</b><small>${esc(x.location || '')}${r ? ' · ' + esc(r.name) : ''}</small></div>`; }).join('')}
      </div>`).join('')}
    </div></div>`;
    const agenda = `<div class="agenda">${days.map((d) => { const iso = isoDate(d); const evs = dayEvents(d); const ta = acts.filter((a) => a.due === iso && !a.done); return `<section class="panel"><h3 class="${iso === t ? 'today' : ''}">${esc(fmtDayLong(d))}</h3><div class="list">
      ${evs.map((x) => { const s = parseDT(x.start); return `<div class="row"><span class="type">${icon('cal')}</span><div class="body" data-act="edit-meeting" data-id="${esc(x.id)}"><b>${esc(fmtTime(s))} · ${esc(x.title)}</b><small>${esc(x.location || '')} · ${x.durationMin} min</small></div>${ownerChip(x.ownerId, false)}</div>`; }).join('')}
      ${ta.map((a) => actionRow(a)).join('')}
      ${!evs.length && !ta.length ? '<p class="empty">Rien de prévu.</p>' : ''}</div></section>`; }).join('')}</div>`;
    return `<div class="toolbar">
        <button class="btn" data-act="week" data-v="-1" aria-label="Semaine précédente">${icon('left')}</button>
        <button class="btn" data-act="week" data-v="0">Cette semaine</button>
        <button class="btn" data-act="week" data-v="1" aria-label="Semaine suivante">${icon('right')}</button>
        <strong class="grow">Semaine du ${esc(label)}</strong>${scopeToggle()}
        <button class="btn primary" data-act="new-meeting">${icon('plus')} Rendez-vous</button></div>
      <p class="muted" style="margin:-8px 0 0;font-size:13px">Cliquez sur un créneau vide pour planifier un rendez-vous à cette heure.</p>
      ${grid}${agenda}`;
  };

  function repStats(repId, from, to) {
    const won = wonIn(from, to, repId);
    const lost = lostIn(from, to, repId);
    return {
      won, lost,
      revenue: sum(won),
      done: doneIn(from, to, repId).length,
      meetings: list('meetings').filter((x) => x.ownerId === repId && x.start.slice(0, 10) >= from && x.start.slice(0, 10) <= to).length,
      newContacts: list('contacts').filter((c) => c.ownerId === repId && c.createdAt >= from && c.createdAt <= to).length,
      open: list('deals').filter((d) => d.ownerId === repId && OPEN(d)),
    };
  }

  VIEW_RENDER.objectives = () => {
    const m = ui.objMonth;
    const [from, to] = monthRange(m);
    const rs = reps().map((r) => {
      const o = get('objectives', `${m}_${r.id}`) || { targetRevenue: 0, targetDeals: 0, targetActions: 0 };
      const st = repStats(r.id, from, to);
      return { r, o, st, p: pct(st.revenue, o.targetRevenue) };
    }).sort((a, b) => b.p - a.p || b.st.revenue - a.st.revenue);
    const tRev = sum(rs, (x) => x.o.targetRevenue); const aRev = sum(rs, (x) => x.st.revenue);
    const tDeals = sum(rs, (x) => x.o.targetDeals); const aDeals = sum(rs, (x) => x.st.won.length);
    const tAct = sum(rs, (x) => x.o.targetActions); const aAct = sum(rs, (x) => x.st.done);
    const goal = (label, a, t, fmt = (v) => v) => `<div class="goal"><div class="top-line"><span>${label}</span><span>${esc(fmt(a))} / ${t ? esc(fmt(t)) : '—'}</span></div>${meter(a, t, t && a >= t)}</div>`;
    return `
      <div class="toolbar">
        <button class="btn" data-act="month" data-v="-1" aria-label="Mois précédent">${icon('left')}</button>
        <strong style="min-width:150px;text-align:center">${esc(monthLabel(m))}</strong>
        <button class="btn" data-act="month" data-v="1" aria-label="Mois suivant">${icon('right')}</button>
        <div class="grow"></div><span class="muted" style="font-size:13px">Le CA compte les opportunités gagnées dont la date de clôture tombe dans le mois.</span>
      </div>
      <section class="kpis">
        <div class="kpi"><span class="lbl">CA équipe</span><span class="val">${pct(aRev, tRev)} %</span>${meter(aRev, tRev, tRev && aRev >= tRev)}<span class="note">${esc(moneyShort(aRev))} sur ${esc(moneyShort(tRev))}</span></div>
        <div class="kpi"><span class="lbl">Affaires gagnées</span><span class="val">${aDeals} <small>/ ${tDeals}</small></span>${meter(aDeals, tDeals, tDeals && aDeals >= tDeals)}</div>
        <div class="kpi"><span class="lbl">Actions réalisées</span><span class="val">${aAct} <small>/ ${tAct}</small></span>${meter(aAct, tAct, tAct && aAct >= tAct)}</div>
      </section>
      <div class="grid3">${rs.map(({ r, o, st, p }, i) => `<section class="panel rep-card">
        <div class="hd"><span class="av lg" style="background:${esc(r.color)}">${esc(initials(r.name))}</span><div><b>${esc(r.name)}</b><br><small class="muted">${esc(r.role || '')}</small></div><span class="rank">#${i + 1}</span></div>
        <div style="display:flex;align-items:baseline;gap:8px"><span class="pct">${p} %</span><span class="muted">de l’objectif de CA</span></div>
        ${goal('Chiffre d’affaires', st.revenue, o.targetRevenue, moneyShort)}
        ${goal('Affaires gagnées', st.won.length, o.targetDeals)}
        ${goal('Actions réalisées', st.done, o.targetActions)}
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px"><span class="muted" style="font-size:12px">Pipeline ouvert : ${esc(moneyShort(sum(st.open)))}</span>${session.canEditObjectives() ? `<button class="btn sm" data-act="edit-objective" data-rep="${esc(r.id)}">Définir les objectifs</button>` : ''}</div>
      </section>`).join('') || '<p class="empty">Ajoutez des membres à l’équipe dans Paramètres pour suivre leurs objectifs.</p>'}</div>`;
  };

  VIEW_RENDER.reports = () => {
    const now = new Date();
    const periods = { month: ['Ce mois', `${isoMonth(now)}-01`], q: ['3 derniers mois', `${shiftMonth(isoMonth(now), -2)}-01`], h: ['6 derniers mois', `${shiftMonth(isoMonth(now), -5)}-01`], y: ['Cette année', `${now.getFullYear()}-01-01`] };
    const [, from] = periods[ui.period];
    const to = isoDate(now);
    const rows = reps().map((r) => ({ r, st: repStats(r.id, from, to) }));
    const tot = (f) => sum(rows, (x) => f(x.st));
    const conv = (st) => (st.won.length + st.lost.length ? pct(st.won.length, st.won.length + st.lost.length) + ' %' : '—');
    // CA par mois (6 mois)
    const months = [...Array(6)].map((_, i) => shiftMonth(isoMonth(now), i - 5));
    const series = months.map((m) => { const [a, b] = monthRange(m); return { m, v: sum(wonIn(a, b)) }; });
    const maxV = Math.max(1, ...series.map((x) => x.v));
    const W = 640; const Hh = 220; const padL = 8; const padB = 28; const padT = 24; const bw = (W - padL * 2) / series.length;
    const chart = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Chiffre d’affaires signé par mois">
      <line class="grid" x1="0" x2="${W}" y1="${Hh - padB}" y2="${Hh - padB}"/>
      ${series.map((x, i) => { const h = (x.v / maxV) * (Hh - padB - padT); const xx = padL + i * bw + bw * 0.18; const w = bw * 0.64; const y = Hh - padB - h; return `<rect class="bar ${i === series.length - 1 ? 'cur' : ''}" x="${xx}" y="${y}" width="${w}" height="${Math.max(h, 1)}" rx="4"/><text class="val" x="${xx + w / 2}" y="${y - 6}" text-anchor="middle">${esc(x.v ? moneyShort(x.v).replace(' ' + cur(), '') : '0')}</text><text x="${xx + w / 2}" y="${Hh - 8}" text-anchor="middle">${esc(monthLabel(x.m).split(' ')[0].slice(0, 4))}.</text>`; }).join('')}
    </svg>`;
    // Entonnoir
    const allDeals = list('deals').filter((d) => (d.createdAt || '') >= from || OPEN(d) || (d.closeDate || '') >= from);
    const reached = (sid) => { const idx = STAGES.findIndex((s) => s.id === sid); return allDeals.filter((d) => d.stage !== 'perdu' && STAGES.findIndex((s) => s.id === d.stage) >= idx).length; };
    const funnel = STAGES.slice(0, 5).map((s) => ({ s, n: reached(s.id) }));
    const fMax = Math.max(1, funnel[0].n);
    // Sources
    const bySource = SOURCES.map((src) => { const cs = list('contacts').filter((c) => c.source === src); const ids = new Set(cs.map((c) => c.id)); return { src, n: cs.length, won: sum(list('deals').filter((d) => d.stage === 'gagne' && ids.has(d.contactId))) }; }).filter((x) => x.n);
    const sMax = Math.max(1, ...bySource.map((x) => x.n));
    // Activité récente
    const feed = [
      ...list('actions').filter((a) => a.done).map((a) => ({ date: a.doneAt || a.due, who: a.ownerId, text: `${ACT_TYPES[a.type] || 'Action'} : ${a.title}` })),
      ...list('deals').filter((d) => d.stage === 'gagne').map((d) => ({ date: d.closeDate, who: d.ownerId, text: `Affaire gagnée : ${d.title} (${moneyShort(d.amount)})`, win: true })),
      ...list('contacts').map((c) => ({ date: c.createdAt, who: c.ownerId, text: `Nouveau ${c.type === 'client' ? 'client' : 'prospect'} : ${c.company}` })),
    ].filter((x) => x.date && x.date <= to).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    return `
      <div class="toolbar"><div class="seg" role="group" aria-label="Période">${Object.entries(periods).map(([k, [l]]) => `<button data-act="period" data-v="${k}" aria-pressed="${ui.period === k}">${l}</button>`).join('')}</div><span class="muted grow" style="font-size:13px">Du ${esc(fmtDay(from))} au ${esc(fmtDay(to))}</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Commercial</th><th class="num">Nouveaux contacts</th><th class="num">Actions réalisées</th><th class="num">Rendez-vous</th><th class="num">Opp. ouvertes</th><th class="num">Pipeline pondéré</th><th class="num">Gagnées</th><th class="num">CA signé</th><th class="num">Transformation</th></tr></thead>
        <tbody>${rows.map(({ r, st }) => `<tr><td>${ownerChip(r.id)}</td><td class="num">${st.newContacts}</td><td class="num">${st.done}</td><td class="num">${st.meetings}</td><td class="num">${st.open.length}</td><td class="num">${esc(moneyShort(sum(st.open, weighted)))}</td><td class="num">${st.won.length}</td><td class="num money">${esc(moneyShort(st.revenue))}</td><td class="num">${conv(st)}</td></tr>`).join('')}
          <tr><td><b>Équipe</b></td><td class="num"><b>${tot((s) => s.newContacts)}</b></td><td class="num"><b>${tot((s) => s.done)}</b></td><td class="num"><b>${tot((s) => s.meetings)}</b></td><td class="num"><b>${tot((s) => s.open.length)}</b></td><td class="num"><b>${esc(moneyShort(tot((s) => sum(s.open, weighted))))}</b></td><td class="num"><b>${tot((s) => s.won.length)}</b></td><td class="num money">${esc(moneyShort(tot((s) => s.revenue)))}</td><td class="num"><b>${conv({ won: rows.flatMap((x) => x.st.won), lost: rows.flatMap((x) => x.st.lost) })}</b></td></tr>
        </tbody></table></div>
      <div class="grid2">
        <section class="panel chart"><header><h2>CA signé par mois</h2><span class="sub">6 derniers mois, toute l’équipe (${esc(cur())})</span></header>${chart}</section>
        <section class="panel"><header><h2>Entonnoir de conversion</h2><span class="sub">Opportunités ayant atteint chaque étape</span></header>
          <div class="hbars">${funnel.map(({ s, n }, i) => `<div class="hbar"><span>${esc(s.label)}</span><div class="track"><i style="width:${pct(n, fMax)}%;background:${s.color}"></i></div><span>${n}${i ? ` <span class="muted">(${pct(n, funnel[i - 1].n)} %)</span>` : ''}</span></div>`).join('')}</div></section>
      </div>
      <div class="grid2">
        <section class="panel"><header><h2>Origine des contacts</h2><span class="sub">Nombre de contacts et CA gagné par canal</span></header>
          <div class="hbars">${bySource.map((x) => `<div class="hbar"><span>${esc(x.src)}</span><div class="track"><i style="width:${pct(x.n, sMax)}%"></i></div><span>${x.n} · <span class="money">${esc(moneyShort(x.won))}</span></span></div>`).join('')}</div></section>
        <section class="panel"><header><h2>Activité récente de l’équipe</h2></header>
          <div class="list">${feed.map((f) => `<div class="row">${ownerChip(f.who, false)}<div class="body" style="cursor:default"><b style="font-weight:${f.win ? 700 : 500}">${esc(f.text)}</b><small>${esc(fmtDay(f.date))}${rep(f.who) ? ' · ' + esc(rep(f.who).name) : ''}</small></div></div>`).join('') || '<p class="empty">Aucune activité pour l’instant.</p>'}</div></section>
      </div>`;
  };

  // ---------- Tiroir contact ----------
  function renderDrawer() {
    const root = $('#drawer-root');
    const c = ui.drawer && contact(ui.drawer);
    if (!c) { root.innerHTML = ''; ui.drawer = null; return; }
    const deals = list('deals').filter((d) => d.contactId === c.id).sort((a, b) => (b.closeDate || '').localeCompare(a.closeDate || ''));
    const acts = list('actions').filter((a) => a.contactId === c.id).sort((a, b) => (a.done - b.done) || a.due.localeCompare(b.due));
    const meets = list('meetings').filter((x) => x.contactId === c.id).sort((a, b) => b.start.localeCompare(a.start));
    const keepScroll = root.querySelector('.drawer')?.scrollTop || 0;
    root.innerHTML = `<div class="scrim" data-act="close-drawer"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${esc(c.company)}">
      <div class="hd"><div><div style="display:flex;gap:8px;align-items:center;margin-bottom:4px">${typePill(c.type)}${c.demo ? '<span class="pill demo">Démo</span>' : ''}</div><h2>${esc(c.company)}</h2><span class="muted">${esc(c.name)}${c.title ? ' · ' + esc(c.title) : ''}</span></div>
        <button class="btn ghost x" data-act="close-drawer-btn" aria-label="Fermer">${icon('x')}</button></div>
      <dl class="facts">
        <dt>Téléphone</dt><dd>${c.phone ? `<span>${esc(c.phone)}</span><button class="btn sm ghost" data-act="copy" data-v="${esc(c.phone)}" aria-label="Copier le numéro">${icon('copy')}</button>` : '—'}</dd>
        <dt>E-mail</dt><dd>${c.email ? `<span>${esc(c.email)}</span><button class="btn sm ghost" data-act="copy" data-v="${esc(c.email)}" aria-label="Copier l’e-mail">${icon('copy')}</button>` : '—'}</dd>
        <dt>Ville</dt><dd>${esc(c.city || '—')}</dd>
        <dt>Source</dt><dd>${esc(c.source || '—')}</dd>
        <dt>Responsable</dt><dd>${ownerChip(c.ownerId)}</dd>
        <dt>Créé le</dt><dd>${esc(fmtDay(c.createdAt))}</dd>
      </dl>
      <div class="actions-bar">
        <button class="btn primary sm" data-act="new-action" data-contact="${esc(c.id)}">${icon('plus')} Relance</button>
        <button class="btn sm" data-act="new-deal" data-contact="${esc(c.id)}">${icon('plus')} Opportunité</button>
        <button class="btn sm" data-act="new-meeting" data-contact="${esc(c.id)}">${icon('plus')} Rendez-vous</button>
        <button class="btn sm" data-act="edit-contact" data-id="${esc(c.id)}">Modifier</button>
        ${c.type === 'prospect' ? `<button class="btn sm" data-act="convert" data-id="${esc(c.id)}">Passer en client</button>` : ''}
      </div>
      ${c.notes ? `<section class="panel"><header><h2>Notes</h2></header><p style="margin:0;white-space:pre-wrap">${esc(c.notes)}</p></section>` : ''}
      <section class="panel"><header><h2>Opportunités</h2><span class="sub">${deals.length}</span></header><div class="list">
        ${deals.map((d) => `<div class="row"><div class="body" data-act="edit-deal" data-id="${esc(d.id)}"><b>${esc(d.title)}</b><small>${esc(STAGE[d.stage]?.label || '')} · clôture ${esc(fmtDay(d.closeDate))}</small></div><span class="money">${esc(moneyShort(d.amount))}</span></div>`).join('') || '<p class="empty">Aucune opportunité.</p>'}</div></section>
      <section class="panel"><header><h2>Relances & actions</h2><span class="sub">${acts.length}</span></header><div class="list">${acts.map((a) => actionRow(a)).join('') || '<p class="empty">Aucune action. Planifiez une relance.</p>'}</div></section>
      <section class="panel"><header><h2>Rendez-vous</h2><span class="sub">${meets.length}</span></header><div class="list">
        ${meets.map((x) => { const s = parseDT(x.start); return `<div class="row"><div class="body" data-act="edit-meeting" data-id="${esc(x.id)}"><b>${esc(x.title)}</b><small>${esc(s.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }))} à ${esc(fmtTime(s))} · ${esc(x.location || '')}</small></div>${ownerChip(x.ownerId, false)}</div>`; }).join('') || '<p class="empty">Aucun rendez-vous.</p>'}</div></section>
    </aside></div>`;
    const dr = root.querySelector('.drawer');
    if (dr) dr.scrollTop = keepScroll;
  }

  // ---------- Formulaires ----------
  let modalState = null;
  function openForm({ title, fields, values = {}, onSubmit, onDelete, extra = '', submitLabel = 'Enregistrer', wide = false }) {
    modalState = { onSubmit, onDelete, armed: false };
    const field = (f) => {
      const v = values[f.name] ?? f.default ?? '';
      const id = `f-${f.name}`;
      const req = f.required ? 'required' : '';
      let input;
      if (f.type === 'select') input = `<select id="${id}" name="${f.name}" ${req}>${f.options.map(([val, lab]) => opt(val, lab, v)).join('')}</select>`;
      else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}">${esc(v)}</textarea>`;
      else if (f.type === 'checkbox') return `<div class="f chk ${f.wide ? 'wide' : ''}"><input id="${id}" type="checkbox" name="${f.name}" ${v ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label></div>`;
      else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`;
      return `<div class="f ${f.wide ? 'wide' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<small class="muted">${esc(f.hint)}</small>` : ''}</div>`;
    };
    $('#modal-root').innerHTML = `<div class="scrim modal-scrim" data-act="close-modal"><form class="modal ${wide ? 'wide' : ''}" id="modal-form" novalidate>
      <h2>${esc(title)}</h2>${extra}
      <div class="form">${fields.map(field).join('')}</div>
      <p id="form-error" class="muted" style="color:var(--bad);margin:0" hidden></p>
      <footer>${onDelete ? '<button type="button" class="btn danger" data-act="modal-delete">Supprimer</button>' : ''}<span class="sp"></span>
        <button type="button" class="btn" data-act="close-modal-btn">Annuler</button><button type="submit" class="btn primary">${esc(submitLabel)}</button></footer>
    </form></div>`;
    const first = $('#modal-form input:not([type=checkbox]), #modal-form select');
    if (first) first.focus();
    $('#modal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {};
      fields.forEach((f) => {
        const el = form.elements[f.name];
        if (!el) return;
        data[f.name] = f.type === 'checkbox' ? el.checked : f.type === 'number' ? Number(el.value || 0) : el.value.trim();
      });
      const missing = fields.filter((f) => f.required && !String(data[f.name] ?? '').trim());
      if (missing.length) { const er = $('#form-error'); er.textContent = `Renseignez : ${missing.map((f) => f.label).join(', ')}.`; er.hidden = false; return; }
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const ok = await modalState.onSubmit(data);
        if (ok !== false && modalState && modalState.onSubmit) closeModal();
      } catch (err) {
        const er = $('#form-error'); if (er) { er.textContent = err.message || 'L’enregistrement a échoué.'; er.hidden = false; }
      } finally { if (btn.isConnected) btn.disabled = false; }
    });
  }
  function closeModal() { const wasSettings = modalState && modalState.settings; $('#modal-root').innerHTML = ''; modalState = null; if (wasSettings) applyBrand(); }

  const contactOptions = (allowEmpty) => (allowEmpty ? [['', '— Aucun —']] : []).concat(list('contacts').sort((a, b) => a.company.localeCompare(b.company, 'fr')).map((c) => [c.id, `${c.company} · ${c.name}`]));
  const repOpts = () => reps().map((r) => [r.id, r.name]);
  function needReps() { if (isReadOnly()) { toast(blockedMessage()); return true; } return false; }

  function editContact(id) {
    if (needReps()) return;
    const c = id ? contact(id) : null;
    openForm({
      title: c ? 'Modifier le contact' : 'Nouveau prospect ou client',
      values: c || { type: 'prospect', ownerId: defaultOwner(), source: 'WhatsApp' },
      fields: [
        { name: 'company', label: 'Entreprise', required: true }, { name: 'name', label: 'Nom du contact', required: true },
        { name: 'title', label: 'Fonction' }, { name: 'type', label: 'Statut', type: 'select', options: [['prospect', 'Prospect'], ['client', 'Client']] },
        { name: 'phone', label: 'Téléphone', type: 'tel' }, { name: 'email', label: 'E-mail', type: 'email' },
        { name: 'city', label: 'Ville / quartier' }, { name: 'source', label: 'Source', type: 'select', options: SOURCES.map((s) => [s, s]) },
        { name: 'ownerId', label: 'Responsable', type: 'select', options: repOpts() },
        { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
      ],
      onSubmit: async (d) => {
        const nid = c ? c.id : uid('ct');
        const ok = await put('contacts', nid, { ...(c || { createdAt: todayISO() }), ...d, updatedAt: todayISO() });
        if (ok && !c) { toast(`${d.company} ajouté. Pensez à planifier une première relance.`); ui.drawer = nid; renderDrawer(); }
        return ok;
      },
      onDelete: c ? async () => { const ok = await del('contacts', c.id); if (ok) { ui.drawer = null; renderDrawer(); toast('Contact supprimé.'); } return ok; } : null,
    });
  }

  function editDeal(id, preset = {}) {
    if (needReps()) return;
    const d = id ? get('deals', id) : null;
    if (!d && !list('contacts').length) { toast('Ajoutez d’abord un prospect.'); editContact(); return; }
    const pc = preset.contactId ? contact(preset.contactId) : null;
    openForm({
      title: d ? 'Modifier l’opportunité' : 'Nouvelle opportunité',
      values: d || { stage: 'nouveau', ownerId: pc ? pc.ownerId : defaultOwner(), closeDate: isoDate(addDays(new Date(), 30)), ...preset },
      fields: [
        { name: 'title', label: 'Intitulé', required: true, wide: true, placeholder: 'Ex. Contrat maintenance annuel' },
        { name: 'contactId', label: 'Prospect / client', type: 'select', options: contactOptions(false), required: true, wide: true },
        { name: 'amount', label: `Montant (${cur()})`, type: 'number', min: 0, step: 1000, required: true },
        { name: 'stage', label: 'Étape', type: 'select', options: STAGES.map((s) => [s.id, `${s.label} (${s.prob} %)`]) },
        { name: 'closeDate', label: 'Clôture prévue', type: 'date' },
        { name: 'ownerId', label: 'Responsable', type: 'select', options: repOpts() },
        { name: 'lostReason', label: 'Motif si perdue', wide: true },
        { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
      ],
      onSubmit: async (v) => saveDeal(d, v),
      onDelete: d ? async () => { const ok = await del('deals', d.id); if (ok) toast('Opportunité supprimée.'); return ok; } : null,
    });
  }
  async function saveDeal(d, v) {
    const nid = d ? d.id : uid('op');
    const closing = (v.stage === 'gagne' || v.stage === 'perdu') && (!d || d.stage !== v.stage);
    const body = { ...(d || { createdAt: todayISO() }), ...v, updatedAt: todayISO() };
    if (closing && (!v.closeDate || v.closeDate > todayISO())) body.closeDate = todayISO();
    const ok = await put('deals', nid, body);
    if (ok && v.stage === 'gagne' && closing) {
      const c = contact(v.contactId);
      if (c && c.type === 'prospect') { await put('contacts', c.id, { ...c, type: 'client', updatedAt: todayISO() }); toast(`Affaire gagnée. ${c.company} est maintenant client.`); } else toast('Affaire gagnée.');
    }
    return ok;
  }

  function editAction(id, preset = {}) {
    if (needReps()) return;
    const a = id ? get('actions', id) : null;
    const pc = preset.contactId ? contact(preset.contactId) : null;
    const dealOpts = [['', '— Aucune —']].concat(list('deals').filter((d) => OPEN(d) || (a && a.dealId === d.id)).map((d) => [d.id, `${d.title} · ${(contact(d.contactId) || {}).company || ''}`]));
    openForm({
      title: a ? 'Modifier l’action' : 'Nouvelle relance ou action',
      values: a || { type: 'appel', due: todayISO(), ownerId: pc ? pc.ownerId : defaultOwner(), title: pc ? `Rappeler ${pc.name}` : '', ...preset },
      fields: [
        { name: 'type', label: 'Type', type: 'select', options: Object.entries(ACT_TYPES) },
        { name: 'due', label: 'Échéance', type: 'date', required: true },
        { name: 'title', label: 'Action', required: true, wide: true, placeholder: 'Ex. Relancer pour le devis' },
        { name: 'contactId', label: 'Prospect / client', type: 'select', options: contactOptions(true), wide: true },
        { name: 'dealId', label: 'Opportunité liée', type: 'select', options: dealOpts, wide: true },
        { name: 'ownerId', label: 'Responsable', type: 'select', options: repOpts() },
        { name: 'done', label: 'Action réalisée', type: 'checkbox' },
        { name: 'notes', label: 'Compte rendu', type: 'textarea', wide: true },
      ],
      onSubmit: async (v) => {
        const nid = a ? a.id : uid('ac');
        const doneAt = v.done ? (a && a.done && a.doneAt ? a.doneAt : todayISO()) : '';
        return put('actions', nid, { ...(a || {}), ...v, doneAt });
      },
      onDelete: a ? async () => { const ok = await del('actions', a.id); if (ok) toast('Action supprimée.'); return ok; } : null,
    });
  }

  function editMeeting(id, preset = {}) {
    if (needReps()) return;
    const x = id ? get('meetings', id) : null;
    const pc = preset.contactId ? contact(preset.contactId) : null;
    const t = new Date(); t.setHours(t.getHours() + 1, 0, 0, 0);
    openForm({
      title: x ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous',
      values: x || { start: `${isoDate(t)}T${pad(t.getHours())}:00`, durationMin: '60', ownerId: pc ? pc.ownerId : defaultOwner(), location: 'Sur site', title: pc ? `Rendez-vous · ${pc.company}` : '', ...preset },
      fields: [
        { name: 'title', label: 'Objet', required: true, wide: true },
        { name: 'contactId', label: 'Prospect / client', type: 'select', options: contactOptions(true), wide: true },
        { name: 'start', label: 'Début', type: 'datetime-local', required: true },
        { name: 'durationMin', label: 'Durée', type: 'select', options: [['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1 h 30'], ['120', '2 h'], ['180', '3 h']] },
        { name: 'location', label: 'Lieu', type: 'select', options: ['Sur site', 'Bureau ZEBRE', 'Visio', 'Téléphone', 'Autre'].map((l) => [l, l]) },
        { name: 'ownerId', label: 'Commercial', type: 'select', options: repOpts() },
        { name: 'notes', label: 'Notes', type: 'textarea', wide: true },
      ],
      onSubmit: async (v) => put('meetings', x ? x.id : uid('rv'), { ...(x || {}), ...v, durationMin: Number(v.durationMin) || 60 }),
      onDelete: x ? async () => { const ok = await del('meetings', x.id); if (ok) toast('Rendez-vous supprimé.'); return ok; } : null,
    });
  }

  function editObjective(repId) {
    const r = rep(repId);
    const id = `${ui.objMonth}_${repId}`;
    const o = get('objectives', id);
    openForm({
      title: `Objectifs de ${r.name} · ${monthLabel(ui.objMonth)}`,
      values: o || { targetRevenue: 0, targetDeals: 0, targetActions: 0 },
      fields: [
        { name: 'targetRevenue', label: `Chiffre d’affaires (${cur()})`, type: 'number', min: 0, step: 1000, wide: true },
        { name: 'targetDeals', label: 'Affaires gagnées', type: 'number', min: 0 },
        { name: 'targetActions', label: 'Actions réalisées', type: 'number', min: 0 },
      ],
      onSubmit: async (v) => put('objectives', id, { ...(o || {}), month: ui.objMonth, repId, ...v }),
    });
  }

  // ---------- Paramètres : entreprise, équipe, licence ----------
  const BRAND_PRESETS = ['#B7791F', '#1F6F5C', '#2C5A8C', '#7A3E8E', '#B23A48', '#C2571A', '#3A4A5C', '#0E7C86'];
  const CURRENCIES = [['FCFA', 'Franc CFA (FCFA)'], ['€', 'Euro (€)'], ['$', 'Dollar ($)'], ['MAD', 'Dirham (MAD)'], ['DA', 'Dinar (DA)'], ['GNF', 'Franc guinéen (GNF)'], ['FC', 'Franc congolais (FC)']];
  const fmtLong = (iso) => (iso ? parseDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  let settingsDraft = null;

  function openSettings(tab = 'company') {
    const t = settings();
    if (!settingsDraft || tab === 'company') settingsDraft = { logo: t.logo || '', brandColor: t.brandColor || '' };
    modalState = { onSubmit: null, onDelete: null, settings: true };
    const admin = session.isAdmin();
    const tabs = [['company', 'Entreprise'], ['team', 'Équipe'], ['licence', 'Licence'], ['demo', 'Démonstration']];
    let body = '';
    if (tab === 'company') {
      const dis = admin ? '' : 'disabled';
      body = `<div class="brand-editor">
          <div class="logo-box">${settingsDraft.logo ? `<img src="${esc(settingsDraft.logo)}" alt="Logo actuel">` : '<span class="mark xl" aria-hidden="true"></span>'}</div>
          <div class="logo-actions">
            <b>Logo de l’entreprise</b><small class="muted">PNG, JPEG, WebP ou SVG. Il apparaît dans le menu, l’écran de connexion et les rapports.</small>
            ${admin ? `<div class="actions-bar"><label class="btn sm" for="logo-file">${icon('upload')} Importer un logo</label><input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>${settingsDraft.logo ? '<button type="button" class="btn sm ghost" data-act="logo-remove">Retirer</button>' : ''}</div>` : ''}
          </div>
        </div>
        <div class="form">
          <div class="f"><label for="s-name">Nom de l’entreprise</label><input id="s-name" type="text" value="${esc(t.name || '')}" ${dis}></div>
          <div class="f"><label for="s-cur">Devise</label><select id="s-cur" ${dis}>${CURRENCIES.map(([v, l]) => opt(v, l, t.currency || 'FCFA')).join('')}</select></div>
          <div class="f wide"><label>Couleur de la marque</label><div class="swatches">${BRAND_PRESETS.map((c) => `<button type="button" class="swatch ${c.toLowerCase() === (settingsDraft.brandColor || '#B7791F').toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="pick-color" data-v="${c}" aria-label="Couleur ${c}" ${dis}></button>`).join('')}
            <input id="s-color" type="color" value="${esc(settingsDraft.brandColor || '#B7791F')}" aria-label="Couleur personnalisée" ${dis}></div>
            <small class="muted">Les boutons, les graphiques et les repères prennent cette couleur pour toute l’équipe.</small></div>
        </div>
        ${admin ? '' : '<p class="muted" style="margin:0">Seuls les administrateurs peuvent modifier ces informations.</p>'}`;
    } else if (tab === 'team') {
      const l = session.licence();
      const members = teamAll();
      const used = members.filter((m) => m.active !== false).length;
      body = `<div class="seat-meter"><div><b>${used} / ${l.maxUsers || '—'} utilisateurs</b><small class="muted">Licence ${esc(l.planLabel || '')}</small></div>${meter(used, l.maxUsers || 1, false)}</div>
        <div class="rep-list">${members.map((m) => `<div class="row"><span class="av" style="background:${esc(m.color)}">${esc(initials(m.name))}</span>
          <div class="body" ${admin ? `data-act="edit-member" data-id="${esc(m.id)}"` : ''}><b>${esc(m.name)}${m.id === ui.me ? ' <span class="muted">(vous)</span>' : ''}</b><small>${esc(m.email || '')}${m.title ? ' · ' + esc(m.title) : ''}</small></div>
          <span class="pill ${m.access === 'owner' || m.access === 'admin' ? 'client' : ''}">${esc(ROLE_LABEL[m.access] || '')}</span>${m.active === false ? '<span class="pill lost">Désactivé</span>' : ''}
          ${admin ? `<button type="button" class="btn sm" data-act="edit-member" data-id="${esc(m.id)}">Modifier</button>` : ''}</div>`).join('')}</div>
        ${admin ? `<div class="actions-bar"><button type="button" class="btn primary sm" data-act="edit-member" ${used >= (l.maxUsers || 0) ? 'disabled title="Toutes les places de la licence sont utilisées"' : ''}>${icon('plus')} Ajouter un membre</button></div>
          <small class="muted">Chaque membre se connecte avec son e-mail et le mot de passe provisoire que vous lui communiquez. Une connexion Internet est nécessaire pour gérer l’équipe.</small>` : ''}`;
    } else if (tab === 'licence') {
      const l = session.licence();
      const state = isReadOnly() ? '<span class="pill lost">Inactive</span>' : '<span class="pill won">Active</span>';
      body = `<div class="licence-card">
          <div class="lc-top">${icon('shield')}<div><small>Licence ZEBRE CRM</small><b>${esc(l.planLabel || l.plan || '—')}</b></div>${state}</div>
          <dl class="facts"><dt>Utilisateurs</dt><dd>${l.seatsUsed ?? '—'} sur ${l.maxUsers ?? '—'}</dd><dt>Valable jusqu’au</dt><dd>${esc(fmtLong(l.expiresAt))}</dd><dt>Numéro</dt><dd>${esc(l.id || '—')}</dd></dl>
        </div>
        <p class="muted" style="margin:0">Pour ajouter des utilisateurs, changer d’offre ou renouveler votre licence, contactez l’équipe ZEBRE CRM en indiquant le numéro de licence.</p>`;
    } else {
      const demoCount = COLS.reduce((n, c) => n + list(c).filter((x) => x.demo).length, 0);
      body = demoCount
        ? `<p style="margin:0">${demoCount} éléments de démonstration sont présents. Supprimez-les avant de saisir vos vrais clients.</p><div><button type="button" class="btn danger" data-act="clear-demo">Supprimer la démonstration</button></div>`
        : `<p style="margin:0">Chargez des prospects, opportunités, relances et rendez-vous fictifs, répartis entre les membres de votre équipe, pour découvrir ZEBRE CRM.</p><div><button type="button" class="btn" data-act="load-demo">Charger la démonstration</button></div>`;
    }
    $('#modal-root').innerHTML = `<div class="scrim modal-scrim" data-act="close-modal"><div class="modal wide" role="dialog" aria-modal="true" aria-label="Paramètres">
      <h2>Paramètres</h2>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === tab}" data-act="settings-tab" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="tab-body">${body}</div>
      <p id="form-error" class="muted" style="color:var(--bad);margin:0" hidden></p>
      <footer><span class="sp"></span><button type="button" class="btn" data-act="close-modal-btn">Fermer</button>${tab === 'company' && admin ? '<button type="button" class="btn primary" data-act="save-company">Enregistrer</button>' : ''}</footer>
    </div></div>`;
  }

  async function processLogo(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde (5 Mo maximum).');
    const asDataUrl = (blob) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
    if (file.type === 'image/svg+xml') {
      if (file.size > 300 * 1024) throw new Error('Logo SVG trop lourd (300 Ko maximum).');
      return asDataUrl(file);
    }
    const img = await createImageBitmap(file);
    const k = Math.min(1, 360 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let url = c.toDataURL('image/png');
    if (url.length > 500000) url = c.toDataURL('image/webp', 0.86);
    if (url.length > 540000) throw new Error('Logo trop détaillé : essayez une image plus simple.');
    return url;
  }

  async function saveCompany() {
    const name = $('#s-name').value.trim();
    if (!name) { const er = $('#form-error'); er.textContent = 'Le nom de l’entreprise est obligatoire.'; er.hidden = false; return; }
    await session.saveTenant({ name, currency: $('#s-cur').value, brandColor: settingsDraft.brandColor, logo: settingsDraft.logo });
    closeModal();
    toast(navigator.onLine ? 'Personnalisation enregistrée pour toute l’équipe.' : 'Personnalisation enregistrée. Elle sera partagée au retour de la connexion.');
  }

  function editMember(id) {
    const m = id ? teamAll().find((x) => x.id === id) : null;
    const used = new Set(teamAll().map((x) => x.color));
    const roles = [['sales', 'Commercial'], ['manager', 'Manager (voit et fixe les objectifs)'], ['admin', 'Administrateur (gère l’équipe et l’entreprise)']];
    if (session.me().role === 'owner' || (m && m.access === 'owner')) roles.push(['owner', 'Propriétaire']);
    openForm({
      title: m ? `Modifier ${m.name}` : 'Ajouter un membre',
      values: m ? { name: m.name, email: m.email, title: m.title || '', role: m.access, color: m.color, active: m.active !== false } : { role: 'sales', color: REP_COLORS.find((c) => !used.has(c)) || REP_COLORS[1], active: true },
      fields: [
        { name: 'name', label: 'Nom complet', required: true },
        { name: 'email', label: 'E-mail de connexion', type: 'email', required: !m },
        { name: 'title', label: 'Fonction', placeholder: 'Ex. Commercial terrain' },
        { name: 'role', label: 'Accès', type: 'select', options: roles },
        { name: 'color', label: 'Couleur', type: 'select', options: REP_COLORS.map((c, i) => [c, ['Ocre', 'Bleu pétrole', 'Violet', 'Vert', 'Rouge', 'Ardoise', 'Prune', 'Sarcelle'][i]]) },
        { name: 'password', label: m ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe provisoire', type: 'password', required: !m, hint: '8 caractères minimum. Communiquez-le au membre.' },
        ...(m ? [{ name: 'active', label: 'Compte actif', type: 'checkbox' }] : []),
      ],
      onSubmit: async (v) => {
        if (v.password && v.password.length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères.');
        const email = m ? m.email : v.email.toLowerCase();
        const authKey = v.password ? await deriveAuthKey(email, v.password) : undefined;
        const body = { name: v.name, title: v.title, role: v.role, color: v.color, ...(authKey ? { authKey } : {}) };
        if (m) await session.call('PUT', `/api/team/${m.id}`, { ...body, active: v.active });
        else await session.call('POST', '/api/team', { ...body, email });
        await session.refreshTeam();
        toast(m ? 'Membre mis à jour.' : `${v.name} peut maintenant se connecter avec ${email}.`);
        modalState = null;
        setTimeout(() => openSettings('team'), 0);
        return false;
      },
    });
  }

  function changePassword() {
    openForm({
      title: 'Changer mon mot de passe',
      submitLabel: 'Changer le mot de passe',
      fields: [
        { name: 'old', label: 'Mot de passe actuel', type: 'password', required: true, wide: true },
        { name: 'next', label: 'Nouveau mot de passe', type: 'password', required: true },
        { name: 'confirm', label: 'Confirmation', type: 'password', required: true },
      ],
      onSubmit: async (v) => {
        if (v.next.length < 8) throw new Error('Le nouveau mot de passe doit faire au moins 8 caractères.');
        if (v.next !== v.confirm) throw new Error('Les deux mots de passe ne correspondent pas.');
        await session.changePassword(v.old, v.next);
        toast('Mot de passe changé.');
      },
    });
  }

  function relogin() {
    openForm({
      title: 'Se reconnecter',
      submitLabel: 'Se reconnecter',
      extra: `<p class="muted" style="margin:0">Compte ${esc(session.account.email)}. Vos données de cet appareil sont conservées.</p>`,
      fields: [{ name: 'password', label: 'Mot de passe', type: 'password', required: true, wide: true }],
      onSubmit: async (v) => { await session.relogin(v.password); toast('Reconnecté. Synchronisation en cours.'); },
    });
  }

  // ---------- Toast ----------
  let toastT = 0;
  function toast(msg) {
    const root = $('#toast-root');
    if (!root) return;
    root.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toastT);
    toastT = setTimeout(() => { root.innerHTML = ''; }, 3200);
  }

  // ---------- Recherche globale ----------
  function renderSearch() {
    const box = $('#search-results');
    const q = ui.search.trim().toLowerCase();
    if (q.length < 2) { box.hidden = true; return; }
    const cs = list('contacts').filter((c) => [c.company, c.name, c.phone, c.email, c.city].join(' ').toLowerCase().includes(q)).slice(0, 6);
    const ds = list('deals').filter((d) => d.title.toLowerCase().includes(q) || ((contact(d.contactId) || {}).company || '').toLowerCase().includes(q)).slice(0, 5);
    box.innerHTML = cs.map((c) => `<button data-act="open-contact" data-id="${esc(c.id)}"><b>${esc(c.company)}</b><small>${c.type === 'client' ? 'Client' : 'Prospect'} · ${esc(c.name)}</small></button>`).join('')
      + ds.map((d) => `<button data-act="edit-deal" data-id="${esc(d.id)}"><b>${esc(d.title)}</b><small>Opportunité · ${esc((contact(d.contactId) || {}).company || '')} · ${esc(STAGE[d.stage]?.label || '')}</small></button>`).join('')
      || '<p class="empty" style="padding:8px 10px;margin:0">Aucun résultat.</p>';
    box.hidden = false;
  }

  // ---------- Actions ----------
  const ACT = {
    go: (ds) => { ui.view = ds.view; lsSet('view', ui.view); try { history.replaceState(null, '', '#' + ui.view); } catch { /* ignore */ } render(); window.scrollTo(0, 0); },
    scope: (ds) => { ui.scope = ds.v; lsSet('scope', ui.scope); render(); },
    ctype: (ds) => { ui.contactType = ds.v; render(); },
    atab: (ds) => { ui.actionTab = ds.v; render(); },
    period: (ds) => { ui.period = ds.v; render(); },
    week: (ds) => { const n = Number(ds.v); ui.weekStart = n === 0 ? startOfWeek(new Date()) : addDays(ui.weekStart, 7 * n); render(); },
    month: (ds) => { ui.objMonth = shiftMonth(ui.objMonth, Number(ds.v)); render(); },
    'new-menu': () => { const m = $('#new-menu'); m.hidden = !m.hidden; },
    'new-contact': () => editContact(),
    'edit-contact': (ds) => editContact(ds.id),
    'open-contact': (ds) => { ui.drawer = ds.id; ui.search = ''; $('#global-search').value = ''; $('#search-results').hidden = true; renderDrawer(); },
    'close-drawer': (ds, el, e) => { if (e.target === el) { ui.drawer = null; renderDrawer(); } },
    'close-drawer-btn': () => { ui.drawer = null; renderDrawer(); },
    'new-deal': (ds) => editDeal(null, ds.contact ? { contactId: ds.contact } : {}),
    'edit-deal': (ds) => { $('#search-results').hidden = true; editDeal(ds.id); },
    'new-action': (ds) => editAction(null, ds.contact ? { contactId: ds.contact } : {}),
    'edit-action': (ds) => editAction(ds.id),
    'toggle-action': async (ds) => { const a = get('actions', ds.id); if (!a) return; const done = !a.done; const ok = await put('actions', a.id, { ...a, done, doneAt: done ? todayISO() : '' }); if (ok && done) toast('Action réalisée. Pensez à planifier la suite.'); },
    'new-meeting': (ds) => editMeeting(null, ds.contact ? { contactId: ds.contact } : {}),
    'edit-meeting': (ds) => editMeeting(ds.id),
    slot: (ds, el, e) => { if (e.target !== el) return; const r = el.getBoundingClientRect(); const h = Math.min(19, Math.max(7, 7 + Math.floor((e.clientY - r.top) / 48))); editMeeting(null, { start: `${ds.date}T${pad(h)}:00` }); },
    convert: async (ds) => { const c = contact(ds.id); if (c && await put('contacts', c.id, { ...c, type: 'client', updatedAt: todayISO() })) toast(`${c.company} est maintenant client.`); },
    'edit-objective': (ds) => { if (!session.canEditObjectives()) { toast('Seuls les managers et administrateurs fixent les objectifs.'); return; } editObjective(ds.rep); },
    settings: () => openSettings(),
    'settings-tab': (ds) => openSettings(ds.v),
    'pick-color': (ds) => { settingsDraft.brandColor = ds.v; document.documentElement.style.setProperty('--brand', ds.v); $('#s-color').value = ds.v; document.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('on', b.dataset.v === ds.v)); },
    'logo-remove': () => { settingsDraft.logo = ''; refreshLogoBox(); },
    'save-company': () => saveCompany(),
    'edit-member': (ds) => editMember(ds.id),
    'user-menu': () => { const m = $('#user-menu'); m.hidden = !m.hidden; },
    password: () => changePassword(),
    relogin: () => relogin(),
    theme: () => {
      const root = document.documentElement;
      const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'light' : 'dark';
      lsSet('theme', root.dataset.theme);
      render();
    },
    logout: () => onLogout(),
    'sync-click': () => { if (session.status.state === 'auth') relogin(); else { session.syncNow(); toast(navigator.onLine ? 'Synchronisation lancée.' : 'Pas de connexion : vos modifications restent en attente sur cet appareil.'); } },
    'load-demo': () => { closeModal(); loadDemo(); },
    'clear-demo': (ds, el) => { if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Confirmer la suppression'; return; } closeModal(); clearDemo(); },
    'close-modal': (ds, el, e) => { if (e.target === el) closeModal(); },
    'close-modal-btn': () => closeModal(),
    'modal-delete': async (ds, el) => { if (!modalState) return; if (!modalState.armed) { modalState.armed = true; el.classList.add('armed'); el.textContent = 'Confirmer la suppression'; return; } const ok = await modalState.onDelete(); if (ok !== false) closeModal(); },
    copy: async (ds) => { try { await navigator.clipboard.writeText(ds.v); toast('Copié.'); } catch { toast('Copie impossible : sélectionnez le texte à la main.'); } },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    ['#new-menu', '#user-menu'].forEach((sel) => { const m = $(sel); if (m && !m.hidden && !e.target.closest('.menu-wrap')) m.hidden = true; });
    if (!e.target.closest('.search')) $('#search-results').hidden = true;
    if (!el) return;
    if (el.closest('.menu')) el.closest('.menu').hidden = true;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el.dataset, el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (modalState) closeModal(); else if (ui.drawer) { ui.drawer = null; renderDrawer(); } }
    if (e.key === 'Enter' && e.target.matches('.card')) editDeal(e.target.dataset.id);
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'global-search') { ui.search = e.target.value; renderSearch(); }
    if (e.target.id === 'contact-q') {
      ui.contactQuery = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const q = $('#contact-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); }
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'logo-file' && e.target.files[0]) {
      processLogo(e.target.files[0]).then((url) => { settingsDraft.logo = url; refreshLogoBox(); }).catch((err) => { const er = $('#form-error'); if (er) { er.textContent = err.message; er.hidden = false; } });
    }
    if (e.target.id === 's-color') ACT['pick-color']({ v: e.target.value });
    if (e.target.id === 'contact-owner') { ui.contactOwner = e.target.value; render(); }
    if (e.target.id === 'contact-source') { ui.contactSource = e.target.value; render(); }
  });

  // Glisser-déposer du pipeline
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    ui.dragging = true; ui.dragId = card.dataset.id;
    card.classList.add('dragging');
    try { e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch { /* ignore */ }
  });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col || !ui.dragging) return;
    e.preventDefault();
    document.querySelectorAll('.col.over').forEach((c) => c !== col && c.classList.remove('over'));
    col.classList.add('over');
  });
  document.addEventListener('drop', async (e) => {
    const col = e.target.closest && e.target.closest('.col');
    if (!col || !ui.dragging) return;
    e.preventDefault();
    const d = get('deals', ui.dragId);
    ui.dragging = false;
    if (d && d.stage !== col.dataset.stage) {
      await saveDeal(d, { ...d, stage: col.dataset.stage });
      toast(`« ${d.title} » passe en ${STAGE[col.dataset.stage].label}.`);
    }
    render();
  });
  document.addEventListener('dragend', () => {
    ui.dragging = false;
    document.querySelectorAll('.col.over, .card.dragging').forEach((c) => c.classList.remove('over', 'dragging'));
    if (ui.pendingRender) { ui.pendingRender = false; render(); }
  });
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS.some((x) => x.id === v) && v !== ui.view) ACT.go({ view: v }); });

  function refreshLogoBox() {
    const box = $('.logo-box');
    if (box) box.innerHTML = settingsDraft.logo ? `<img src="${esc(settingsDraft.logo)}" alt="Nouveau logo">` : '<span class="mark xl" aria-hidden="true"></span>';
    const actions = $('.logo-actions .actions-bar');
    if (actions && settingsDraft.logo && !actions.querySelector('[data-act=logo-remove]')) actions.insertAdjacentHTML('beforeend', '<button type="button" class="btn sm ghost" data-act="logo-remove">Retirer</button>');
  }

  // ---------- Démarrage ----------
  shell();
  render();
  store.on(() => scheduleRender());
  session.onStatus(() => scheduleRender());
  session.syncNow();
}
