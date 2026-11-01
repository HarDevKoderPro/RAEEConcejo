import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { contarPiezas } from './db.js';
import { hayDatosDemo } from './lib/piezas.js';
import { rutasPublicas } from './routes/publicas.js';
import { rutasApi } from './routes/api.js';
import { rutasAuth } from './routes/auth.js';
import { rutasPiezas } from './routes/piezas.js';
import { middlewareSesion, csrf } from './lib/sesiones.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Crea la aplicación sobre una base ya abierta (las pruebas pasan una base temporal).
export function crearApp({ db, opciones = {} }) {
  const ajustes = { ...config, ...opciones };
  const app = express();
  app.disable('x-powered-by');
  app.set('views', path.join(raiz, 'src', 'views'));
  app.set('view engine', 'ejs');
  app.set('trust proxy', ajustes.trustProxy); // detrás del proxy inverso (Caddy) en el VPS

  // CSP propia: scripts y estilos solo del propio servidor, sin 'unsafe-inline' (§10.1).
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
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
  app.use('/fotos', express.static(path.resolve(ajustes.fotosDir), { maxAge: '7d', immutable: true, fallthrough: false }));

  app.use(middlewareSesion(db, ajustes));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '20kb' }));

  // Datos comunes a todas las vistas (antes del CSRF: la página de error también los necesita).
  app.use((req, res, next) => {
    datosBase(req, res);
    next();
  });
  app.use(csrf.csrfSynchronisedProtection);

  function datosBase(req, res) {
    if (res.locals.datosBaseListos) return;
    res.locals.datosBaseListos = true;
    res.locals.titulo = 'Inventario RAEE';
    res.locals.rutaActual = req.path;
    res.locals.modoKiosco = false;
    res.locals.scripts = [];
    res.locals.usuario = req.session?.usuario ?? null;
    // Se llama solo en las vistas con formularios: los visitantes no reciben cookie si no hace falta.
    res.locals.csrfToken = () => csrf.generateToken(req);
    res.locals.aviso = req.session?.aviso ?? null;
    if (req.session?.aviso) delete req.session.aviso;
    try {
      res.locals.avisoDemo = ajustes.mostrarAvisoDemo && hayDatosDemo(db);
    } catch {
      res.locals.avisoDemo = false;
    }
  }

  app.get('/salud', (req, res) => {
    try {
      res.json({ ok: true, piezas: contarPiezas(db) });
    } catch (err) {
      console.error('[salud]', err);
      res.status(503).json({ ok: false });
    }
  });

  app.use('/api', rutasApi({ db, ajustes }));
  app.use(rutasAuth({ db }));
  app.use(rutasPiezas({ db, ajustes }));
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
    if (res.headersSent) return next(err);
    const esApi = req.originalUrl.startsWith('/api/');
    try {
      datosBase(req, res);
    } catch {
      // si ni esto funciona, se responde con texto plano más abajo
    }
    // Si la plantilla de error fallara, se responde con texto: nunca con el detalle técnico.
    const pagina = (estado, datos) =>
      res.status(estado).render('error', datos, (fallo, html) => (fallo ? res.type('text').send(datos.mensaje) : res.send(html)));
    if (err.code === 'EBADCSRFTOKEN') {
      const msg = 'La página caducó por seguridad. Vuelve a cargarla e intenta de nuevo.';
      if (esApi) return res.status(403).json({ resultado: 'error', mensaje: msg });
      return pagina(403, { titulo: 'Página caducada', icono: '🔒', mensaje: msg });
    }
    if (err.status === 404 && req.originalUrl.startsWith('/fotos/')) return res.status(404).end();
    if (err.type === 'entity.too.large') {
      return res.status(413).type('text').send('El formulario es demasiado grande.');
    }
    console.error('[error]', err);
    const texto = 'Algo salió mal. Intenta de nuevo en un momento.';
    if (esApi) return res.status(500).json({ resultado: 'error', mensaje: texto });
    pagina(500, { titulo: 'Error', icono: '⚠️', mensaje: texto });
  });

  return app;
}
