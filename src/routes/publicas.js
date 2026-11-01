import { Router } from 'express';
import { extraerId } from '../lib/escaneo.js';
import { buscarPorId } from '../lib/piezas.js';

export function rutasPublicas({ db }) {
  const r = Router();

  r.get('/', (req, res) => {
    const ejemplos = db
      .prepare(
        `SELECT id, icono, categoria, ubicacion_nombre FROM v_piezas
          WHERE id IN ('RAEE-0001','RAEE-0010','RAEE-0005','RAEE-0014') ORDER BY id`,
      )
      .all();
    res.render('portada', { titulo: 'Inicio', ejemplos });
  });

  r.get('/consulta', (req, res) => {
    res.render('consulta', { titulo: 'Consulta por escaneo', modoKiosco: true });
  });

  // Formulario "Ver ficha" (portada y páginas de error): funciona también sin JavaScript.
  r.get('/ir', (req, res) => {
    const texto = typeof req.query.id === 'string' ? req.query.id : '';
    const { id } = extraerId(texto);
    res.redirect(303, `/p/${encodeURIComponent(id ?? (texto.trim() || 'vacio'))}`);
  });

  // Ficha de la pieza. Acepta variantes ("raee-10") y redirige a la forma canónica.
  r.get('/p/:id', (req, res) => {
    const { id, error } = extraerId(req.params.id);
    if (error) {
      return res.status(404).render('ficha-no-encontrada', {
        titulo: 'No está en el inventario',
        idBuscado: req.params.id,
        resultado: 'no_existe',
      });
    }
    if (id !== req.params.id) return res.redirect(301, `/p/${id}`);

    const datos = buscarPorId(db, id);
    if (datos.resultado === 'registrada') {
      return res.render('ficha', { titulo: `${datos.pieza.id} · ${datos.pieza.categoria}`, ...datos });
    }
    const sinRegistrar = datos.resultado === 'sin_registrar';
    res.status(sinRegistrar ? 200 : 404).render('ficha-no-encontrada', {
      titulo: sinRegistrar ? 'Etiqueta sin registrar' : 'No está en el inventario',
      idBuscado: id,
      ...datos,
    });
  });

  return r;
}
