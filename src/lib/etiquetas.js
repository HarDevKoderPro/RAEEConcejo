// Etiquetas QR (CLAUDE.md §8): rangos, reserva de IDs nuevos y reimpresión de lotes.
import { siguienteId } from './ids.js';
import { formatearId } from './escaneo.js';
import { hoyLocal } from './validacion.js';
import { svgQr, urlFicha } from './qr.js';

export const MAX_ETIQUETAS = 240; // 10 hojas de 24
export const POR_IMPRIMIR = '(por imprimir)';

const numero = (id) => Number(String(id).slice(5));

export function resumenLotes(db) {
  return db
    .prepare(
      `SELECT lote, formato, COUNT(*) AS n, MIN(id) AS desde, MAX(id) AS hasta, MAX(impresa_en) AS fecha
         FROM etiquetas GROUP BY lote, formato ORDER BY MIN(id)`,
    )
    .all()
    .map((l) => ({ ...l, pendiente: l.lote.includes(POR_IMPRIMIR) }));
}

export const contarPendientes = (db) =>
  db.prepare('SELECT COUNT(*) AS n FROM etiquetas WHERE lote LIKE ?').get(`%${POR_IMPRIMIR}%`).n;

// Lee qué etiquetas pide la URL: ?ids=…, ?desde=&hasta=, ?lote=… o ?pendientes=1.
// Devuelve { ids, titulo } o { error }.
export function idsSolicitados(db, q) {
  if (typeof q.ids === 'string' && q.ids.trim()) {
    const ids = [...new Set(q.ids.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
    const validos = ids.filter((t) => /^RAEE-\d{4}$/.test(t));
    if (!validos.length) return { error: 'No hay IDs válidos (se espera RAEE-0001, RAEE-0002…).' };
    return { ids: validos.slice(0, MAX_ETIQUETAS), titulo: validos.length === 1 ? `Etiqueta ${validos[0]}` : `${validos.length} etiquetas` };
  }
  if (q.desde !== undefined || q.hasta !== undefined) {
    const desde = Number(q.desde);
    const hasta = Number(q.hasta);
    if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta > 9999 || desde > hasta) {
      return { error: 'Revisa el rango: números enteros de 1 a 9999, y "desde" menor o igual que "hasta".' };
    }
    if (hasta - desde + 1 > MAX_ETIQUETAS) return { error: `Máximo ${MAX_ETIQUETAS} etiquetas (10 hojas) por vez.` };
    const ids = [];
    for (let n = desde; n <= hasta; n++) ids.push(formatearId(n));
    return { ids, titulo: `${formatearId(desde)} a ${formatearId(hasta)}` };
  }
  if (typeof q.lote === 'string' && q.lote) {
    const ids = db.prepare('SELECT id FROM etiquetas WHERE lote = ? ORDER BY id LIMIT ?').all(q.lote, MAX_ETIQUETAS).map((f) => f.id);
    if (!ids.length) return { error: 'Ese lote no existe.' };
    return { ids, titulo: q.lote };
  }
  if (q.pendientes === '1') {
    const ids = db.prepare('SELECT id FROM etiquetas WHERE lote LIKE ? ORDER BY id LIMIT ?').all(`%${POR_IMPRIMIR}%`, MAX_ETIQUETAS).map((f) => f.id);
    if (!ids.length) return { error: 'No hay etiquetas pendientes por imprimir.' };
    return { ids, titulo: 'Pendientes por imprimir' };
  }
  return { error: 'Elige qué etiquetas imprimir.' };
}

// Reserva N IDs nuevos (mayores que cualquiera en piezas o etiquetas) con formato URL.
export function reservarIds(db, cantidad, lote) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 1 || n > MAX_ETIQUETAS) throw new Error(`La cantidad debe estar entre 1 y ${MAX_ETIQUETAS}.`);
  const nombre = String(lote ?? '').trim().slice(0, 60) || `Lote del ${hoyLocal()}`;
  if (db.prepare('SELECT 1 FROM etiquetas WHERE lote = ?').get(nombre)) throw new Error('Ya existe un lote con ese nombre. Usa otro.');
  const ids = [];
  db.transaction(() => {
    let siguiente = numero(siguienteId(db));
    if (siguiente + n - 1 > 9999) throw new Error('No quedan suficientes IDs libres.');
    const insertar = db.prepare(`INSERT INTO etiquetas (id, formato, lote) VALUES (?, 'URL', ?)`);
    for (let i = 0; i < n; i++, siguiente++) {
      const id = formatearId(siguiente);
      insertar.run(id, nombre);
      ids.push(id);
    }
  })();
  return { ids, lote: nombre };
}

// Después de imprimir y pegar: las etiquetas quedan con formato URL y fecha de hoy.
export function marcarImpresas(db, ids) {
  const hoy = hoyLocal();
  const validos = ids.filter((t) => /^RAEE-\d{4}$/.test(t)).slice(0, MAX_ETIQUETAS);
  db.transaction(() => {
    const actual = db.prepare('SELECT lote FROM etiquetas WHERE id = ?');
    const insertar = db.prepare(`INSERT INTO etiquetas (id, formato, lote, impresa_en) VALUES (?, 'URL', ?, ?)`);
    const actualizar = db.prepare(`UPDATE etiquetas SET formato = 'URL', impresa_en = ?, lote = ? WHERE id = ?`);
    for (const id of validos) {
      const fila = actual.get(id);
      if (!fila) insertar.run(id, `Impresas el ${hoy}`, hoy);
      else {
        const lote = fila.lote.includes(POR_IMPRIMIR) || /^Lote 1 /.test(fila.lote) ? `Impresas el ${hoy}` : fila.lote;
        actualizar.run(hoy, lote, id);
      }
    }
  })();
  return validos.length;
}

// Datos de cada etiqueta para la hoja: QR, ID e ícono de la categoría si la pieza existe.
export async function etiquetasParaHoja(db, ids, baseUrl) {
  const pieza = db.prepare('SELECT p.id, c.icono, c.nombre AS categoria FROM piezas p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?');
  return Promise.all(
    ids.map(async (id) => {
      const url = urlFicha(baseUrl, id);
      const p = pieza.get(id);
      return { id, url, qr: await svgQr(url), icono: p?.icono ?? null, categoria: p?.categoria ?? null };
    }),
  );
}

export function enHojas(lista, porHoja) {
  const hojas = [];
  for (let i = 0; i < lista.length; i += porHoja) hojas.push(lista.slice(i, i + porHoja));
  return hojas;
}
