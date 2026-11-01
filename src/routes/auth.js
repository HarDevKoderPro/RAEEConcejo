import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verificarCredenciales, destinoSeguro } from '../lib/auth.js';
import { avisar } from '../lib/sesiones.js';

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

  r.get('/entrar', (req, res) => {
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
