// Console éditeur : création et suivi des licences vendues aux entreprises.
import { api } from './api.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function mountAdmin(acc, { onLogout }) {
  let data = { licences: [], stats: {}, plans: {} };
  let filter = 'all';
  let created = null;
  let error = '';

  const call = (m, p, b) => api(m, p, b, acc.token);

  function statusPill(l) {
    if (l.status === 'suspended') return '<span class="pill lost">Suspendue</span>';
    if (l.expired) return '<span class="pill lost">Expirée</span>';
    if (!l.tenant) return '<span class="pill prospect">Disponible</span>';
    const days = Math.ceil((Date.parse(l.expiresAt) - Date.now()) / 86400000);
    return days <= 30 ? `<span class="pill today">Expire dans ${days} j</span>` : '<span class="pill won">Active</span>';
  }

  function render() {
    const s = data.stats;
    const rows = data.licences.filter((l) => filter === 'all' || (filter === 'free' ? !l.tenant && l.usable : filter === 'used' ? l.tenant && l.usable : !l.usable));
    const planOpts = Object.entries(data.plans).map(([k, p]) => `<option value="${k}" ${k === 'pro' ? 'selected' : ''}>${esc(p.label)} · ${p.maxUsers} utilisateurs</option>`).join('');
    $('#app').innerHTML = `<div class="admin">
      <header class="admin-top">
        <div class="brand"><span class="mark" aria-hidden="true"></span><div><b>ZEBRE CRM</b><small>Console éditeur · licences</small></div></div>
        <span class="muted">${esc(acc.email)}</span>
        <button class="btn sm" id="logout">Se déconnecter</button>
      </header>
      <main class="content enter">
        ${error ? `<div class="banner bad"><span>${esc(error)}</span><button class="btn sm" id="retry">Réessayer</button></div>` : ''}
        <section class="kpis">
          <div class="kpi"><span class="lbl">Entreprises clientes</span><span class="val">${s.companies ?? '—'}</span></div>
          <div class="kpi"><span class="lbl">Utilisateurs actifs</span><span class="val">${s.users ?? '—'}</span></div>
          <div class="kpi"><span class="lbl">Licences en service</span><span class="val">${s.active ?? '—'}</span><span class="note">${s.available ?? 0} disponibles à vendre</span></div>
          <div class="kpi ${s.expired ? 'bad' : ''}"><span class="lbl">Expirées ou suspendues</span><span class="val">${s.expired ?? '—'}</span></div>
        </section>
        <div class="grid2" style="grid-template-columns:minmax(min(320px,100%),1fr) minmax(0,2fr)">
          <section class="panel">
            <header><h2>Nouvelle licence</h2></header>
            <form id="new-licence" class="form" novalidate>
              <div class="f wide"><label for="n-customer">Client</label><input id="n-customer" type="text" placeholder="Ex. Boulangerie Le Fournil"></div>
              <div class="f wide"><label for="n-plan">Offre</label><select id="n-plan">${planOpts}</select></div>
              <div class="f"><label for="n-users">Utilisateurs</label><input id="n-users" type="number" min="1" max="1000" placeholder="Selon l’offre"></div>
              <div class="f"><label for="n-months">Durée</label><select id="n-months"><option value="1">1 mois</option><option value="3">3 mois</option><option value="6">6 mois</option><option value="12" selected>12 mois</option><option value="24">24 mois</option><option value="36">36 mois</option></select></div>
              <div class="f wide"><button class="btn primary" type="submit">Générer la licence</button></div>
            </form>
            ${created ? `<div class="key-box"><b>Licence ${esc(created.planLabel)} pour ${esc(created.customer || 'nouveau client')}</b>
              <small class="muted">Envoyez cette clé au client. Il la colle dans « Créer mon entreprise », en ligne ou hors ligne.</small>
              <code id="new-key">${esc(created.key)}</code><button class="btn sm" data-copy="${esc(created.key)}">Copier la clé</button></div>` : ''}
          </section>
          <section class="panel">
            <header><h2>Licences</h2><div class="seg right" role="group" aria-label="Filtre">${[['all', 'Toutes'], ['used', 'En service'], ['free', 'Disponibles'], ['off', 'Inactives']].map(([k, l]) => `<button data-filter="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div></header>
            <div class="table-wrap"><table>
              <thead><tr><th>Client</th><th>Offre</th><th class="num">Utilisateurs</th><th>Échéance</th><th>État</th><th></th></tr></thead>
              <tbody>${rows.map((l) => `<tr>
                <td class="cell-main"><b>${esc(l.tenant ? l.tenant.name : l.customer || 'Non attribuée')}</b><small>${esc(l.owner ? l.owner.email : 'N° ' + l.id)}</small></td>
                <td>${esc(l.planLabel)}</td>
                <td class="num">${l.tenant ? `${l.seatsUsed} / ${l.maxUsers}` : l.maxUsers}</td>
                <td>${esc(fmt(l.expiresAt))}</td>
                <td>${statusPill(l)}</td>
                <td class="row-actions"><button class="btn sm ghost" data-copy="${esc(l.key)}">Copier la clé</button>
                  <button class="btn sm" data-extend="${esc(l.id)}">+12 mois</button>
                  <button class="btn sm ${l.status === 'active' ? 'danger' : ''}" data-toggle="${esc(l.id)}" data-status="${l.status === 'active' ? 'suspended' : 'active'}">${l.status === 'active' ? 'Suspendre' : 'Réactiver'}</button></td>
              </tr>`).join('') || '<tr><td colspan="6" class="empty">Aucune licence pour l’instant. Générez la première à gauche.</td></tr>'}</tbody>
            </table></div>
          </section>
        </div>
      </main>
      <div id="toast-root"></div>
    </div>`;
  }

  function toast(msg) {
    const root = $('#toast-root');
    if (!root) return;
    root.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { root.innerHTML = ''; }, 3200);
  }

  async function load() {
    try { data = await call('GET', '/api/admin/licences'); error = ''; } catch (e) {
      error = e.offline ? 'La console des licences nécessite une connexion Internet.' : e.message;
      if (e.status === 401) { onLogout(); return; }
    }
    render();
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.id === 'logout') return onLogout();
    if (t.id === 'retry') return load();
    if (t.dataset.filter) { filter = t.dataset.filter; return render(); }
    if (t.dataset.copy) {
      try { await navigator.clipboard.writeText(t.dataset.copy); toast('Clé copiée.'); } catch { toast('Copie impossible : sélectionnez la clé à la main.'); }
      return;
    }
    try {
      if (t.dataset.extend) { await call('PUT', `/api/admin/licences/${t.dataset.extend}`, { extendMonths: 12 }); toast('Licence prolongée de 12 mois.'); }
      if (t.dataset.toggle) { await call('PUT', `/api/admin/licences/${t.dataset.toggle}`, { status: t.dataset.status }); toast(t.dataset.status === 'active' ? 'Licence réactivée.' : 'Licence suspendue : l’entreprise passe en lecture seule.'); }
      if (t.dataset.extend || t.dataset.toggle) load();
    } catch (ex) { toast(ex.message); }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'new-licence') return;
    e.preventDefault();
    try {
      created = await call('POST', '/api/admin/licences', { customer: $('#n-customer').value, plan: $('#n-plan').value, maxUsers: Number($('#n-users').value) || undefined, months: Number($('#n-months').value) });
      toast('Licence générée.');
      load();
    } catch (ex) { toast(ex.message); }
  });

  render();
  load();
}
