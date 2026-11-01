// Canal en vivo (CLAUDE.md §6.6). Si el navegador no tiene EventSource, o el canal se cae y no
// vuelve, la página se recarga cada 30 s como respaldo.

const RESPALDO_MS = 30_000;

export function escucharEventos({ alMovimiento, alEstado = () => {} }) {
  if (!('EventSource' in window)) {
    alEstado('respaldo');
    setInterval(() => window.location.reload(), RESPALDO_MS);
    return;
  }
  let respaldo = null;
  const fuente = new EventSource('/eventos');
  fuente.addEventListener('open', () => {
    clearTimeout(respaldo);
    respaldo = null;
    alEstado('vivo');
  });
  fuente.addEventListener('error', () => {
    alEstado('reconectando');
    // EventSource reintenta solo; si en 30 s no volvió, se recarga la página entera.
    if (!respaldo) respaldo = setTimeout(() => window.location.reload(), RESPALDO_MS);
  });
  fuente.addEventListener('movimiento', (e) => {
    try {
      alMovimiento(JSON.parse(e.data));
    } catch (err) {
      console.error('[vivo]', err);
    }
  });
}

// Indicador "● En vivo" (elemento con data-estado-vivo).
export function pintarEstado(estado) {
  const textos = { vivo: 'En vivo', reconectando: 'Reconectando…', respaldo: 'Se actualiza cada 30 s' };
  for (const el of document.querySelectorAll('[data-estado-vivo]')) {
    el.dataset.estadoVivo = estado;
    el.lastElementChild.textContent = textos[estado] ?? estado;
  }
}

const sinMovimiento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cifra que sube con animación hasta su nuevo valor.
export function animarNumero(el, hasta, formatear = (n) => Math.round(n).toLocaleString('es-CO')) {
  const desde = Number(el.dataset.valor ?? hasta);
  el.dataset.valor = hasta;
  if (desde === hasta) return;
  el.classList.remove('cifra-cambio');
  void el.offsetWidth; // reinicia la animación de resaltado
  el.classList.add('cifra-cambio');
  if (sinMovimiento()) {
    el.textContent = formatear(hasta);
    return;
  }
  const inicio = performance.now();
  const duracion = 900;
  const paso = (t) => {
    const avance = Math.min(1, (t - inicio) / duracion);
    const suave = 1 - (1 - avance) ** 3;
    el.textContent = formatear(desde + (hasta - desde) * suave);
    if (avance < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// Aviso flotante del movimiento ("🌱 RAEE-0022 → PC-15").
export function mostrarAviso(contenedor, ev) {
  if (!contenedor) return;
  const aviso = document.createElement('p');
  aviso.className = 'aviso-vivo';
  aviso.setAttribute('role', 'status');
  const icono = document.createElement('span');
  icono.className = 'aviso-vivo-icono';
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = ev.icono;
  const id = document.createElement('strong');
  id.textContent = ev.pieza_id;
  aviso.append(icono, id, ` → ${textoEvento(ev)}`);
  contenedor.prepend(aviso);
  while (contenedor.children.length > 4) contenedor.lastElementChild.remove();
  setTimeout(() => {
    aviso.classList.add('aviso-vivo-sale');
    setTimeout(() => aviso.remove(), 600);
  }, 8000);
}

export function textoEvento(ev) {
  if (ev.tipo === 'registro') return `Ingresó al inventario${ev.categoria ? ` (${ev.categoria})` : ''}`;
  if (ev.tipo === 'borrado_seguro') return ev.valor_nuevo === 'Sí' ? 'Borrado seguro realizado' : 'Borrado seguro pendiente';
  if (ev.tipo === 'edicion') return 'Datos actualizados';
  if (ev.tipo === 'destino' && /^Reutilizada en la sala → /.test(ev.valor_nuevo ?? '')) return ev.valor_nuevo.replace('Reutilizada en la sala → ', '');
  return ev.valor_nuevo ?? '';
}
