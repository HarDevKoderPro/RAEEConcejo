// /admin (solo rol admin): usuarios, meta y datos del proyecto, exportar, respaldo y limpiar demo.
import path from 'node:path';
import { Router } from 'express';
import { requiereAdmin, crearUsuario } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';
import { hoyLocal } from '../lib/validacion.js';
import {
  resumenDemo, limpiarDemo, leerConfig, guardarConfig, listarUsuarios, borrarUsuario, crearRespaldo,
} from '../lib/admin.js';

export const FRASE_LIMPIAR = 'BORRAR DEMO';

export function rutasAdmin({ db, ajustes }) {
  const r = Router();
  r.use('/admin', requiereAdmin);

  function ver(res, { errores = {}, valores = {}, estado = 200 } = {}) {
    res.status(estado).render('admin', {
      titulo: 'Administración',
      usuarios: listarUsuarios(db),
      config: { ...leerConfig(db), ...valores.config },
      nuevo: valores.nuevo ?? {},
      demo: resumenDemo(db),
      frase: FRASE_LIMPIAR,
      errores,
    });
  }

  r.get('/admin', (req, res) => ver(res));

  r.post('/admin/config', (req, res) => {
    const { errores } = guardarConfig(db, req.body);
    if (errores) return ver(res, { errores, valores: { config: req.body }, estado: 422 });
    avisar(req, 'ok', 'Configuración guardada.');
    res.redirect(303, '/admin');
  });

  r.post('/admin/usuarios', (req, res) => {
    const { usuario, nombre, rol, contrasena, repetir } = req.body;
    const nuevo = { usuario, nombre, rol };
    if (String(contrasena ?? '') !== String(repetir ?? '')) {
      return ver(res, { errores: { usuario: 'Las contraseñas no coinciden.' }, valores: { nuevo }, estado: 422 });
    }
    try {
      const creado = crearUsuario(db, { usuario, nombre, contrasena, rol: rol === 'admin' ? 'admin' : 'editor' });
      avisar(req, 'ok', `Usuario «${creado}» creado. Ya puede entrar.`);
      res.redirect(303, '/admin');
    } catch (err) {
      const mensaje = /UNIQUE/.test(err.message) ? 'Ese usuario ya existe.' : err.message;
      ver(res, { errores: { usuario: mensaje }, valores: { nuevo }, estado: 422 });
    }
  });

  r.post('/admin/usuarios/:id/borrar', (req, res) => {
    try {
      const borrado = borrarUsuario(db, req.params.id, req.session.usuario.usuario);
      avisar(req, 'ok', `Usuario «${borrado}» borrado y sus sesiones cerradas.`);
      res.redirect(303, '/admin');
    } catch (err) {
      ver(res, { errores: { usuarios: err.message }, estado: 422 });
    }
  });

  r.get('/admin/respaldo', async (req, res, next) => {
    try {
      const { archivo, limpiar } = await crearRespaldo(db);
      res.download(archivo, `raee-respaldo-${hoyLocal()}.db`, (err) => {
        limpiar();
        if (err && !res.headersSent) next(err);
      });
    } catch (err) {
      next(err);
    }
  });

  r.post('/admin/limpiar-demo', (req, res) => {
    if (String(req.body.confirmar ?? '').trim().toUpperCase() !== FRASE_LIMPIAR) {
      return ver(res, { errores: { demo: `Para confirmar, escribe exactamente: ${FRASE_LIMPIAR}` }, estado: 422 });
    }
    const n = limpiarDemo(db, path.resolve(ajustes.fotosDir));
    avisar(req, 'ok', `Se borraron ${n} piezas de demostración con su historial. Las piezas reales no se tocaron.`);
    res.redirect(303, '/admin');
  });

  return r;
}
