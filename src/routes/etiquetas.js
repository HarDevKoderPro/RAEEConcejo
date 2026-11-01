// Etiquetas QR (CLAUDE.md §8). Solo editores.
import { Router } from 'express';
import { requiereEditor } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';
import { siguienteId } from '../lib/ids.js';
import {
  MAX_ETIQUETAS, resumenLotes, contarPendientes, idsSolicitados, reservarIds, marcarImpresas,
  etiquetasParaHoja, enHojas,
} from '../lib/etiquetas.js';

const POR_HOJA = { normal: 24, pequena: 225 }; // A4: 3 × 8 normales · 9 × 25 pequeñas (2 × 1 cm)

export function rutasEtiquetas({ db, ajustes }) {
  const r = Router();

  function verFormulario(res, { error = null, valores = {}, estado = 200 } = {}) {
    res.status(estado).render('etiquetas', {
      titulo: 'Etiquetas QR',
      lotes: resumenLotes(db),
      pendientes: contarPendientes(db),
      proximoId: siguienteId(db),
      maximo: MAX_ETIQUETAS,
      baseUrl: ajustes.baseUrl,
      error,
      valores,
    });
  }

  r.get('/etiquetas', requiereEditor, (req, res) => verFormulario(res));

  r.post('/etiquetas/reservar', requiereEditor, (req, res) => {
    try {
      const { ids, lote } = reservarIds(db, req.body.cantidad, req.body.lote);
      avisar(req, 'ok', `Se reservaron ${ids.length} IDs nuevos (${ids[0]} a ${ids.at(-1)}) en el lote «${lote}».`);
      res.redirect(303, `/etiquetas/hoja?lote=${encodeURIComponent(lote)}&tam=${req.body.tam === 'pequena' ? 'pequena' : 'normal'}`);
    } catch (err) {
      if (!err.message || /SQLITE/.test(err.code ?? '')) throw err;
      verFormulario(res, { error: err.message, valores: req.body, estado: 422 });
    }
  });

  r.get('/etiquetas/hoja', requiereEditor, async (req, res, next) => {
    try {
      const pedido = idsSolicitados(db, req.query);
      if (pedido.error) return verFormulario(res, { error: pedido.error, valores: req.query, estado: 422 });
      const tam = req.query.tam === 'pequena' ? 'pequena' : 'normal';
      const etiquetas = await etiquetasParaHoja(db, pedido.ids, ajustes.baseUrl);
      res.render('hoja-etiquetas', {
        titulo: `Imprimir · ${pedido.titulo}`,
        tituloHoja: pedido.titulo,
        tam,
        hojas: enHojas(etiquetas, POR_HOJA[tam]),
        total: etiquetas.length,
        ids: pedido.ids,
        baseUrl: ajustes.baseUrl,
        local: /localhost|127\.0\.0\.1/.test(ajustes.baseUrl),
        query: req.query,
      });
    } catch (err) {
      next(err);
    }
  });

  r.post('/etiquetas/impresas', requiereEditor, (req, res) => {
    const ids = String(req.body.ids ?? '').split(',');
    const n = marcarImpresas(db, ids);
    avisar(req, 'ok', `${n} etiqueta${n === 1 ? '' : 's'} marcada${n === 1 ? '' : 's'} como impresa${n === 1 ? '' : 's'} con enlace.`);
    res.redirect(303, '/etiquetas');
  });

  return r;
}
