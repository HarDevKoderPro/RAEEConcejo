// Modo kiosco para Barcode to PC (CLAUDE.md §7, /consulta).
// Barcode to PC escribe como un teclado y termina con ENTER. Un QR antiguo de varias líneas
// llega como varios ENTER seguidos: se juntan los que llegan en menos de 200 ms y se envían
// como un solo texto, para que el servidor lo reconozca como QR antiguo.

import { el, construirFicha } from './ficha-compacta.js';

const campo = document.getElementById('escaneo');
const form = document.getElementById('form-escaneo');
const estado = document.getElementById('estado-escaneo');
const resultado = document.getElementById('resultado');
const recientes = document.getElementById('recientes');
const seccionRecientes = recientes.closest('section');

const ESPERA_LINEAS_MS = 200;
const MAX_RECIENTES = 6;
let lineas = [];
let temporizador = null;
let peticion = null;

// --- Foco permanente: si se pierde, se recupera solo cada 1 s ---------------------------
setInterval(() => {
  const seleccion = window.getSelection()?.toString();
  if (document.activeElement !== campo && !seleccion && document.visibilityState === 'visible') {
    campo.focus({ preventScroll: true });
  }
}, 1000);

form.addEventListener('submit', (e) => e.preventDefault());
campo.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  lineas.push(campo.value);
  campo.value = '';
  clearTimeout(temporizador);
  temporizador = setTimeout(enviar, ESPERA_LINEAS_MS);
});

async function enviar() {
  const texto = lineas.join('\n').trim();
  lineas = [];
  if (!texto) return;

  peticion?.abort();
  peticion = new AbortController();
  estado.textContent = 'Buscando…';
  estado.className = 'estado-escaneo';

  let datos;
  try {
    const res = await fetch(`/api/escaneo?texto=${encodeURIComponent(texto)}`, {
      signal: peticion.signal,
      headers: { Accept: 'application/json' },
    });
    datos = await res.json();
  } catch (err) {
    if (err.name === 'AbortError') return;
    mostrarAviso('error', '📡', 'Sin conexión con el servidor', 'Revisa la red y vuelve a escanear.');
    estado.textContent = 'Sin conexión.';
    return;
  }

  const hora = new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  switch (datos.resultado) {
    case 'registrada':
      mostrarFicha(datos.pieza, datos.historial);
      estado.textContent = `✔ ${datos.pieza.id} · ${hora}`;
      agregarReciente(datos.pieza.id, `${datos.pieza.icono} ${datos.pieza.categoria}`, 'ok');
      break;
    case 'sin_registrar':
      mostrarAviso('info', '🏷️', 'Etiqueta sin registrar', 'La etiqueta existe, pero la pieza aún no se ha registrado.', datos.id);
      estado.textContent = `${datos.id} sin registrar · ${hora}`;
      agregarReciente(datos.id, 'Sin registrar', 'info');
      break;
    case 'no_existe':
      mostrarAviso('error', '✖', 'No está en el inventario', 'Revisa la etiqueta o escanéala de nuevo.', datos.id);
      estado.textContent = `${datos.id} no existe · ${hora}`;
      agregarReciente(datos.id, 'No está en el inventario', 'error');
      break;
    default:
      if (datos.error === 'QR_ANTIGUO') {
        mostrarAviso('ambar', '⚠️', 'QR antiguo', datos.mensaje);
        agregarReciente('QR antiguo', 'Reimprimir con su ID', 'ambar');
      } else {
        mostrarAviso('error', '✖', 'Código no reconocido', datos.mensaje || 'Escanea de nuevo.');
      }
      estado.textContent = `Revisa el aviso · ${hora}`;
  }
  campo.focus({ preventScroll: true });
}

function reemplazar(nodo) {
  resultado.replaceChildren(nodo);
  nodo.classList.add('aparece');
}

function mostrarAviso(tipo, icono, titulo, texto, id) {
  reemplazar(
    el('div', { class: `tarjeta resultado resultado-${tipo}`, role: 'alert' },
      el('p', { class: 'resultado-icono', 'aria-hidden': 'true' }, icono),
      el('h2', {}, titulo),
      id ? el('p', { class: 'resultado-id mono' }, id) : null,
      el('p', {}, texto),
    ),
  );
}

function mostrarFicha(p, historial) {
  reemplazar(construirFicha(p, historial));
}

function agregarReciente(id, texto, tipo) {
  seccionRecientes.hidden = false;
  const enlace = /^RAEE-\d{4}$/.test(id) ? el('a', { href: `/p/${id}`, target: '_blank', rel: 'noopener' }, id) : el('span', {}, id);
  recientes.prepend(el('li', { class: `reciente reciente-${tipo}` }, enlace, el('span', {}, texto)));
  while (recientes.children.length > MAX_RECIENTES) recientes.lastElementChild.remove();
}
