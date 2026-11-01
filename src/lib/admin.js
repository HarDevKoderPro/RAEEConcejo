// Tareas de administración (CLAUDE.md §7, /admin): usuarios, configuración, respaldo y limpieza
// de los datos de demostración.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { borrarFoto } from './fotos.js';

// --- Datos de demostración ------------------------------------------------------------------
export function resumenDemo(db) {
  return db.prepare('SELECT COUNT(*) AS piezas, (SELECT COUNT(*) FROM piezas WHERE demo = 0) AS reales FROM piezas WHERE demo = 1').get();
}

// Borra solo las filas demo = 1 (y su historial, por ON DELETE CASCADE). RAEE-0001 es real
// (demo = 0) y no se toca. Las etiquetas impresas se conservan: siguen pegadas en las piezas.
export function limpiarDemo(db, fotosDir) {
  const fotos = db.prepare('SELECT foto FROM piezas WHERE demo = 1 AND foto IS NOT NULL').all().map((f) => f.foto);
  const borradas = db.transaction(() => db.prepare('DELETE FROM piezas WHERE demo = 1').run().changes)();
  if (fotosDir) for (const f of fotos) borrarFoto(f, fotosDir);
  return borradas;
}

// --- Configuración ---------------------------------------------------------------------------
export const CLAVES_CONFIG = ['meta_semestre', 'nombre_sala', 'equipo', 'instructor'];

export function leerConfig(db) {
  const filas = db.prepare('SELECT clave, valor FROM config').all();
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

export function guardarConfig(db, datos) {
  const errores = {};
  const meta = Number(String(datos.meta_semestre ?? '').trim());
  if (!Number.isInteger(meta) || meta < 1 || meta > 100000) errores.meta_semestre = 'Escribe un número entero de piezas (por ejemplo, 100).';
  const nombreSala = String(datos.nombre_sala ?? '').trim().slice(0, 80);
  if (!nombreSala) errores.nombre_sala = 'Escribe el nombre de la sala.';
  if (Object.keys(errores).length) return { errores };
  const equipo = String(datos.equipo ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((l) => l.slice(0, 80))
    .join('\n');
  const instructor = String(datos.instructor ?? '').trim().slice(0, 80);
  const poner = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  db.transaction(() => {
    poner.run('meta_semestre', String(meta));
    poner.run('nombre_sala', nombreSala);
    poner.run('equipo', equipo);
    poner.run('instructor', instructor);
  })();
  return { errores: null };
}

// --- Usuarios ----------------------------------------------------------------------------------
export function listarUsuarios(db) {
  return db.prepare('SELECT id, usuario, nombre, documento, rol, activo, creado_en FROM usuarios ORDER BY activo DESC, rol, nombre').all();
}

// Desactivar en vez de borrar: el usuario ya no entra, pero su nombre sigue en el historial.
// Al desactivar se cierran sus sesiones abiertas. No permite quedarse sin administradores activos.
export function cambiarActivo(db, id, activo, quien) {
  const u = db.prepare('SELECT id, usuario, nombre, rol, activo FROM usuarios WHERE id = ?').get(Number(id));
  if (!u) throw new Error('Ese usuario no existe.');
  if (!activo) {
    if (u.usuario === quien) throw new Error('No puedes desactivar tu propio usuario.');
    if (u.rol === 'admin' && db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1").get().n <= 1) {
      throw new Error('Debe quedar al menos un administrador activo.');
    }
  }
  db.transaction(() => {
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, u.id);
    const sesiones = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sessions'").get();
    if (!activo && sesiones) {
      db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.usuario.usuario') = ?").run(u.usuario);
    }
  })();
  return u;
}

export function listarEliminadas(db, limite = 20) {
  return db
    .prepare(
      `SELECT e.id, e.pieza_id, e.categoria, e.motivo, e.fecha, e.usuario, COALESCE(u.nombre, e.usuario) AS nombre
         FROM piezas_eliminadas e LEFT JOIN usuarios u ON u.usuario = e.usuario
        ORDER BY e.fecha DESC, e.id DESC LIMIT ?`,
    )
    .all(limite);
}

// --- Respaldo ------------------------------------------------------------------------------------
// Copia en caliente de la base (API de respaldo de SQLite) a un archivo temporal.
export async function crearRespaldo(db) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'raee-respaldo-'));
  const archivo = path.join(dir, 'raee.db');
  await db.backup(archivo);
  return {
    archivo,
    limpiar: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
