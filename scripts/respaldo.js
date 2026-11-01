// Copia en caliente de la base (API de respaldo de SQLite, segura con la app en marcha).
//   node scripts/respaldo.js /ruta/destino.db
// En el VPS lo llama scripts/respaldo.sh dentro del contenedor.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../src/config.js';

const destino = process.argv[2];
if (!destino) {
  console.error('Uso: node scripts/respaldo.js /ruta/destino.db');
  process.exit(1);
}
if (!fs.existsSync(config.dbPath)) {
  console.error(`No existe la base ${config.dbPath}.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(path.resolve(destino)), { recursive: true });
const db = new Database(config.dbPath, { readonly: true, fileMustExist: true });
await db.backup(destino);
db.close();
console.log(`Respaldo listo: ${destino}`);
