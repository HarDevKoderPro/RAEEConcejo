// Indicadores del panel de impacto (CLAUDE.md §6.5). Las cifras salen de v_panel, sin recalcular.
import { fechaHora, kg } from './formato.js';
import { slug } from './piezas.js';

const ICONOS = { registro: '📥', estado: '🔧', destino: '🎯', ubicacion: '📍', edicion: '✏️', borrado_seguro: '🔒' };
const TITULOS = {
  registro: 'Ingresó al inventario', estado: 'Cambio de estado', destino: 'Nuevo destino',
  ubicacion: 'Cambio de ubicación', edicion: 'Datos actualizados', borrado_seguro: 'Borrado seguro',
};

export function cifrasPanel(db) {
  const v = db.prepare('SELECT * FROM v_panel').get();
  const meta = v.meta_semestre || 0;
  return {
    ...v,
    pct_no_va_a_basura: v.pct_no_va_a_basura ?? 0,
    pct_meta: meta ? Math.min(100, Math.round((100 * v.piezas_registradas) / meta)) : 0,
  };
}

// Texto público de un movimiento (lo usan el panel y los avisos en vivo). Sin usuario ni notas.
export function textoMovimiento(m) {
  if (m.tipo === 'borrado_seguro') return m.valor_nuevo === 'Sí' ? 'Borrado seguro realizado' : 'Borrado seguro pendiente';
  if (m.tipo === 'registro') return 'Ingresó al inventario';
  if (m.tipo === 'edicion') return 'Datos actualizados';
  return m.valor_nuevo ?? '';
}

export function ultimosMovimientos(db, limite = 8) {
  return db
    .prepare(
      `SELECT m.id, m.pieza_id, m.fecha, m.tipo, m.valor_nuevo, c.icono AS icono_categoria, c.nombre AS categoria
         FROM movimientos m
         JOIN piezas p ON p.id = m.pieza_id
         JOIN categorias c ON c.id = p.categoria_id
        ORDER BY m.fecha DESC, m.id DESC LIMIT ?`,
    )
    .all(limite)
    .map((m) => ({
      ...m,
      icono: m.tipo === 'destino' && /^Reutilizada/.test(m.valor_nuevo ?? '') ? '🌱' : ICONOS[m.tipo] ?? '•',
      titulo: TITULOS[m.tipo] ?? m.tipo,
      texto: textoMovimiento(m),
      fecha_texto: fechaHora(m.fecha),
    }));
}

export function graficosPanel(db) {
  const porCategoria = db
    .prepare(
      `SELECT c.nombre, c.icono, COUNT(p.id) AS n
         FROM categorias c LEFT JOIN piezas p ON p.categoria_id = c.id
        GROUP BY c.id HAVING n > 0 ORDER BY n DESC, c.orden`,
    )
    .all();
  const porDestino = db
    .prepare(
      `SELECT d.nombre, d.color, COUNT(p.id) AS n
         FROM destinos d LEFT JOIN piezas p ON p.destino = d.nombre
        GROUP BY d.nombre ORDER BY d.orden`,
    )
    .all()
    .map((d) => ({ ...d, clase: slug(d.nombre) }));
  const porEstado = db
    .prepare(
      `SELECT e.nombre, e.color, COUNT(p.id) AS n
         FROM estados e LEFT JOIN piezas p ON p.estado = e.nombre
        GROUP BY e.nombre ORDER BY e.orden`,
    )
    .all();
  return { porCategoria, porDestino, porEstado };
}

export function datosPanel(db) {
  const cifras = cifrasPanel(db);
  return {
    cifras,
    textos: {
      kg_inventariados: kg(cifras.kg_inventariados),
      kg_con_destino_final: kg(cifras.kg_con_destino_final),
    },
    graficos: graficosPanel(db),
    movimientos: ultimosMovimientos(db),
  };
}
