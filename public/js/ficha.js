// Ficha /p/:id: se actualiza sola si la pieza cambia mientras está abierta (CLAUDE.md §6.6),
// con un resaltado breve de lo que cambió.
import { escucharEventos } from './vivo.js';

const ficha = document.querySelector('article.ficha[data-pieza]');
const id = ficha?.dataset.pieza;

async function recargarFicha() {
  try {
    const res = await fetch(window.location.pathname, { headers: { Accept: 'text/html' }, cache: 'no-store' });
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const nueva = doc.querySelector('article.ficha[data-pieza]');
    const actual = document.querySelector('article.ficha[data-pieza]');
    if (!nueva || !actual) return;
    for (const nodo of nueva.querySelectorAll('[data-vivo]')) {
      const viejo = actual.querySelector(`[data-vivo="${nodo.dataset.vivo}"]`);
      if (!viejo || viejo.textContent.replace(/\s+/g, ' ').trim() !== nodo.textContent.replace(/\s+/g, ' ').trim()) {
        (nodo.tagName === 'OL' ? nodo.firstElementChild : nodo)?.classList.add('resaltado');
      }
    }
    actual.replaceWith(nueva);
    document.title = doc.title;
    const aviso = document.getElementById('aviso-actualizada');
    if (aviso) {
      aviso.hidden = false;
      aviso.classList.remove('aparece');
      void aviso.offsetWidth;
      aviso.classList.add('aparece');
    }
  } catch (err) {
    console.error('[ficha]', err);
  }
}

if (id) {
  let pendiente = null;
  escucharEventos({
    alMovimiento(ev) {
      if (ev.pieza_id !== id) return;
      clearTimeout(pendiente);
      pendiente = setTimeout(recargarFicha, 150);
    },
  });
}
