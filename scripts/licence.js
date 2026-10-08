// Génère une licence depuis la ligne de commande, sans passer par la console web.
// Exemple : npm run licence -- --plan pro --users 10 --months 12 --client "Boulangerie Le Fournil"
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openDb } from '../server/db.js';
import { loadSecrets, createLicenceKey, PLANS, licenceId } from '../server/security.js';

const { values } = parseArgs({ options: { plan: { type: 'string', default: 'pro' }, users: { type: 'string' }, months: { type: 'string', default: '12' }, client: { type: 'string', default: '' } } });
const plan = PLANS[values.plan] ? values.plan : 'pro';
const maxUsers = Number(values.users) || PLANS[plan].maxUsers;
const d = new Date(); d.setMonth(d.getMonth() + (Number(values.months) || 12));
const expiresAt = d.toISOString().slice(0, 10);
const dataDir = process.env.DATA_DIR || path.resolve('data');
const secrets = loadSecrets(dataDir);
const db = openDb(path.join(dataDir, 'zebre.db'));
const id = licenceId();
const key = createLicenceKey(secrets.privateKey, { id, plan, maxUsers, expiresAt, customer: values.client });
db.prepare('INSERT INTO licences(id, plan, max_users, expires_at, customer, licence_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, plan, maxUsers, expiresAt, values.client, key, new Date().toISOString());
console.log(`Licence ${PLANS[plan].label} · ${maxUsers} utilisateurs · valable jusqu'au ${expiresAt}\n\n${key}\n`);
