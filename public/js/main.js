// Démarrage : thème, mode hors ligne (service worker), écran de connexion ou d'inscription, puis CRM.
import { login, registerCompany, startSession } from './session.js';
import { accounts, currentEmail, setCurrent, readLicence } from './auth.js';
import { mountCrm } from './crm.js';
import { mountAdmin } from './admin.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

try { const t = JSON.parse(localStorage.getItem('zebre-theme')); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; } catch { /* aucun thème enregistré */ }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

function logout() { setCurrent(''); history.replaceState(null, '', '/'); location.reload(); }

async function boot() {
  const email = currentEmail();
  const acc = email && accounts()[email];
  try {
    if (acc && acc.superadmin && acc.token) return mountAdmin(acc, { onLogout: logout });
    if (acc && acc.tenantId) return mountCrm(await startSession(acc), { onLogout: logout });
  } catch (e) {
    console.error(e);
  }
  showAuth();
}

const FEATURES = ['Prospects & clients', 'Opportunités & pipeline', 'Relances & actions commerciales', 'Rendez-vous & planning', 'Objectifs & performances', 'Rapports et suivi de l’équipe'];

function showAuth(tab = 'login', notice = '') {
  const known = Object.values(accounts()).filter((a) => !a.superadmin);
  $('#app').innerHTML = `<div class="auth">
    <section class="auth-hero">
      <div class="stripes" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="brand big"><span class="mark" aria-hidden="true"></span><div><b>ZEBRE CRM</b><small>CRM commercial collaboratif</small></div></div>
        <h1>Vos prospects ne doivent plus se perdre dans WhatsApp, les appels ou les carnets de notes.</h1>
        <p>Centralisez toute votre activité commerciale dans un seul espace, même sans connexion Internet.</p>
        <ul class="checks">${FEATURES.map((f) => `<li><span aria-hidden="true">✓</span>${esc(f)}</li>`).join('')}</ul>
      </div>
    </section>
    <section class="auth-panel">
      <div class="auth-card">
        <div class="net" id="net"></div>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" aria-selected="${tab === 'login'}" data-tab="login">Se connecter</button>
          <button type="button" role="tab" aria-selected="${tab === 'register'}" data-tab="register">Créer mon entreprise</button>
        </div>
        ${notice ? `<div class="banner info"><span>${esc(notice)}</span></div>` : ''}
        ${tab === 'login' ? `
        <form id="login-form" class="auth-form" novalidate>
          <h2>Bon retour</h2>
          <p class="muted">Connectez-vous avec l’e-mail fourni par votre entreprise.</p>
          ${known.length ? `<div class="known">${known.map((a) => `<button type="button" class="chip" data-email="${esc(a.email)}">${esc(a.email)}</button>`).join('')}</div>` : ''}
          <label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required>
          <label for="l-pass">Mot de passe</label><input id="l-pass" type="password" autocomplete="current-password" required>
          <p class="err" id="auth-err" hidden></p>
          <button class="btn primary block" type="submit">Se connecter</button>
          <small class="muted">Hors ligne, vous pouvez vous connecter sur un appareil déjà utilisé : vos données sont enregistrées dessus.</small>
        </form>` : `
        <form id="register-form" class="auth-form" novalidate>
          <h2>Activez votre licence</h2>
          <p class="muted">Collez la clé de licence reçue de ZEBRE CRM. L’inscription fonctionne aussi hors ligne : elle sera envoyée dès le retour de la connexion.</p>
          <label for="r-key">Clé de licence</label><textarea id="r-key" rows="3" spellcheck="false" placeholder="ZB1.…" required></textarea>
          <div class="lic-status" id="r-lic" aria-live="polite"></div>
          <div class="two"><div><label for="r-company">Entreprise</label><input id="r-company" type="text" autocomplete="organization" required></div>
          <div><label for="r-cur">Devise</label><select id="r-cur"><option value="FCFA">FCFA</option><option value="€">Euro (€)</option><option value="$">Dollar ($)</option><option value="MAD">Dirham (MAD)</option><option value="DA">Dinar (DA)</option><option value="GNF">Franc guinéen</option><option value="FC">Franc congolais</option></select></div></div>
          <label for="r-name">Votre nom</label><input id="r-name" type="text" autocomplete="name" required>
          <label for="r-email">E-mail</label><input id="r-email" type="email" autocomplete="username" required>
          <div class="two"><div><label for="r-pass">Mot de passe</label><input id="r-pass" type="password" autocomplete="new-password" minlength="8" required></div>
          <div><label for="r-pass2">Confirmation</label><input id="r-pass2" type="password" autocomplete="new-password" required></div></div>
          <p class="err" id="auth-err" hidden></p>
          <button class="btn primary block" type="submit">Créer mon espace</button>
        </form>`}
      </div>
    </section>
  </div>`;
  const net = () => { const n = $('#net'); if (n) { n.className = `net ${navigator.onLine ? 'on' : 'off'}`; n.innerHTML = `<i></i>${navigator.onLine ? 'En ligne' : 'Hors ligne · inscription et connexion locales possibles'}`; } };
  net();
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => showAuth(b.dataset.tab)));
  document.querySelectorAll('.chip[data-email]').forEach((b) => b.addEventListener('click', () => { $('#l-email').value = b.dataset.email; $('#l-pass').focus(); }));
  const err = (m) => { const e = $('#auth-err'); e.textContent = m; e.hidden = !m; };
  const busy = (form, on, label) => { const b = form.querySelector('button[type=submit]'); b.disabled = on; if (label) b.textContent = label; };

  const lf = $('#login-form');
  if (lf) {
    $('#l-email').value = known.length === 1 ? known[0].email : '';
    (known.length === 1 ? $('#l-pass') : $('#l-email')).focus();
    lf.addEventListener('submit', async (e) => {
      e.preventDefault();
      err('');
      const email = $('#l-email').value.trim();
      const pass = $('#l-pass').value;
      if (!email || !pass) return err('Renseignez votre e-mail et votre mot de passe.');
      busy(lf, true, 'Connexion…');
      try { await login(email, pass); boot(); } catch (ex) { err(ex.message); busy(lf, false, 'Se connecter'); }
    });
  }

  const rf = $('#register-form');
  if (rf) {
    $('#r-key').focus();
    let licOk = null;
    $('#r-key').addEventListener('input', async () => {
      const key = $('#r-key').value.trim();
      const box = $('#r-lic');
      if (!key) { box.innerHTML = ''; licOk = null; return; }
      const lic = await readLicence(key);
      licOk = lic;
      const expired = lic && lic.expiresAt < new Date().toISOString().slice(0, 10);
      box.className = `lic-status ${lic && !expired ? 'ok' : 'bad'}`;
      box.innerHTML = lic
        ? (expired ? `Licence expirée le ${esc(lic.expiresAt)}.` : `<b>Licence ${esc(lic.planLabel)} valide</b> · ${lic.maxUsers} utilisateurs · jusqu’au ${esc(new Date(lic.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}`)
        : 'Clé non reconnue. Vérifiez qu’elle a été copiée en entier.';
      if (lic && lic.customer && !$('#r-company').value) $('#r-company').value = lic.customer;
    });
    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      err('');
      const v = { licenceKey: $('#r-key').value, companyName: $('#r-company').value, currency: $('#r-cur').value, name: $('#r-name').value, email: $('#r-email').value, password: $('#r-pass').value };
      if (!v.licenceKey.trim() || !v.companyName.trim() || !v.name.trim() || !v.email.trim()) return err('Tous les champs sont obligatoires.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return err('Adresse e-mail invalide.');
      if (v.password.length < 8) return err('Le mot de passe doit faire au moins 8 caractères.');
      if (v.password !== $('#r-pass2').value) return err('Les deux mots de passe ne correspondent pas.');
      if (licOk === null) licOk = await readLicence(v.licenceKey);
      busy(rf, true, 'Création de votre espace…');
      try {
        await registerCompany(v);
        boot();
      } catch (ex) { err(ex.message); busy(rf, false, 'Créer mon espace'); }
    });
  }
}

boot();
