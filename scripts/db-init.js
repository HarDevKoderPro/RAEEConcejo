// Crea la base desde db/schema.sql y, con --seed, carga db/seed.sql.
//   npm run db:init
//   npm run db:seed
//   npm run db:seed -- --force   (rehace la base; antes guarda una copia)
import fs from 'node:fs';
import { config } from '../src/config.js';
import { abrirDb, aplicarEsquema, sembrar, contarPiezas } from '../src/db.js';

const args = process.argv.slice(2);
const conSeed = args.includes('--seed');
const forzar = args.includes('--force');
const ruta = config.dbPath;

let db = abrirDb(ruta);
aplicarEsquema(db);

if (conSeed) {
  const piezas = contarPiezas(db);
  if (piezas > 0) {
    if (!forzar) {
      console.error(`La base ${ruta} ya tiene ${piezas} piezas. No se sembró nada.`);
      console.error('Para rehacerla desde cero: npm run db:seed -- --force');
      db.close();
      process.exit(1);
    }
    const copia = ruta.replace(/\.db$/, '') + `-antes-de-seed-${Date.now()}.db`;
    await db.backup(copia);
    db.close();
    for (const sufijo of ['', '-wal', '-shm']) fs.rmSync(ruta + sufijo, { force: true });
    console.log(`Copia de la base anterior: ${copia}`);
    db = abrirDb(ruta);
    aplicarEsquema(db);
  }
  sembrar(db);
}

console.log(`Base lista en ${ruta}: ${contarPiezas(db)} piezas.`);
db.close();
