import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verificarCredenciales, destinoSeguro, crearUsuario } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';
import { usuarioMaestro } from '../lib/maestra.js';

export function rutasAuth({ db }) {
  const r = Router();

  // Máximo 5 intentos fallidos cada 15 minutos por IP (CLAUDE.md §7).
  const limite = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render('entrar', {
        titulo: 'Entrar',
        siguiente: destinoSeguro(req.body?.siguiente),
        usuarioEscrito: '',
        error: 'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.',
      }),
  });

  // El usuario del creador (clave maestra) no cuenta: el primer uso sigue funcionando para los aprendices.
  const sinUsuarios = () => db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE usuario <> ?').get(usuarioMaestro()).n === 0;

  // Configuración inicial: solo existe mientras el sitio no tiene ningún usuario. Crea el primer
  // administrador desde la página (sin entrar al servidor) y luego se desactiva para siempre.
  function verPrimerUso(res, { error = null, valores = {}, estado = 200 } = {}) {
    res.status(estado).render('primer-uso', { titulo: 'Configuración inicial', error, valores });
  }

  r.get('/primer-uso', (req, res) => {
    if (!sinUsuarios()) return res.redirect(303, '/entrar');
    verPrimerUso(res);
  });

  r.post('/primer-uso', limite, (req, res, next) => {
    const { nombre, documento, usuario, contrasena, repetir } = req.body;
    const valores = { nombre, documento, usuario };
    if (String(contrasena ?? '') !== String(repetir ?? '')) return verPrimerUso(res, { error: 'Las contraseñas no coinciden.', valores, estado: 422 });
    let creado;
    try {
      if (!String(documento ?? '').trim()) throw new Error('Escribe el documento de identidad.');
      // Dentro de una transacción: si dos personas envían a la vez, solo una queda como administrador.
      creado = db.transaction(() => {
        if (!sinUsuarios()) return null;
        crearUsuario(db, { nombre, documento, usuario, contrasena, rol: 'admin' });
        return db.prepare('SELECT id, usuario, nombre, rol FROM usuarios WHERE usuario = ?').get(String(usuario).trim().toLowerCase());
      }).immediate();
    } catch (err) {
      return verPrimerUso(res, { error: err.message, valores, estado: 422 });
    }
    if (!creado) return res.redirect(303, '/entrar');
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.usuario = creado;
      avisar(req, 'ok', `Listo, ${creado.nombre}: eres el administrador. Ahora crea los usuarios de los registradores.`);
      req.session.save((err2) => (err2 ? next(err2) : res.redirect(303, '/admin#usuarios')));
    });
  });

  r.get('/entrar', (req, res) => {
    // /entrar?creador=1 muestra el formulario aunque no haya usuarios (para entrar con la clave maestra).
    if (sinUsuarios() && !req.query.creador) return res.redirect(303, '/primer-uso');
    const siguiente = destinoSeguro(req.query.siguiente);
    if (req.session.usuario) return res.redirect(303, siguiente);
    res.render('entrar', { titulo: 'Entrar', siguiente, usuarioEscrito: '', error: null });
  });

  r.post('/entrar', limite, async (req, res, next) => {
    try {
      const siguiente = destinoSeguro(req.body.siguiente);
      const usuario = await verificarCredenciales(db, req.body.usuario, req.body.contrasena);
      if (!usuario) {
        return res.status(401).render('entrar', {
          titulo: 'Entrar',
          siguiente,
          usuarioEscrito: String(req.body.usuario ?? '').slice(0, 30),
          error: 'Usuario o contraseña incorrectos.',
        });
      }
      // Sesión nueva al entrar (evita que alguien fije la sesión de otro).
      req.session.regenerate((err) => {
        if (err) return next(err);
        req.session.usuario = usuario;
        avisar(req, 'ok', `Hola, ${usuario.nombre}. Ya puedes registrar y actualizar piezas.`);
        req.session.save((err2) => (err2 ? next(err2) : res.redirect(303, siguiente)));
      });
    } catch (err) {
      next(err);
    }
  });

  r.post('/salir', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('raee.sid');
      res.redirect(303, '/');
    });
  });

  return r;
}
