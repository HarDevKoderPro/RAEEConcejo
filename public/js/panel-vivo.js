// Cifras y "últimos movimientos" del panel que se actualizan en vivo. Lo usan /panel, /demo y la portada.
import { animarNumero } from './vivo.js';

const formatos = {
  kg: (n) => `${n.toLocaleString('es-CO', { maximumFractionDigits: n < 1 ? 3 : 2 })} kg`,
  pct: (n) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`,
};

export async function pedirPanel() {
  const res = await fetch('/api/panel', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`panel ${res.status}`);
  return res.json();
}

export function actualizarCifras(cifras) {
  for (const el of document.querySelectorAll('[data-cifra]')) {
    const valor = Number(cifras[el.dataset.cifra]);
    if (Number.isNaN(valor)) continue;
    const formato = formatos[el.dataset.formato];
    animarNumero(el, valor, formato ? (n) => formato(el.dataset.formato === 'pct' ? Math.round(n * 10) / 10 : n) : undefined);
  }
  const barra = document.querySelector('[data-meta]');
  if (barra) barra.value = cifras.pct_meta;
}

export function pintarUltimos(lista, movimientos) {
  if (!lista) return;
  const items = movimientos.map((m) => {
    const li = document.createElement('li');
    li.className = `ultimo ultimo-${m.tipo}`;
    const icono = document.createElement('span');
    icono.className = 'ultimo-icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.textContent = m.icono;
    const texto = document.createElement('span');
    texto.className = 'ultimo-texto';
    const a = document.createElement('a');
    a.className = 'mono';
    a.href = `/p/${m.pieza_id}`;
    a.textContent = m.pieza_id;
    const cat = document.createElement('span');
    cat.setAttribute('aria-hidden', 'true');
    cat.textContent = m.icono_categoria;
    texto.append(a, ' ', cat, ` ${m.texto}`);
    const fecha = document.createElement('time');
    fecha.className = 'ultimo-fecha';
    fecha.dateTime = m.fecha.replace(' ', 'T');
    fecha.textContent = m.fecha_texto;
    li.append(icono, texto, fecha);
    return li;
  });
  const anteriorPrimero = lista.firstElementChild?.querySelector('time')?.dateTime + lista.firstElementChild?.textContent;
  lista.replaceChildren(...items);
  const nuevoPrimero = lista.firstElementChild;
  if (nuevoPrimero && anteriorPrimero !== nuevoPrimero.querySelector('time')?.dateTime + nuevoPrimero.textContent) {
    nuevoPrimero.classList.add('ultimo-nuevo');
  }
}
