// Base temporal sembrada para las pruebas. Nunca se usa data/raee.db.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirDb, aplicarEsquema, sembrar } from '../src/db.js';

export function crearDbPrueba() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raee-prueba-'));
  const db = abrirDb(path.join(dir, 'raee.db'));
  aplicarEsquema(db);
  sembrar(db);
  return {
    db,
    limpiar() {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
