import { Router } from 'express';
import { extraerId, MENSAJES_ESCANEO } from '../lib/escaneo.js';
import { buscarPorId } from '../lib/piezas.js';
import { catalogos, leerFiltros, buscarPiezas } from '../lib/busqueda.js';

const MENSAJES_RESULTADO = {
  sin_registrar: 'Etiqueta sin registrar: el ID existe, pero la pieza aún no se ha registrado.',
  no_existe: 'No está en el inventario.',
};

// Respuesta común: { resultado, id, pieza?, historial?, mensaje? }. Nunca incluye 'notas'.
function responder(res, db, id) {
  const { resultado, pieza, historial, etiqueta } = buscarPorId(db, id);
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
    responder(res, db, id);
  });

  // Texto crudo del escáner (puede ser un enlace completo o varias líneas): lo usa /consulta.
  r.get('/escaneo', (req, res) => {
    const texto = typeof req.query.texto === 'string' ? req.query.texto.slice(0, 2000) : '';
    const { id, error } = extraerId(texto);
    if (error) return responderError(res, error);
    responder(res, db, id);
  });

  // Misma búsqueda que /buscar, en JSON (sin notas ni datos de usuarios).
  r.get('/buscar', (req, res) => {
    const filtros = leerFiltros(req.query, catalogos(db));
    const { piezas, recortado } = buscarPiezas(db, filtros);
    res.json({ filtros, total: piezas.length, recortado, piezas });
  });

  r.use((req, res) => res.status(404).json({ resultado: 'error', mensaje: 'Ruta de la API inexistente.' }));

  return r;
}
