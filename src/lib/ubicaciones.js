// Mapa visual de la sala (CLAUDE.md §7, /ubicaciones): responde "¿dónde está?" al revés.
import { kg } from './formato.js';

// Tipo de lugar a partir del código: S1-C1 = caja, S1-E1 = estante, S1-RAEE = punto de acopio.
export function tipoUbicacion(codigo) {
  const sufijo = String(codigo).split('-').slice(1).join('-').toUpperCase();
  if (sufijo.startsWith('RAEE')) return { tipo: 'acopio', icono: '♻️', nombre: 'Punto de acopio' };
  if (sufijo.startsWith('E')) return { tipo: 'estante', icono: '🗄️', nombre: 'Estante' };
  if (sufijo.startsWith('C')) return { tipo: 'caja', icono: '📦', nombre: 'Caja' };
  return { tipo: 'otro', icono: '📍', nombre: 'Lugar' };
}

// Sala a partir del código (S1-… → "Sala 1"); si no sigue el patrón, "Otros lugares".
function salaDe(codigo) {
  const m = String(codigo).match(/^S(\d+)-/i);
  return m ? { clave: `S${m[1]}`, nombre: `Sala ${m[1]}` } : { clave: 'OTROS', nombre: 'Otros lugares' };
}

function resumenPorUbicacion(db) {
  const conteos = db
    .prepare(
      `SELECT ubicacion, COUNT(*) AS piezas, ROUND(SUM(peso_kg), 2) AS kg
         FROM v_piezas GROUP BY ubicacion`,
    )
    .all();
  const iconos = db
    .prepare(
      `SELECT ubicacion, icono, categoria, COUNT(*) AS n
         FROM v_piezas GROUP BY ubicacion, categoria_id ORDER BY n DESC, categoria`,
    )
    .all();
  const porCodigo = new Map(conteos.map((c) => [c.ubicacion, { ...c, contenido: [] }]));
  for (const i of iconos) porCodigo.get(i.ubicacion)?.contenido.push(i);
  return porCodigo;
}

function tarjeta(u, resumen) {
  const r = resumen.get(u.codigo) ?? { piezas: 0, kg: 0, contenido: [] };
  const { tipo, icono, nombre: tipo_nombre } = tipoUbicacion(u.codigo);
  return {
    ...u,
    tipo,
    icono,
    tipo_nombre,
    // Dentro del grupo de su sala basta "Caja 1" (sin repetir "Sala 1 · ").
    nombre_corto: u.nombre.replace(/^Sala\s+\d+\s*·\s*/i, ''),
    piezas: r.piezas,
    kg_texto: kg(r.kg),
    contenido: r.contenido,
  };
}

// Ubicaciones agrupadas por sala, con conteo e íconos de lo que contiene cada una.
export function mapaUbicaciones(db) {
  const resumen = resumenPorUbicacion(db);
  const salas = new Map();
  for (const u of db.prepare('SELECT codigo, nombre, descripcion FROM ubicaciones ORDER BY codigo').all()) {
    const sala = salaDe(u.codigo);
    if (!salas.has(sala.clave)) salas.set(sala.clave, { ...sala, lugares: [] });
    salas.get(sala.clave).lugares.push(tarjeta(u, resumen));
  }
  const sinUbicacion = resumen.get(null)?.piezas ?? 0;
  return { salas: [...salas.values()], sinUbicacion };
}

export function obtenerUbicacion(db, codigo) {
  const u = db.prepare('SELECT codigo, nombre, descripcion FROM ubicaciones WHERE codigo = ?').get(codigo);
  return u ? tarjeta(u, resumenPorUbicacion(db)) : null;
}

export function ubicacionDePieza(db, id) {
  return db.prepare('SELECT id, ubicacion, icono, categoria FROM v_piezas WHERE id = ?').get(id) ?? null;
}
