import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { contarPiezas } from './db.js';
import { hayDatosDemo } from './lib/piezas.js';
import { rutasPublicas } from './routes/publicas.js';
import { rutasApi } from './routes/api.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Crea la aplicación sobre una base ya abierta (las pruebas pasan una base temporal).
export function crearApp({ db, opciones = {} }) {
  const ajustes = { ...config, ...opciones };
  const app = express();
  app.disable('x-powered-by');
  app.set('views', path.join(raiz, 'src', 'views'));
  app.set('view engine', 'ejs');
  app.set('trust proxy', 'loopback'); // detrás de Nginx en el VPS

  // CSP propia: scripts y estilos solo del propio servidor, sin 'unsafe-inline' (§10.1).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // Solo con HTTPS: en http://IP (prueba) forzarlo rompería la página.
          ...(ajustes.baseUrl.startsWith('https://') ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity: ajustes.baseUrl.startsWith('https://'),
    }),
  );

  app.use(express.static(path.join(raiz, 'public'), { maxAge: ajustes.produccion ? '1h' : 0 }));

  // Datos comunes a todas las vistas.
  app.use((req, res, next) => {
    res.locals.rutaActual = req.path;
    res.locals.modoKiosco = false;
    res.locals.scripts = [];
    try {
      res.locals.avisoDemo = ajustes.mostrarAvisoDemo && hayDatosDemo(db);
    } catch {
      res.locals.avisoDemo = false;
    }
    next();
  });

  app.get('/salud', (req, res) => {
    try {
      res.json({ ok: true, piezas: contarPiezas(db) });
    } catch (err) {
      console.error('[salud]', err);
      res.status(503).json({ ok: false });
    }
  });

  app.use('/api', rutasApi({ db }));
  app.use(rutasPublicas({ db }));

  app.use((req, res) => {
    res.status(404).render('error', {
      titulo: 'Página no encontrada',
      icono: '🧭',
      mensaje: 'No encontramos esta página.',
    });
  });

  // Nunca se muestra un error técnico crudo: se registra en consola y se responde en español.
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (res.headersSent) return next(err);
    const texto = 'Algo salió mal. Intenta de nuevo en un momento.';
    if (req.path.startsWith('/api/')) return res.status(500).json({ resultado: 'error', mensaje: texto });
    res.status(500).render('error', { titulo: 'Error', icono: '⚠️', mensaje: texto }, (fallo, html) => {
      if (fallo) return res.type('text').send(texto);
      res.send(html);
    });
  });

  return app;
}
