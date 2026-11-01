// Escrituras sobre piezas. Cada alta y cada cambio deja su rastro en 'movimientos' con el
// usuario (CLAUDE.md §6.4). Todo cambio pasa por aquí, y cada movimiento avisa al canal en
// vivo (§6.6) cuando la transacción ya quedó guardada.
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

// Un oyente por base (las pruebas abren varias bases en el mismo proceso).
const oyentes = new WeakMap();
export function alRegistrarMovimiento(db, fn) {
  if (typeof fn === 'function') oyentes.set(db, fn);
  else oyentes.delete(db);
}

function escribirMovimiento(db, mov) {
  db.prepare(
    `INSERT INTO movimientos (pieza_id, tipo, valor_anterior, valor_nuevo, usuario, nota)
     VALUES (@pieza_id, @tipo, @valor_anterior, @valor_nuevo, @usuario, @nota)`,
  ).run({ valor_anterior: null, nota: null, ...mov });
  const oyente = oyentes.get(db);
  if (!oyente) return;
  // Se avisa después de la transacción: si algo falla y se revierte, el aviso no sale.
  const pendientes = avisosPendientes.get(db) ?? [];
  pendientes.push(mov);
  avisosPendientes.set(db, pendientes);
  if (!db.inTransaction) despacharAvisos(db);
}

const avisosPendientes = new WeakMap();
function despacharAvisos(db) {
  const pendientes = avisosPendientes.get(db) ?? [];
  avisosPendientes.delete(db);
  const oyente = oyentes.get(db);
  for (const mov of pendientes) {
    try {
      oyente?.(mov);
    } catch (err) {
      console.error('[movimiento]', err);
    }
  }
}

// Ejecuta una transacción y, si se guardó, despacha los avisos en vivo; si falló, los descarta.
function enTransaccion(db, fn) {
  try {
    db.transaction(fn)();
  } catch (err) {
    avisosPendientes.delete(db);
    throw err;
  }
  despacharAvisos(db);
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
  enTransaccion(db, () => {
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
  return id;
}

// Edición completa: guarda los campos y escribe un movimiento por cada tipo de cambio.
export function editarPieza(db, id, nuevos, usuario) {
  const actual = db.prepare(`SELECT ${CAMPOS.join(', ')}, foto FROM piezas WHERE id = ?`).get(id);
  if (!actual) throw new Error('PIEZA_INEXISTENTE');
  enTransaccion(db, () => {
    const sets = Object.keys(nuevos).filter((k) => CAMPOS.includes(k) || k === 'foto');
    if (sets.length) {
      db.prepare(`UPDATE piezas SET ${sets.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ id, ...nuevos });
    }
    registrarCambios(db, id, actual, { ...actual, ...nuevos }, usuario);
  });
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

// Eliminar una pieza (solo admin). Antes de borrarla se guarda una copia con su historial en
// 'piezas_eliminadas', con el motivo y quién lo hizo. La etiqueta se conserva: se puede volver a
// registrar escaneándola. Devuelve la foto que hay que borrar del disco (o null).
export function eliminarPieza(db, id, motivo, usuario) {
  const texto = String(motivo ?? '').trim().slice(0, 300);
  if (texto.length < 3) throw new Error('Escribe el motivo (por ejemplo, "registrada por error").');
  const pieza = db.prepare('SELECT * FROM v_piezas WHERE id = ?').get(id);
  if (!pieza) throw new Error('PIEZA_INEXISTENTE');
  const historial = db.prepare('SELECT fecha, tipo, valor_anterior, valor_nuevo, usuario, nota FROM movimientos WHERE pieza_id = ? ORDER BY id').all(id);
  db.transaction(() => {
    db.prepare('INSERT INTO piezas_eliminadas (pieza_id, categoria, motivo, usuario, datos) VALUES (?, ?, ?, ?, ?)').run(
      id, pieza.categoria, texto, usuario, JSON.stringify({ pieza, historial }),
    );
    db.prepare('DELETE FROM piezas WHERE id = ?').run(id);
  })();
  return { foto: pieza.foto ?? null, categoria: pieza.categoria };
}
