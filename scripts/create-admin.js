// Crée ou réinitialise le compte super administrateur (console des licences).
// Exemple : npm run admin -- vous@exemple.com "MotDePasseSolide"
import path from 'node:path';
import { createApp } from '../server/app.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage : npm run admin -- <email> <mot de passe de 8 caractères minimum>');
  process.exit(1);
}
createApp({ dataDir: process.env.DATA_DIR || path.resolve('data'), superadmin: { email, password } });
console.log(`Compte super administrateur prêt : ${email}`);
