// /admin (solo rol admin): usuarios, piezas eliminadas, exportar, respaldo y limpiar demo.
import path from 'node:path';
import { Router } from 'express';
import { requiereAdmin, crearUsuario, NOMBRES_ROL } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';
import { emitir } from '../lib/eventos.js';
import { hoyLocal } from '../lib/validacion.js';
import {
  resumenDemo, limpiarDemo, listarUsuarios, cambiarActivo, listarEliminadas, crearRespaldo, reiniciarSitio,
} from '../lib/admin.js';

export const FRASE_LIMPIAR = 'BORRAR DEMO';
export const FRASE_REINICIAR = 'REINICIAR';

export function rutasAdmin({ db, ajustes }) {
  const r = Router();
  r.use('/admin', requiereAdmin);

  function ver(res, { errores = {}, valores = {}, estado = 200 } = {}) {
    res.status(estado).render('admin', {
      titulo: 'Administración',
      usuarios: listarUsuarios(db),
      eliminadas: listarEliminadas(db),
      nombresRol: NOMBRES_ROL,
      nuevo: valores.nuevo ?? {},
      demo: resumenDemo(db),
      frase: FRASE_LIMPIAR,
      fraseReiniciar: FRASE_REINICIAR,
      errores,
    });
  }

  r.get('/admin', (req, res) => ver(res));

  r.post('/admin/usuarios', (req, res) => {
    const { usuario, nombre, documento, rol, contrasena, repetir } = req.body;
    const nuevo = { usuario, nombre, documento, rol };
    if (String(contrasena ?? '') !== String(repetir ?? '')) {
      return ver(res, { errores: { usuario: 'Las contraseñas no coinciden.' }, valores: { nuevo }, estado: 422 });
    }
    try {
      if (!String(documento ?? '').trim()) throw new Error('Escribe el documento de identidad.');
      const creado = crearUsuario(db, { usuario, nombre, documento, contrasena, rol: rol === 'admin' ? 'admin' : 'editor' });
      avisar(req, 'ok', `Usuario «${creado}» creado. Ya puede entrar.`);
      res.redirect(303, '/admin');
    } catch (err) {
      const mensaje = /UNIQUE/.test(err.message) ? 'Ese usuario ya existe.' : err.message;
      ver(res, { errores: { usuario: mensaje }, valores: { nuevo }, estado: 422 });
    }
  });

  r.post('/admin/usuarios/:id/:accion(desactivar|activar)', (req, res) => {
    const activar = req.params.accion === 'activar';
    try {
      const u = cambiarActivo(db, req.params.id, activar, req.session.usuario.usuario);
      avisar(req, 'ok', activar ? `${u.nombre} puede volver a entrar.` : `${u.nombre} quedó desactivado: ya no puede entrar y sus sesiones se cerraron. Su nombre sigue en el historial.`);
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

  r.post('/admin/reiniciar', async (req, res, next) => {
    if (String(req.body.confirmar_reinicio ?? '').trim().toUpperCase() !== FRASE_REINICIAR) {
      return ver(res, { errores: { reiniciar: `Para confirmar, escribe exactamente: ${FRASE_REINICIAR}` }, estado: 422 });
    }
    try {
      const vaciarInventario = req.body.vaciar_inventario === '1';
      await reiniciarSitio(db, {
        vaciarInventario,
        dirDatos: path.dirname(path.resolve(ajustes.dbPath)),
        fotosDir: path.resolve(ajustes.fotosDir),
      });
      if (vaciarInventario) {
        emitir('movimiento', { pieza_id: 'Inventario', tipo: 'reinicio', valor_nuevo: 'Se reinició: empieza desde cero', icono: '🔄', categoria: null, icono_categoria: null });
      }
      // La sesión de quien reinicia ya se borró de la base; se limpia la cookie y se va al primer paso.
      res.clearCookie('raee.sid');
      res.redirect(303, '/primer-uso');
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
