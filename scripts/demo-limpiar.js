// Borra los datos de demostración (demo = 1) y su historial. Pide confirmación.
//   npm run demo:limpiar
//   En el VPS:  docker exec -it raee-app-1 npm run demo:limpiar
// Las piezas reales (como RAEE-0001) y las etiquetas impresas no se tocan.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { config } from '../src/config.js';
import { abrirDb } from '../src/db.js';
import { resumenDemo, limpiarDemo } from '../src/lib/admin.js';

const FRASE = 'BORRAR DEMO';

if (!fs.existsSync(config.dbPath)) {
  console.error(`No existe la base ${config.dbPath}.`);
  process.exit(1);
}

const db = abrirDb(config.dbPath);
try {
  const { piezas, reales } = resumenDemo(db);
  if (!piezas) {
    console.log('✔ No hay datos de demostración: no hay nada que borrar.');
  } else {
    console.log(`Se borrarán ${piezas} piezas de demostración con su historial.`);
    console.log(`Quedarán ${reales} pieza(s) real(es) sin cambios.\n`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const respuesta = await rl.question(`Para confirmar escribe ${FRASE}: `);
    rl.close();
    if (respuesta.trim().toUpperCase() !== FRASE) {
      console.log('Cancelado: no se borró nada.');
    } else {
      const n = limpiarDemo(db, path.resolve(config.fotosDir));
      console.log(`✔ Se borraron ${n} piezas de demostración.`);
    }
  }
} finally {
  db.close();
}
