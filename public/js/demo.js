// /demo: escenario del proyector (CLAUDE.md §7). En una sola pantalla: escaneo con botones de
// cambio, la ficha pública de la pieza y el panel en vivo con el aviso de cada movimiento.
import { iniciarMovimiento } from './mov-rapido.js';
import { construirFicha, resaltarCambios } from './ficha-compacta.js';
import { escucharEventos, pintarEstado, mostrarAviso } from './vivo.js';
import { pedirPanel, actualizarCifras, pintarUltimos } from './panel-vivo.js';

const zonaFicha = document.getElementById('demo-ficha');
let idActual = null;

function mostrarFicha(d) {
  if (!d || d.resultado !== 'registrada') return;
  const anterior = idActual === d.pieza.id ? zonaFicha.firstElementChild : null;
  const nueva = construirFicha(d.pieza, d.historial, { hitos: 4 });
  resaltarCambios(anterior, nueva);
  if (!anterior) nueva.classList.add('aparece');
  zonaFicha.replaceChildren(nueva);
  idActual = d.pieza.id;
}

iniciarMovimiento({ alMostrar: mostrarFicha });

let pendiente = null;
function refrescarPanel() {
  clearTimeout(pendiente);
  pendiente = setTimeout(async () => {
    try {
      const d = await pedirPanel();
      actualizarCifras(d.cifras);
      pintarUltimos(document.getElementById('ultimos'), d.movimientos);
    } catch (err) {
      console.error('[demo]', err);
    }
  }, 150);
}

escucharEventos({
  alEstado: pintarEstado,
  alMovimiento(ev) {
    mostrarAviso(document.getElementById('avisos-vivo'), ev);
    refrescarPanel();
  },
});
