// Canal en vivo con Server-Sent Events (CLAUDE.md §6.6), sin dependencias.
// Lo que se cambia en el PC aparece al instante en la ficha, el panel y /demo.

const MAX_CLIENTES = 300; // protege al servidor (256 MB) si alguien abre muchas conexiones
const LATIDO_MS = 25_000;

const clientes = new Set();

const latido = setInterval(() => {
  for (const res of clientes) res.write(':\n\n'); // comentario: mantiene viva la conexión
}, LATIDO_MS);
latido.unref();

export function conectarEventos(req, res) {
  if (clientes.size >= MAX_CLIENTES) {
    return res.status(503).type('text').send('Demasiadas conexiones en vivo. Recarga en un momento.');
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  res.write(`event: hola\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  clientes.add(res);
  req.on('close', () => clientes.delete(res));
}

export function emitir(tipo, datos) {
  const mensaje = `event: ${tipo}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of clientes) res.write(mensaje);
}

export const totalClientes = () => clientes.size;

// Datos públicos de un movimiento: nunca 'notas' ni usuarios (§6.6).
const ICONOS = { registro: '📥', estado: '🔧', destino: '🎯', ubicacion: '📍', edicion: '✏️', borrado_seguro: '🔒' };
export function eventoMovimiento(db, mov) {
  const pieza = db
    .prepare('SELECT c.nombre AS categoria, c.icono AS icono_categoria FROM piezas p JOIN categorias c ON c.id = p.categoria_id WHERE p.id = ?')
    .get(mov.pieza_id);
  return {
    pieza_id: mov.pieza_id,
    tipo: mov.tipo,
    valor_nuevo: mov.valor_nuevo ?? null,
    icono: mov.tipo === 'destino' && /^Reutilizada/.test(mov.valor_nuevo ?? '') ? '🌱' : ICONOS[mov.tipo] ?? '•',
    categoria: pieza?.categoria ?? null,
    icono_categoria: pieza?.icono_categoria ?? null,
  };
}
