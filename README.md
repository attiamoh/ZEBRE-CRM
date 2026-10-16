# ZEBRE CRM

CRM commercial collaboratif pour PME et équipes commerciales. Vos prospects ne se perdent plus dans WhatsApp, les appels ou les carnets de notes : tout est centralisé dans un seul espace, **en ligne comme hors ligne**.

- **Prospects & clients** : fiches contact, source (WhatsApp, appel, salon…), responsable, historique.
- **Opportunités & pipeline** : tableau en colonnes avec glisser-déposer, montants pondérés.
- **Relances & actions** : en retard, du jour, à venir, et prospects sans relance.
- **Rendez-vous & planning** : agenda à la semaine (liste par jour sur mobile).
- **Objectifs & performances** : objectifs mensuels par commercial, classement.
- **Rapports d'équipe** : tableau par commercial, CA par mois, entonnoir, origine des contacts, activité.

## Vendre ZEBRE CRM à plusieurs entreprises

Chaque entreprise cliente a son propre espace, isolé des autres, avec :

- son **logo** et sa **couleur de marque** (menu, boutons, graphiques) ;
- sa **licence** : offre, nombre d'utilisateurs maximum et date d'expiration ;
- son équipe : propriétaire, administrateurs, managers et commerciaux.

### Offres

| Offre | Utilisateurs par défaut |
| --- | --- |
| Essentiel | 3 |
| Pro | 10 |
| Entreprise | 50 |

Le nombre d'utilisateurs et la durée se règlent pour chaque licence.

### Le parcours de vente

1. Vous vous connectez avec le compte éditeur (`SUPERADMIN_EMAIL`) : la **console des licences** s'ouvre.
2. Vous générez une licence (client, offre, utilisateurs, durée) et vous envoyez la clé `ZB1.…` au client.
3. Le client ouvre ZEBRE CRM, choisit **Créer mon entreprise** et colle la clé. Une clé ne sert qu'à une seule entreprise.
4. Depuis la console, vous prolongez (+12 mois), suspendez ou réactivez une licence. Une licence expirée ou suspendue passe l'entreprise en **lecture seule** : les données restent consultables, les modifications sont bloquées.

Les licences peuvent aussi être générées en ligne de commande :

```bash
npm run licence -- --plan pro --users 10 --months 12 --client "Boulangerie Le Fournil"
```

## Inscription et travail hors ligne

ZEBRE CRM est une application web installable (PWA). Après une première ouverture, elle démarre sans connexion.

- **Inscription hors ligne** : la clé de licence est signée (ECDSA P-256). Le navigateur vérifie la signature lui-même, crée l'entreprise et le compte sur l'appareil, et envoie l'inscription au serveur dès le retour de la connexion. Les fiches créées entre-temps sont envoyées ensuite.
- **Connexion hors ligne** : sur un appareil déjà utilisé, le mot de passe est vérifié localement et les données enregistrées sur l'appareil s'ouvrent.
- **Synchronisation** : chaque modification est d'abord enregistrée sur l'appareil (IndexedDB), puis envoyée au serveur. Les nouveautés de l'équipe arrivent toutes les 20 secondes, au retour de la connexion et à chaque retour sur l'onglet. En cas de modification simultanée d'une même fiche, la dernière envoyée l'emporte.

Points à connaître :

- La toute première connexion d'un **membre d'équipe** sur un appareil doit se faire en ligne (son compte est créé par un administrateur sur le serveur).
- La gestion de l'équipe et la console des licences nécessitent une connexion.
- Le mot de passe ne quitte jamais l'appareil en clair : le navigateur envoie une clé dérivée (PBKDF2), que le serveur stocke elle-même hachée (scrypt).

## Installation

Prérequis : **Node.js 22.13 ou plus récent** (la base SQLite est intégrée à Node, aucune compilation nécessaire).

```bash
npm install
cp .env.example .env   # puis renseignez SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD
SUPERADMIN_EMAIL=vous@exemple.com SUPERADMIN_PASSWORD='mot-de-passe-solide' npm start
```

L'application est servie sur <http://localhost:3000>.

Vous pouvez aussi créer ou réinitialiser le compte éditeur à tout moment :

```bash
npm run admin -- vous@exemple.com 'mot-de-passe-solide'
```

### Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `PORT` | Port HTTP (3000 par défaut). |
| `DATA_DIR` | Dossier de la base `zebre.db` et de `secrets.json` (`./data` par défaut). |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Compte éditeur, créé ou mis à jour au démarrage. |
| `SESSION_SECRET` | Facultatif. Secret des sessions, sinon généré dans `secrets.json`. |
| `LICENCE_PRIVATE_KEY` | Facultatif. Clé privée de signature des licences (PEM), sinon générée dans `secrets.json`. |

> **Important : sauvegardez `DATA_DIR`.** `secrets.json` contient la clé qui signe les licences. Si elle est perdue, les clés déjà vendues ne sont plus reconnues pour une inscription hors ligne et toutes les sessions sont fermées.

## Mise en production

L'application doit être servie en **HTTPS** (obligatoire pour l'installation sur mobile et le mode hors ligne).

Avec Docker :

```bash
docker build -t zebre-crm .
docker run -d -p 3000:3000 -v zebre-data:/data \
  -e SUPERADMIN_EMAIL=vous@exemple.com -e SUPERADMIN_PASSWORD='mot-de-passe-solide' zebre-crm
```

Sur un hébergeur (Render, Railway, Fly.io, un VPS…), prévoyez un **disque persistant** monté sur `DATA_DIR`. Sans disque persistant, fournissez `SESSION_SECRET` et `LICENCE_PRIVATE_KEY` en variables d'environnement, et utilisez un stockage durable pour la base.

## Développement

```bash
npm run dev    # redémarre le serveur à chaque modification
npm test       # tests de l'API (licences, inscription, isolation, synchronisation, limites)
```

### Organisation du code

```
server/
  app.js        API : inscription, connexion, équipe, entreprise, synchronisation, console des licences
  db.js         schéma SQLite
  security.js   mots de passe, jetons de session, licences signées
  index.js      démarrage
public/
  index.html, sw.js, manifest.webmanifest   application installable et hors ligne
  css/app.css
  js/main.js     connexion et inscription
  js/session.js  session, inscription différée, synchronisation
  js/store.js    stockage local IndexedDB et file d'envoi
  js/auth.js     dérivation du mot de passe, vérification des licences
  js/crm.js      modules du CRM et paramètres
  js/admin.js    console des licences
  js/demo.js     données de démonstration
scripts/        génération de licence, compte éditeur
test/           tests de l'API
```
