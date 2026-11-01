// Portada: las tres cifras del panel suben en vivo cuando alguien registra o cambia una pieza.
import { escucharEventos } from './vivo.js';
import { pedirPanel, actualizarCifras } from './panel-vivo.js';

let pendiente = null;
escucharEventos({
  alMovimiento() {
    clearTimeout(pendiente);
    pendiente = setTimeout(async () => {
      try {
        actualizarCifras((await pedirPanel()).cifras);
      } catch (err) {
        console.error('[portada]', err);
      }
    }, 150);
  },
});
