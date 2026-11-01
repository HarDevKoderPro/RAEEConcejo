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
  migrar(db);
  db.exec(fs.readFileSync(RUTA_SCHEMA, 'utf8'));
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_documento ON usuarios(documento) WHERE documento IS NOT NULL');
}

// Columnas agregadas después de crear la base de producción (CREATE TABLE IF NOT EXISTS no las añade).
function migrar(db) {
  const existe = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'").get();
  if (!existe) return;
  const columnas = db.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name);
  if (!columnas.includes('documento')) db.exec('ALTER TABLE usuarios ADD COLUMN documento TEXT');
  if (!columnas.includes('activo')) db.exec('ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1))');
}

export function sembrar(db) {
  db.exec(fs.readFileSync(RUTA_SEED, 'utf8'));
}

export function contarPiezas(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM piezas').get().n;
}
