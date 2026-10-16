// Démarrage du serveur ZEBRE CRM.
import path from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || path.resolve('data');
const app = createApp({ dataDir });
app.listen(port, () => {
  console.log(`ZEBRE CRM démarré sur http://localhost:${port}`);
  if (!process.env.SUPERADMIN_EMAIL) console.log('Astuce : définissez SUPERADMIN_EMAIL et SUPERADMIN_PASSWORD pour accéder à la console des licences.');
});
