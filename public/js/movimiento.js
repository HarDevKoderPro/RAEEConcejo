// /movimiento: actualización rápida por escaneo. Escucha el canal en vivo para repintar la
// pieza en pantalla si otro dispositivo la cambia.
import { iniciarMovimiento } from './mov-rapido.js';
import { escucharEventos } from './vivo.js';

const mov = iniciarMovimiento();
escucharEventos({ alMovimiento: (ev) => mov.refrescarSiEs(ev.pieza_id) });
