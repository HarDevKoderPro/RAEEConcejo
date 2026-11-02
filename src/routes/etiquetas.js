// Etiquetas QR (CLAUDE.md §8). Generar e imprimir: editores. Eliminar: solo administrador.
import { Router } from 'express';
import { requiereEditor, requiereAdmin } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';
import { siguienteId } from '../lib/ids.js';
import {
  MAX_ETIQUETAS, resumenLotes, contarPendientes, idsSolicitados, reservarIds, marcarImpresas,
  etiquetasParaHoja, enHojas, resumenEliminar, eliminarEtiquetas,
} from '../lib/etiquetas.js';

// Normales: 3 × 8 en A4 y en carta. Pequeñas (2 × 1 cm): 9 × 25 en A4, 9 × 23 en carta.
const POR_HOJA = { a4: { normal: 24, pequena: 225 }, carta: { normal: 24, pequena: 207 } };
const PAPELES = { a4: 'A4', carta: 'carta' };
const FRASE_BORRAR_TODAS = 'BORRAR ETIQUETAS';
const leerPapel = (v) => (v === 'a4' ? 'a4' : 'carta'); // carta por defecto (Colombia)
const leerTam = (v) => (v === 'pequena' ? 'pequena' : 'normal');

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
      totalBorrar: resumenEliminar(db),
      esAdmin: res.locals.usuario?.rol === 'admin',
      fraseBorrar: FRASE_BORRAR_TODAS,
      error,
      valores,
    });
  }

  r.get('/etiquetas', requiereEditor, (req, res) => verFormulario(res));

  r.post('/etiquetas/reservar', requiereEditor, (req, res) => {
    try {
      const { ids, lote } = reservarIds(db, req.body.cantidad, req.body.lote);
      avisar(req, 'ok', `Se reservaron ${ids.length} IDs nuevos (${ids[0]} a ${ids.at(-1)}) en el lote «${lote}».`);
      const q = new URLSearchParams({ lote, tam: leerTam(req.body.tam), papel: leerPapel(req.body.papel) });
      res.redirect(303, `/etiquetas/hoja?${q}`);
    } catch (err) {
      if (!err.message || /SQLITE/.test(err.code ?? '')) throw err;
      verFormulario(res, { error: err.message, valores: req.body, estado: 422 });
    }
  });

  r.get('/etiquetas/hoja', requiereEditor, async (req, res, next) => {
    try {
      const pedido = idsSolicitados(db, req.query);
      if (pedido.error) return verFormulario(res, { error: pedido.error, valores: req.query, estado: 422 });
      const tam = leerTam(req.query.tam);
      const papel = leerPapel(req.query.papel);
      const etiquetas = await etiquetasParaHoja(db, pedido.ids, ajustes.baseUrl);
      res.render('hoja-etiquetas', {
        titulo: `Imprimir · ${pedido.titulo}`,
        tituloHoja: pedido.titulo,
        tam,
        papel,
        nombrePapel: PAPELES[papel],
        hojas: enHojas(etiquetas, POR_HOJA[papel][tam]),
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

  // Eliminar un lote: primero se confirma viendo qué se borra.
  r.get('/etiquetas/eliminar', requiereAdmin, (req, res) => {
    const lote = String(req.query.lote ?? '');
    const resumen = resumenEliminar(db, lote);
    if (!resumen.total) {
      avisar(req, 'error', 'Ese lote ya no existe.');
      return res.redirect(303, '/etiquetas');
    }
    res.render('eliminar-etiquetas', { titulo: `Eliminar lote · ${lote}`, lote, resumen });
  });

  r.post('/etiquetas/eliminar', requiereAdmin, (req, res) => {
    const lote = String(req.body.lote ?? '');
    const { conPieza } = resumenEliminar(db, lote);
    const n = eliminarEtiquetas(db, lote);
    avisar(req, 'ok', mensajeBorradas(n, conPieza, `del lote «${lote}»`));
    res.redirect(303, '/etiquetas');
  });

  // Borrar todas (para empezar de cero, sobre todo en pruebas). Pide escribir una frase.
  r.post('/etiquetas/eliminar-todas', requiereAdmin, (req, res) => {
    if (String(req.body.confirmar ?? '').trim().toUpperCase() !== FRASE_BORRAR_TODAS) {
      return verFormulario(res, { error: `Para borrar todas las etiquetas escribe ${FRASE_BORRAR_TODAS}.`, estado: 422 });
    }
    const { conPieza } = resumenEliminar(db);
    const n = eliminarEtiquetas(db);
    avisar(req, 'ok', mensajeBorradas(n, conPieza, ''));
    res.redirect(303, '/etiquetas');
  });

  return r;
}

function mensajeBorradas(n, conPieza, deDonde) {
  const s = (k) => (k === 1 ? '' : 's');
  let texto = `Se eliminaron ${n} etiqueta${s(n)}${deDonde ? ` ${deDonde}` : ''}.`;
  if (conPieza) texto += ` Se conservaron ${conPieza} porque ya tienen una pieza registrada.`;
  return texto;
}
