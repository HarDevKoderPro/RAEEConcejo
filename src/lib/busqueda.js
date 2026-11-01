// Búsqueda por componente y por ubicación (CLAUDE.md §7, /buscar). Consultas parametrizadas.
import { extraerId } from './escaneo.js';
import { slug } from './piezas.js';

const LIMITE = 500;

// Catálogos para los filtros (y para validar lo que llega en la URL).
export function catalogos(db) {
  return {
    categorias: db.prepare('SELECT id, nombre, icono FROM categorias ORDER BY orden, nombre').all(),
    estados: db.prepare('SELECT nombre FROM estados ORDER BY orden').all().map((e) => e.nombre),
    destinos: db.prepare('SELECT nombre FROM destinos ORDER BY orden').all().map((d) => d.nombre),
    ubicaciones: db.prepare('SELECT codigo, nombre FROM ubicaciones ORDER BY codigo').all(),
  };
}

// Lee y valida los filtros de la URL. Lo que no esté en los catálogos se ignora.
export function leerFiltros(query, cat) {
  const texto = (v) => (typeof v === 'string' ? v.trim().slice(0, 100) : '');
  const categoria = Number(texto(query.categoria)) || null;
  const estado = texto(query.estado);
  const destino = texto(query.destino);
  const ubicacion = texto(query.ubicacion);
  return {
    q: texto(query.q),
    categoria: cat.categorias.some((c) => c.id === categoria) ? categoria : null,
    estado: cat.estados.includes(estado) ? estado : '',
    destino: cat.destinos.includes(destino) ? destino : '',
    ubicacion: cat.ubicaciones.some((u) => u.codigo === ubicacion) ? ubicacion : '',
  };
}

export function hayFiltros(f) {
  return Boolean(f.q || f.categoria || f.estado || f.destino || f.ubicacion);
}

const escaparLike = (t) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

// Cada palabra del texto debe aparecer en algún campo (ID, marca, modelo, serial,
// descripción, categoría o ubicación). Un ID escrito como "raee 10" se reconoce también.
// Condición WHERE parametrizada de una búsqueda (la usan /buscar y la exportación a Excel).
export function filtroSql(f) {
  const condiciones = [];
  const params = [];

  if (f.q) {
    const { id } = extraerId(f.q);
    const palabras = f.q.split(/\s+/).filter(Boolean).slice(0, 8);
    const porPalabra = palabras.map(() =>
      `(id LIKE ? ESCAPE '\\' OR marca LIKE ? ESCAPE '\\' OR modelo_pn LIKE ? ESCAPE '\\'
        OR serial LIKE ? ESCAPE '\\' OR descripcion LIKE ? ESCAPE '\\' OR categoria LIKE ? ESCAPE '\\'
        OR ubicacion_nombre LIKE ? ESCAPE '\\' OR equipo_destino LIKE ? ESCAPE '\\')`,
    );
    for (const p of palabras) params.push(...Array(8).fill(`%${escaparLike(p)}%`));
    let cond = `(${porPalabra.join(' AND ')})`;
    if (id) {
      cond = `(id = ? OR ${cond})`;
      params.splice(params.length - palabras.length * 8, 0, id);
    }
    condiciones.push(cond);
  }
  if (f.categoria) { condiciones.push('categoria_id = ?'); params.push(f.categoria); }
  if (f.estado) { condiciones.push('estado = ?'); params.push(f.estado); }
  if (f.destino) { condiciones.push('destino = ?'); params.push(f.destino); }
  if (f.ubicacion) { condiciones.push('ubicacion = ?'); params.push(f.ubicacion); }

  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

export function buscarPiezas(db, f) {
  const { where, params } = filtroSql(f);
  const filas = db
    .prepare(
      `SELECT id, categoria, icono, marca, modelo_pn, descripcion, estado, destino,
              ubicacion, ubicacion_nombre, equipo_destino, demo
         FROM v_piezas ${where} ORDER BY id LIMIT ${LIMITE + 1}`,
    )
    .all(...params);

  return {
    piezas: filas.slice(0, LIMITE).map((p) => ({
      ...p,
      demo: p.demo === 1,
      clase_estado: slug(p.estado),
      clase_destino: slug(p.destino),
    })),
    recortado: filas.length > LIMITE,
  };
}

// Convierte los filtros a una URL de /buscar (para enlaces que se pueden compartir).
export function urlBusqueda(f, cambios = {}) {
  const todo = { ...f, ...cambios };
  const sp = new URLSearchParams();
  for (const k of ['q', 'categoria', 'estado', 'destino', 'ubicacion']) {
    if (todo[k]) sp.set(k, String(todo[k]));
  }
  const s = sp.toString();
  return s ? `/buscar?${s}` : '/buscar';
}
