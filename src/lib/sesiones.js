// Sesiones guardadas en la misma base SQLite (CLAUDE.md §3) y protección CSRF (§10.1).
import crypto from 'node:crypto';
import session from 'express-session';
import crearAlmacenSqlite from 'better-sqlite3-session-store';
import { csrfSync } from 'csrf-sync';

const AlmacenSqlite = crearAlmacenSqlite(session);

// El almacén original arranca un temporizador que nunca se libera (impide cerrar el proceso
// y falla si la base ya se cerró). Esta versión lo libera y revisa que la base siga abierta.
class Almacen extends AlmacenSqlite {
  startInterval() {
    this.temporizador = setInterval(() => {
      if (this.client.open) this.clearExpiredSessions();
    }, this.expired.intervalMs);
    this.temporizador.unref();
  }
}

export function middlewareSesion(db, ajustes) {
  let secreto = ajustes.sessionSecret;
  if (!secreto) {
    if (ajustes.produccion) throw new Error('Falta SESSION_SECRET en producción.');
    secreto = crypto.randomBytes(32).toString('hex');
    console.warn('[sesiones] Sin SESSION_SECRET: se usa uno temporal (las sesiones se pierden al reiniciar).');
  }
  return session({
    name: 'raee.sid',
    secret: secreto,
    store: new Almacen({ client: db }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: ajustes.produccion && ajustes.baseUrl.startsWith('https://'),
      maxAge: 12 * 60 * 60 * 1000, // una jornada
    },
  });
}

export const csrf = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf ?? req.headers['x-csrf-token'],
  // Los formularios con foto (multipart) se validan después de que multer lea el cuerpo.
  skipCsrfProtection: (req) => req.is('multipart/form-data') === 'multipart/form-data',
  errorConfig: { statusCode: 403, message: 'CSRF_INVALIDO', code: 'EBADCSRFTOKEN' },
});

// Aviso de una sola vez ("Pieza registrada ✔") que sobrevive a la redirección.
export function avisar(req, tipo, texto) {
  if (req.session) req.session.aviso = { tipo, texto };
}
