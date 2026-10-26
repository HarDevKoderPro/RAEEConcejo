import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_SCHEMA = path.join(raiz, 'db', 'schema.sql');
const RUTA_SEED = path.join(raiz, 'db', 'seed.sql');

// Abre (o crea) la base. db/schema.sql es la fuente de verdad del modelo.
export function abrirDb(ruta) {
  fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  const db = new Database(ruta);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  return db;
}

export function aplicarEsquema(db) {
  db.exec(fs.readFileSync(RUTA_SCHEMA, 'utf8'));
}

export function sembrar(db) {
  db.exec(fs.readFileSync(RUTA_SEED, 'utf8'));
}

export function contarPiezas(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM piezas').get().n;
}
