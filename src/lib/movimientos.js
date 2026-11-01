// Escrituras sobre piezas. Cada alta y cada cambio deja su rastro en 'movimientos' con el
// usuario (CLAUDE.md §6.4). Todo cambio pasa por aquí: la fase 5 emitirá el evento en vivo
// desde escribirMovimiento().
import { siguienteId } from './ids.js';
import { extraerId } from './escaneo.js';

const CAMPOS = [
  'categoria_id', 'marca', 'modelo_pn', 'serial', 'descripcion', 'estado', 'destino', 'ubicacion',
  'equipo_destino', 'peso_real_kg', 'borrado_seguro', 'notas', 'fecha_ingreso',
];

const ROTULOS = {
  categoria_id: 'categoría', marca: 'marca', modelo_pn: 'modelo', serial: 'serial',
  descripcion: 'descripción', peso_real_kg: 'peso', notas: 'notas', fecha_ingreso: 'fecha de ingreso',
  equipo_destino: 'equipo',
};

let alEscribir = () => {};
// La fase 5 conecta aquí el canal en vivo.
export function alRegistrarMovimiento(fn) {
  alEscribir = typeof fn === 'function' ? fn : () => {};
}

function escribirMovimiento(db, mov) {
  db.prepare(
    `INSERT INTO movimientos (pieza_id, tipo, valor_anterior, valor_nuevo, usuario, nota)
     VALUES (@pieza_id, @tipo, @valor_anterior, @valor_nuevo, @usuario, @nota)`,
  ).run({ valor_anterior: null, nota: null, ...mov });
  try {
    alEscribir(mov);
  } catch (err) {
    console.error('[movimiento]', err);
  }
}

const textoDestino = (destino, equipo) => (destino === 'Reutilizada en la sala' && equipo ? `${destino} → ${equipo}` : destino);
const nombreUbicacion = (db, codigo) =>
  codigo ? db.prepare('SELECT nombre FROM ubicaciones WHERE codigo = ?').get(codigo)?.nombre ?? codigo : 'Sin ubicación';

// Decide el ID del alta: el escaneado (flujo a) o el siguiente libre (flujo b).
// Devuelve { id, etiqueta } o { error }.
export function resolverIdRegistro(db, textoId) {
  const t = String(textoId ?? '').trim();
  if (!t) return { id: siguienteId(db), automatico: true };
  const { id, error } = extraerId(t);
  if (error) return { error: error === 'QR_ANTIGUO' ? 'Es un QR antiguo con texto: reimprímelo con su ID.' : 'Ese código no es un ID del inventario (se espera algo como RAEE-0037).' };
  if (db.prepare('SELECT 1 FROM piezas WHERE id = ?').get(id)) return { error: `${id} ya está registrada.`, yaExiste: id };
  return { id, automatico: false };
}

// Alta de una pieza. Si el ID no tenía etiqueta, la reserva (formato URL) para imprimirla en la fase 6.
export function registrarPieza(db, id, datos, usuario, { automatico = false } = {}) {
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO etiquetas (id, formato, lote) VALUES (?, 'URL', ?)`,
    ).run(id, automatico ? 'Asignadas al registrar (por imprimir)' : 'Reservadas al registrar (por imprimir)');
    db.prepare(
      `INSERT INTO piezas (id, ${CAMPOS.join(', ')}, demo)
       VALUES (@id, ${CAMPOS.map((c) => '@' + c).join(', ')}, 0)`,
    ).run({ id, ...datos });
    escribirMovimiento(db, { pieza_id: id, tipo: 'registro', valor_nuevo: 'Ingreso al inventario', usuario });
    if (datos.borrado_seguro === 'Sí') {
      escribirMovimiento(db, { pieza_id: id, tipo: 'borrado_seguro', valor_anterior: 'No', valor_nuevo: 'Sí', usuario });
    }
  });
  tx();
  return id;
}

// Edición completa: guarda los campos y escribe un movimiento por cada tipo de cambio.
export function editarPieza(db, id, nuevos, usuario) {
  const actual = db.prepare(`SELECT ${CAMPOS.join(', ')}, foto FROM piezas WHERE id = ?`).get(id);
  if (!actual) throw new Error('PIEZA_INEXISTENTE');
  const tx = db.transaction(() => {
    const sets = Object.keys(nuevos).filter((k) => CAMPOS.includes(k) || k === 'foto');
    if (sets.length) {
      db.prepare(`UPDATE piezas SET ${sets.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ id, ...nuevos });
    }
    registrarCambios(db, id, actual, { ...actual, ...nuevos }, usuario);
  });
  tx();
}

function registrarCambios(db, id, antes, despues, usuario) {
  const cambio = (k) => (antes[k] ?? null) !== (despues[k] ?? null);
  if (cambio('estado')) {
    escribirMovimiento(db, { pieza_id: id, tipo: 'estado', valor_anterior: antes.estado, valor_nuevo: despues.estado, usuario });
  }
  if (cambio('destino') || (despues.destino === 'Reutilizada en la sala' && cambio('equipo_destino'))) {
    escribirMovimiento(db, {
      pieza_id: id, tipo: 'destino', usuario,
      valor_anterior: textoDestino(antes.destino, antes.equipo_destino),
      valor_nuevo: textoDestino(despues.destino, despues.equipo_destino),
    });
  }
  if (cambio('ubicacion')) {
    escribirMovimiento(db, {
      pieza_id: id, tipo: 'ubicacion', usuario,
      valor_anterior: nombreUbicacion(db, antes.ubicacion), valor_nuevo: nombreUbicacion(db, despues.ubicacion),
    });
  }
  if (cambio('borrado_seguro') && despues.borrado_seguro !== 'No aplica') {
    escribirMovimiento(db, { pieza_id: id, tipo: 'borrado_seguro', valor_anterior: antes.borrado_seguro, valor_nuevo: despues.borrado_seguro, usuario });
  }
  const otros = Object.keys(ROTULOS).filter((k) => k !== 'equipo_destino' && cambio(k));
  if (cambio('foto')) otros.push('foto');
  if (otros.length) {
    const lista = otros.map((k) => ROTULOS[k] ?? k);
    escribirMovimiento(db, { pieza_id: id, tipo: 'edicion', valor_nuevo: `Actualizó ${lista.join(', ')}`, usuario });
  }
}

// Cambio rápido desde /movimiento: un solo campo (estado, destino, ubicación o borrado seguro).
export function cambioRapido(db, id, campo, valor, { equipo_destino = null } = {}, usuario) {
  const nuevos = { [campo]: valor };
  if (campo === 'destino') nuevos.equipo_destino = valor === 'Reutilizada en la sala' ? equipo_destino : null;
  editarPieza(db, id, nuevos, usuario);
}
