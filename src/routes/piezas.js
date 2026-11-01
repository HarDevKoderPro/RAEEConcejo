// Rutas de edición (solo editores con sesión): /registrar, /p/:id/editar, /movimiento.
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requiereEditor } from '../lib/auth.js';
import { avisar, csrf } from '../lib/sesiones.js';
import { extraerId } from '../lib/escaneo.js';
import { siguienteId } from '../lib/ids.js';
import { catalogosFormulario, leerFormularioPieza, traducirErrorSqlite, hoyLocal } from '../lib/validacion.js';
import { resolverIdRegistro, registrarPieza, editarPieza } from '../lib/movimientos.js';
import { subidaFoto, guardarFoto, borrarFoto } from '../lib/fotos.js';

export function rutasPiezas({ db, ajustes }) {
  const r = Router();
  const dirFotos = path.resolve(ajustes.fotosDir);

  // ---------- Registrar (flujo a: etiqueta preimpresa · flujo b: ID automático) ----------
  function verRegistrar(res, { valores, errores = {}, estado = 200 }) {
    res.status(estado).render('registrar', {
      titulo: 'Registrar pieza',
      cat: catalogosFormulario(db),
      proximoId: siguienteId(db),
      valores,
      errores,
    });
  }

  r.get('/registrar', requiereEditor, (req, res) => {
    let id = '';
    if (typeof req.query.id === 'string' && req.query.id.trim()) {
      const resultado = extraerId(req.query.id);
      if (resultado.id) {
        if (db.prepare('SELECT 1 FROM piezas WHERE id = ?').get(resultado.id)) {
          avisar(req, 'info', `${resultado.id} ya está registrada: esta es su ficha.`);
          return res.redirect(303, `/p/${resultado.id}`);
        }
        id = resultado.id;
      }
    }
    verRegistrar(res, { valores: { id, fecha_ingreso: hoyLocal(), ubicacion: req.query.ubicacion ?? '' } });
  });

  r.post('/registrar', requiereEditor, (req, res) => {
    const cat = catalogosFormulario(db);
    const { datos, errores } = leerFormularioPieza(req.body, cat);
    const idTexto = String(req.body.id ?? '').slice(0, 200);
    const idResuelto = resolverIdRegistro(db, idTexto);
    if (idResuelto.error) errores.id = idResuelto.error;

    const valores = { ...req.body, id: idTexto };
    if (Object.keys(errores).length) return verRegistrar(res, { valores, errores, estado: 422 });

    try {
      registrarPieza(db, idResuelto.id, datos, req.session.usuario.usuario, { automatico: idResuelto.automatico });
    } catch (err) {
      const traducido = traducirErrorSqlite(err, db, datos);
      if (!traducido) throw err;
      return verRegistrar(res, { valores, errores: { [traducido.campo]: traducido.mensaje }, estado: 422 });
    }
    avisar(
      req,
      'ok',
      idResuelto.automatico
        ? `Pieza registrada con el ID ${idResuelto.id}. Imprime su etiqueta y pégala en la pieza.`
        : `Pieza ${idResuelto.id} registrada.`,
    );
    res.redirect(303, `/p/${idResuelto.id}`);
  });

  // ---------- Editar todo + foto ----------
  function cargarPieza(id) {
    return db.prepare('SELECT * FROM v_piezas WHERE id = ?').get(id);
  }

  function verEditar(res, pieza, { valores, errores = {}, estado = 200 }) {
    res.status(estado).render('editar', {
      titulo: `Editar ${pieza.id}`,
      cat: catalogosFormulario(db),
      pieza,
      valores,
      errores,
    });
  }

  r.get('/p/:id/editar', requiereEditor, (req, res, next) => {
    const { id } = extraerId(req.params.id);
    const pieza = id && cargarPieza(id);
    if (!pieza) return next();
    if (id !== req.params.id) return res.redirect(301, `/p/${id}/editar`);
    verEditar(res, pieza, { valores: { ...pieza, peso_real_kg: pieza.peso_real_kg ?? '' } });
  });

  // multer lee el formulario (con foto) y después se valida el token CSRF.
  function leerMultipart(req, res, next) {
    subidaFoto(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        req.errorFoto = err.code === 'LIMIT_FILE_SIZE' ? 'La foto pesa más de 8 MB. Toma una más liviana.' : 'No se pudo leer la foto.';
        return next();
      }
      next(err);
    });
  }

  // Validación CSRF explícita: la protección global omite los formularios multipart.
  const validarCsrf = (req, res, next) => (csrf.isRequestValid(req) ? next() : next(csrf.invalidCsrfTokenError));

  r.post('/p/:id/editar', requiereEditor, leerMultipart, validarCsrf, async (req, res, next) => {
    try {
      const { id } = extraerId(req.params.id);
      const pieza = id && cargarPieza(id);
      if (!pieza) return next();

      const cat = catalogosFormulario(db);
      const { datos, errores } = leerFormularioPieza(req.body, cat);
      if (req.errorFoto) errores.foto = req.errorFoto;
      else if (req.body.foto_enviada === '1' && !req.file) errores.foto = 'El archivo no es una imagen (usa JPG, PNG o WebP).';
      const valores = { ...pieza, ...req.body };
      if (Object.keys(errores).length) return verEditar(res, pieza, { valores, errores, estado: 422 });

      const nuevos = { ...datos };
      let fotoNueva = null;
      if (req.file) {
        try {
          fotoNueva = await guardarFoto(req.file.buffer, id, dirFotos);
        } catch {
          return verEditar(res, pieza, { valores, errores: { foto: 'El archivo no es una imagen válida.' }, estado: 422 });
        }
        nuevos.foto = fotoNueva;
      } else if (req.body.quitar_foto === '1') {
        nuevos.foto = null;
      }

      try {
        editarPieza(db, id, nuevos, req.session.usuario.usuario);
      } catch (err) {
        if (fotoNueva) borrarFoto(fotoNueva, dirFotos);
        const traducido = traducirErrorSqlite(err, db, datos);
        if (!traducido) throw err;
        return verEditar(res, pieza, { valores, errores: { [traducido.campo]: traducido.mensaje }, estado: 422 });
      }
      if ('foto' in nuevos && pieza.foto) borrarFoto(pieza.foto, dirFotos);
      avisar(req, 'ok', `Cambios de ${id} guardados.`);
      res.redirect(303, `/p/${id}`);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Actualización rápida por escaneo ----------
  r.get('/movimiento', requiereEditor, (req, res) => {
    const { id } = extraerId(typeof req.query.id === 'string' ? req.query.id : '');
    res.render('movimiento', {
      titulo: 'Movimiento rápido',
      modoKiosco: true,
      cat: catalogosFormulario(db),
      idInicial: id ?? '',
    });
  });

  return r;
}
