import fs from 'node:fs';
import { config } from './config.js';
import { abrirDb, aplicarEsquema } from './db.js';
import { crearApp } from './app.js';

if (!fs.existsSync(config.dbPath)) {
  console.error(`No existe la base ${config.dbPath}. Créala con: npm run db:seed`);
  process.exit(1);
}

const db = abrirDb(config.dbPath);
aplicarEsquema(db); // idempotente: crea tablas nuevas y agrega columnas tras una actualización
const app = crearApp({ db });

const servidor = app.listen(config.puerto, () => {
  console.log(`Inventario RAEE en http://localhost:${config.puerto}`);
});

function cerrar() {
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
