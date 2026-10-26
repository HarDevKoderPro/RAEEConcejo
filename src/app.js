import express from 'express';
import { contarPiezas } from './db.js';

// Crea la aplicación sobre una base ya abierta (las pruebas pasan una base temporal).
export function crearApp({ db }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/salud', (req, res) => {
    try {
      res.json({ ok: true, piezas: contarPiezas(db) });
    } catch (err) {
      console.error('[salud]', err);
      res.status(503).json({ ok: false });
    }
  });

  app.use((req, res) => {
    res.status(404).type('text').send('No encontramos esta página.');
  });

  // Nunca se muestra un error técnico crudo: se registra en consola y se responde en español.
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (res.headersSent) return next(err);
    res.status(500).type('text').send('Algo salió mal. Intenta de nuevo en un momento.');
  });

  return app;
}
