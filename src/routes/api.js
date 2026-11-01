import { Router } from 'express';
import { extraerId, MENSAJES_ESCANEO } from '../lib/escaneo.js';
import { buscarPorId } from '../lib/piezas.js';
import { catalogos, leerFiltros, buscarPiezas } from '../lib/busqueda.js';
import { requiereEditor } from '../lib/auth.js';
import { catalogosFormulario, traducirErrorSqlite, MENSAJE_BORRADO_SEGURO } from '../lib/validacion.js';
import { cambioRapido } from '../lib/movimientos.js';
import { datosPanel } from '../lib/panel.js';

const MENSAJES_RESULTADO = {
  sin_registrar: 'Etiqueta sin registrar: el ID existe, pero la pieza aún no se ha registrado.',
  no_existe: 'No está en el inventario.',
};

// Respuesta común: { resultado, id, pieza?, historial?, mensaje? }. Nunca incluye 'notas'.
function responder(res, db, id, privado = false) {
  const { resultado, pieza, historial, etiqueta } = buscarPorId(db, id, { privado });
  if (resultado === 'registrada') {
    return res.json({ resultado, id, pieza, historial, etiqueta_formato: etiqueta?.formato ?? null });
  }
  res.status(404).json({ resultado, id, mensaje: MENSAJES_RESULTADO[resultado] });
}

function responderError(res, error) {
  res.status(error === 'QR_ANTIGUO' ? 422 : 400).json({
    resultado: 'error',
    error,
    mensaje: MENSAJES_ESCANEO[error],
  });
}

export function rutasApi({ db }) {
  const r = Router();

  r.get('/piezas/:id', (req, res) => {
    const { id, error } = extraerId(req.params.id);
    if (error) return responderError(res, error);
    responder(res, db, id, Boolean(req.session?.usuario));
  });

  // Texto crudo del escáner (puede ser un enlace completo o varias líneas): lo usa /consulta.
  r.get('/escaneo', (req, res) => {
    const texto = typeof req.query.texto === 'string' ? req.query.texto.slice(0, 2000) : '';
    const { id, error } = extraerId(texto);
    if (error) return responderError(res, error);
    responder(res, db, id, Boolean(req.session?.usuario));
  });

  // Misma búsqueda que /buscar, en JSON (sin notas ni datos de usuarios).
  r.get('/buscar', (req, res) => {
    const filtros = leerFiltros(req.query, catalogos(db));
    const { piezas, recortado } = buscarPiezas(db, filtros);
    res.json({ filtros, total: piezas.length, recortado, piezas });
  });

  // Cifras del panel (v_panel), gráficos y últimos movimientos, sin usuarios ni notas.
  r.get('/panel', (req, res) => {
    res.set('Cache-Control', 'no-store').json(datosPanel(db));
  });

  // Cambio rápido desde /movimiento: { campo, valor, equipo_destino? }. Exige sesión y token CSRF.
  r.post('/piezas/:id/movimiento', requiereEditor, (req, res) => {
    const { id, error } = extraerId(req.params.id);
    if (error) return responderError(res, error);
    const pieza = db
      .prepare('SELECT p.*, c.requiere_borrado FROM piezas p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?')
      .get(id);
    if (!pieza) return res.status(404).json({ resultado: 'no_existe', id, mensaje: MENSAJES_RESULTADO.no_existe });

    const cat = catalogosFormulario(db);
    const { campo } = req.body ?? {};
    const valor = typeof req.body?.valor === 'string' ? req.body.valor.trim() : '';
    const fallo = (mensaje, codigo = 'INVALIDO') => res.status(422).json({ resultado: 'error', codigo, mensaje });

    const validos = {
      estado: cat.estados,
      destino: cat.destinos.map((d) => d.nombre),
      ubicacion: cat.ubicaciones.map((u) => u.codigo),
      borrado_seguro: pieza.requiere_borrado ? ['Sí', 'No'] : [],
    };
    if (!validos[campo]) return fallo('Ese cambio no está permitido.');
    if (!validos[campo].includes(valor)) {
      return fallo(campo === 'borrado_seguro' ? 'El borrado seguro solo aplica a discos.' : 'Ese valor no existe en el catálogo.');
    }

    let equipo = null;
    if (campo === 'destino' && valor === 'Reutilizada en la sala') {
      equipo = String(req.body.equipo_destino ?? '').trim().toUpperCase().slice(0, 30);
      if (!equipo) return fallo('Escribe el equipo donde se instaló (por ejemplo, PC-15).', 'FALTA_EQUIPO');
    }
    // Regla de borrado seguro, antes de llegar a la base (que igual la impone).
    const destinoFinal = campo === 'destino' ? valor : pieza.destino;
    const borradoFinal = campo === 'borrado_seguro' ? valor : pieza.borrado_seguro;
    const entrega = cat.destinos.find((d) => d.nombre === destinoFinal)?.entrega_a_terceros;
    if (pieza.requiere_borrado && entrega && borradoFinal !== 'Sí') return fallo(MENSAJE_BORRADO_SEGURO, 'BORRADO_SEGURO');

    try {
      cambioRapido(db, id, campo, valor, { equipo_destino: equipo }, req.session.usuario.usuario);
    } catch (err) {
      const traducido = traducirErrorSqlite(err, db);
      if (!traducido) throw err;
      return fallo(traducido.mensaje, traducido.campo === 'destino' ? 'BORRADO_SEGURO' : 'INVALIDO');
    }
    responder(res, db, id, true);
  });

  r.use((req, res) => res.status(404).json({ resultado: 'error', mensaje: 'Ruta de la API inexistente.' }));

  return r;
}
