// Panel de impacto (§6.5) y escenario del proyector /demo (§7).
import { Router } from 'express';
import { requiereEditor } from '../lib/auth.js';
import { datosPanel } from '../lib/panel.js';
import { catalogosFormulario } from '../lib/validacion.js';
import { extraerId } from '../lib/escaneo.js';

export function rutasPanel({ db }) {
  const r = Router();

  r.get('/panel', (req, res) => {
    const modoTv = req.query.tv === '1';
    res.render('panel', { titulo: 'Panel de impacto', modoTv, ...datosPanel(db) });
  });

  r.get('/demo', requiereEditor, (req, res) => {
    const { id } = extraerId(typeof req.query.id === 'string' ? req.query.id : '');
    res.render('demo', {
      titulo: 'Demo en vivo',
      modoDemo: true,
      cat: catalogosFormulario(db),
      idInicial: id ?? '',
      ...datosPanel(db),
    });
  });

  return r;
}
