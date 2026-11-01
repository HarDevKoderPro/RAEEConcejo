// Consultas de lectura sobre piezas. Siempre parametrizadas (CLAUDE.md §10.1).
import { fechaCorta, fechaHora, kg } from './formato.js';

// Columnas públicas: nunca 'notas' ni datos de usuarios (CLAUDE.md §10.1).
const COLUMNAS_PUBLICAS = `
  id, categoria, icono, requiere_borrado, marca, modelo_pn, serial, descripcion,
  estado, destino, ubicacion, ubicacion_nombre, equipo_destino,
  peso_kg, peso_origen, borrado_seguro, foto, fecha_ingreso, demo, actualizado_en`;

const ICONOS_MOVIMIENTO = {
  registro: '📥',
  estado: '🔧',
  destino: '🎯',
  ubicacion: '📍',
  edicion: '✏️',
  borrado_seguro: '🔒',
};

const TITULOS_MOVIMIENTO = {
  registro: 'Registro',
  estado: 'Cambio de estado',
  destino: 'Nuevo destino',
  ubicacion: 'Cambio de ubicación',
  edicion: 'Edición de datos',
  borrado_seguro: 'Borrado seguro',
};

// Clase CSS segura a partir de un nombre de catálogo ("Gestor RAEE (reciclaje)" → "gestor-raee-reciclaje").
export function slug(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Mensaje de impacto según el destino (CLAUDE.md §7).
export function mensajeImpacto(pieza) {
  switch (pieza.destino) {
    case 'Reutilizada en la sala':
      return { icono: '🌱', texto: `Volvió a la vida en el equipo ${pieza.equipo_destino}` };
    case 'Gestor RAEE (reciclaje)':
      return { icono: '♻', texto: 'Va a reciclaje certificado: no termina en la basura' };
    case 'Donación':
      return { icono: '🤝', texto: 'Se donará para que tenga una segunda vida fuera de la sala' };
    case 'Banco de repuestos':
      return { icono: '🧰', texto: 'Guardada como repuesto para reparar los equipos de la sala' };
    default:
      return { icono: '⏳', texto: 'Todavía está en revisión: aún no tiene destino final' };
  }
}

function prepararPieza(fila) {
  const pieza = {
    ...fila,
    demo: fila.demo === 1,
    requiere_borrado: fila.requiere_borrado === 1,
    fecha_ingreso_texto: fechaCorta(fila.fecha_ingreso),
    peso_texto: kg(fila.peso_kg),
    actualizado_texto: fechaHora(fila.actualizado_en),
    clase_estado: slug(fila.estado),
    clase_destino: slug(fila.destino),
  };
  pieza.impacto = mensajeImpacto(pieza);
  return pieza;
}

// Historial: el público no ve usuario ni nota; un editor con sesión sí.
function historial(db, id, privado) {
  return db
    .prepare(
      `SELECT m.id, m.fecha, m.tipo, m.valor_anterior, m.valor_nuevo${privado ? ', m.usuario, m.nota, COALESCE(u.nombre, m.usuario) AS usuario_nombre' : ''}
         FROM movimientos m ${privado ? 'LEFT JOIN usuarios u ON u.usuario = m.usuario' : ''}
        WHERE m.pieza_id = ? ORDER BY m.fecha DESC, m.id DESC`,
    )
    .all(id)
    .map((m) => ({
      ...m,
      icono: m.tipo === 'destino' && /^Reutilizada/.test(m.valor_nuevo ?? '') ? '🌱' : ICONOS_MOVIMIENTO[m.tipo] ?? '•',
      titulo: TITULOS_MOVIMIENTO[m.tipo] ?? m.tipo,
      fecha_texto: fechaHora(m.fecha),
    }));
}

// Resuelve un ID ya normalizado (RAEE-NNNN) a uno de los tres casos de §6.3.
// Con { privado: true } (editor con sesión) incluye 'notas' y el usuario de cada movimiento.
export function buscarPorId(db, id, { privado = false } = {}) {
  const columnas = privado ? `${COLUMNAS_PUBLICAS}, notas, categoria_id` : COLUMNAS_PUBLICAS;
  const fila = db.prepare(`SELECT ${columnas} FROM v_piezas WHERE id = ?`).get(id);
  const etiqueta = db.prepare('SELECT id, formato, lote FROM etiquetas WHERE id = ?').get(id) ?? null;

  if (fila) {
    return { resultado: 'registrada', pieza: prepararPieza(fila), historial: historial(db, id, privado), etiqueta };
  }
  if (etiqueta) return { resultado: 'sin_registrar', etiqueta };
  return { resultado: 'no_existe' };
}

export function hayDatosDemo(db) {
  return db.prepare('SELECT EXISTS (SELECT 1 FROM piezas WHERE demo = 1) AS hay').get().hay === 1;
}
