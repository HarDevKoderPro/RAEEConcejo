// Reglas de negocio del formulario de piezas (CLAUDE.md §6.4) y traducción de los errores
// de SQLite a mensajes amables (§5). La base sigue siendo la última barrera.

export const MENSAJE_BORRADO_SEGURO =
  'Este disco puede contener información de la institución. Haz el borrado seguro y márcalo antes de darle este destino.';

const REUTILIZADA = 'Reutilizada en la sala';

const texto = (v, max) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  return t ? t.slice(0, max) : null;
};

export function hoyLocal() {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

// Catálogos con los datos que necesitan las reglas.
export function catalogosFormulario(db) {
  return {
    categorias: db
      .prepare('SELECT id, nombre, icono, peso_estimado_kg, guia_descripcion, requiere_borrado FROM categorias ORDER BY orden, nombre')
      .all(),
    estados: db.prepare('SELECT nombre FROM estados ORDER BY orden').all().map((e) => e.nombre),
    destinos: db.prepare('SELECT nombre, entrega_a_terceros FROM destinos ORDER BY orden').all(),
    ubicaciones: db.prepare('SELECT codigo, nombre FROM ubicaciones ORDER BY codigo').all(),
  };
}

// Devuelve { datos, errores }. 'errores' es un objeto campo → mensaje (vacío si todo está bien).
export function leerFormularioPieza(body, cat) {
  const errores = {};
  const categoriaId = Number(body.categoria_id) || null;
  const categoria = cat.categorias.find((c) => c.id === categoriaId);
  const estado = texto(body.estado, 40);
  const destino = cat.destinos.find((d) => d.nombre === texto(body.destino, 60));
  const ubicacion = texto(body.ubicacion, 20);

  if (!categoria) errores.categoria_id = 'Elige la categoría de la pieza.';
  if (!cat.estados.includes(estado)) errores.estado = 'Elige el estado.';
  if (!destino) errores.destino = 'Elige el destino.';
  if (!cat.ubicaciones.some((u) => u.codigo === ubicacion)) errores.ubicacion = 'Elige dónde queda guardada.';

  let equipo = texto(body.equipo_destino, 30);
  if (destino?.nombre === REUTILIZADA) {
    if (!equipo) errores.equipo_destino = 'Escribe el equipo donde se instaló (por ejemplo, PC-15).';
    else equipo = equipo.toUpperCase();
  } else {
    equipo = null;
  }

  let borrado = 'No aplica';
  if (categoria?.requiere_borrado) {
    borrado = ['Sí', 'No'].includes(body.borrado_seguro) ? body.borrado_seguro : null;
    if (!borrado) errores.borrado_seguro = 'Indica si ya se hizo el borrado seguro del disco.';
    else if (borrado !== 'Sí' && destino?.entrega_a_terceros) errores.destino = MENSAJE_BORRADO_SEGURO;
  }

  let peso = null;
  const pesoTexto = texto(body.peso_real_kg, 10);
  if (pesoTexto) {
    peso = Number(pesoTexto.replace(',', '.'));
    if (!Number.isFinite(peso) || peso < 0 || peso > 100) {
      errores.peso_real_kg = 'Escribe el peso en kilos (por ejemplo, 0,45) o déjalo vacío.';
      peso = null;
    }
  }

  let fecha = texto(body.fecha_ingreso, 10) ?? hoyLocal();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.fecha_ingreso = 'Escribe una fecha válida.';
  } else if (fecha > hoyLocal()) {
    errores.fecha_ingreso = 'La fecha de ingreso no puede ser futura.';
  }

  return {
    errores,
    datos: {
      categoria_id: categoria?.id ?? null,
      marca: texto(body.marca, 60),
      modelo_pn: texto(body.modelo_pn, 80),
      serial: texto(body.serial, 80),
      descripcion: texto(body.descripcion, 300),
      estado,
      destino: destino?.nombre ?? null,
      ubicacion,
      equipo_destino: equipo,
      peso_real_kg: peso,
      borrado_seguro: borrado,
      notas: typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim().slice(0, 1000) : null,
      fecha_ingreso: fecha,
    },
  };
}

// Traduce un error de SQLite a { campo, mensaje }. Si no lo reconoce, devuelve null.
export function traducirErrorSqlite(err, db, datos = {}) {
  const msg = String(err?.message ?? '');
  if (msg.includes('BORRADO_SEGURO')) return { campo: 'destino', mensaje: MENSAJE_BORRADO_SEGURO };
  if (/UNIQUE constraint failed: piezas\.serial/.test(msg)) {
    const otra = datos.serial ? db.prepare('SELECT id FROM piezas WHERE serial = ?').get(datos.serial) : null;
    return {
      campo: 'serial',
      mensaje: otra
        ? `Ese serial ya está registrado en ${otra.id}. Puede ser la misma pieza registrada dos veces.`
        : 'Ese serial ya está registrado en otra pieza.',
    };
  }
  if (/UNIQUE constraint failed: piezas\.id|PRIMARY KEY/.test(msg)) {
    return { campo: 'id', mensaje: 'Ese ID ya está registrado.' };
  }
  if (/CHECK constraint failed/.test(msg) && /equipo_destino|Reutilizada/.test(msg + JSON.stringify(datos))) {
    return { campo: 'equipo_destino', mensaje: 'Escribe el equipo donde se instaló (por ejemplo, PC-15).' };
  }
  return null;
}
