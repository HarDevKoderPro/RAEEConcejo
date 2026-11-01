// Actualización rápida por escaneo (CLAUDE.md §7): se escanea una pieza y aparecen botones
// grandes de estado, destino, ubicación y borrado seguro. Cada toque guarda el cambio y lo deja
// en el historial. Lo usan /movimiento y /demo (que además muestra la ficha y el panel).

export function iniciarMovimiento({ alMostrar = () => {} } = {}) {
const campo = document.getElementById('escaneo');
const form = document.getElementById('form-escaneo');
const estado = document.getElementById('estado-escaneo');
const resultado = document.getElementById('resultado');
const cambios = document.getElementById('cambios');
const token = document.querySelector('meta[name="csrf-token"]').content;
const CAT = JSON.parse(document.getElementById('catalogos').textContent);

let pieza = null;
let lineas = [];
let temporizador = null;

// Foco: vuelve al campo de escaneo solo si no hay otro campo en uso (p. ej. el del equipo).
setInterval(() => {
  if ((document.activeElement === document.body || !document.activeElement) && document.visibilityState === 'visible') {
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
  temporizador = setTimeout(() => {
    const texto = lineas.join('\n').trim();
    lineas = [];
    if (texto) consultar(texto);
  }, 200);
});

const hora = () => new Date().toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

function el(etiqueta, atributos = {}, ...hijos) {
  const n = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(typeof h === 'string' ? document.createTextNode(h) : h);
  return n;
}

async function consultar(texto) {
  estado.textContent = 'Buscando…';
  let d;
  try {
    const res = await fetch(`/api/escaneo?texto=${encodeURIComponent(texto)}`, { headers: { Accept: 'application/json' } });
    d = await res.json();
  } catch {
    return aviso('error', '📡', 'Sin conexión con el servidor', 'Revisa la red y vuelve a escanear.');
  }
  if (d.resultado === 'registrada') {
    pieza = d.pieza;
    pintar();
    alMostrar(d);
    estado.textContent = `✔ ${pieza.id} · ${hora()}`;
  } else if (d.resultado === 'sin_registrar' || d.resultado === 'no_existe') {
    pieza = null;
    alMostrar(null);
    const sin = d.resultado === 'sin_registrar';
    aviso(sin ? 'info' : 'error', sin ? '🏷️' : '✖', sin ? 'Etiqueta sin registrar' : 'No está en el inventario',
      sin ? 'La etiqueta existe, pero la pieza todavía no se ha registrado.' : 'Puedes registrarla ahora con este ID.', d.id,
      el('a', { class: 'boton', href: `/registrar?id=${d.id}` }, `＋ Registrar ${d.id}`));
    estado.textContent = `${d.id} · ${hora()}`;
  } else {
    pieza = null;
    alMostrar(null);
    aviso(d.error === 'QR_ANTIGUO' ? 'ambar' : 'error', d.error === 'QR_ANTIGUO' ? '⚠️' : '✖',
      d.error === 'QR_ANTIGUO' ? 'QR antiguo' : 'Código no reconocido', d.mensaje || 'Escanea de nuevo.');
    estado.textContent = `Revisa el aviso · ${hora()}`;
  }
}

function aviso(tipo, icono, titulo, texto, id, accion) {
  resultado.replaceChildren(
    el('div', { class: `tarjeta resultado resultado-${tipo} aparece`, role: 'alert' },
      el('p', { class: 'resultado-icono', 'aria-hidden': 'true' }, icono),
      el('h2', {}, titulo),
      id ? el('p', { class: 'resultado-id mono' }, id) : null,
      el('p', {}, texto),
      accion ? el('p', {}, accion) : null,
    ),
  );
}

// --- Pieza con sus botones ---------------------------------------------------------------
function grupo(titulo, contenido, extra) {
  return el('section', { class: 'mov-grupo' }, el('h3', {}, titulo), el('div', { class: 'mov-botones' }, contenido), extra);
}

function boton(texto, actual, alTocar, clase = '') {
  return el('button', { type: 'button', class: `mov-boton ${clase} ${actual ? 'mov-actual' : ''}`, 'aria-pressed': actual ? 'true' : 'false', onclick: alTocar }, texto);
}

function pintar(mensaje) {
  const p = pieza;
  const esDisco = p.requiere_borrado;
  const bloqueaDestino = (d) => esDisco && d.terceros && p.borrado_seguro !== 'Sí';

  const zonaEquipo = el('div', { class: 'mov-equipo', hidden: true },
    el('label', { for: 'mov-equipo' }, 'Equipo donde se instaló'),
    el('input', { id: 'mov-equipo', type: 'text', maxlength: '30', placeholder: 'PC-15', value: p.equipo_destino || '', autocapitalize: 'characters',
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); confirmarEquipo(); } } }),
    el('button', { type: 'button', class: 'boton', onclick: () => confirmarEquipo() }, 'Confirmar'),
  );
  function confirmarEquipo() {
    const equipo = document.getElementById('mov-equipo').value.trim();
    if (!equipo) return document.getElementById('mov-equipo').focus();
    cambiar('destino', 'Reutilizada en la sala', equipo);
  }

  resultado.replaceChildren(
    el('article', { class: 'mov-pieza aparece' },
      el('header', { class: 'tarjeta ficha-cabecera' },
        el('div', { class: 'ficha-icono', 'aria-hidden': 'true' }, p.icono),
        el('div', { class: 'ficha-titulos' },
          el('p', { class: 'ficha-categoria' }, p.categoria),
          el('h2', { class: 'ficha-id' }, p.id),
          el('p', { class: 'mov-resumen' }, [p.marca, p.modelo_pn, p.descripcion].filter(Boolean).join(' · ')),
        ),
        el('a', { class: 'boton boton-secundario mov-ficha', href: `/p/${p.id}`, target: '_blank', rel: 'noopener' }, 'Ver ficha'),
      ),
      mensaje ?? null,
      el('div', { class: 'insignias' },
        el('span', { class: `insignia estado-${p.clase_estado}` }, el('span', { class: 'insignia-rotulo' }, 'Estado'), ` ${p.estado}`),
        el('span', { class: `insignia destino-${p.clase_destino}` }, el('span', { class: 'insignia-rotulo' }, 'Destino'), ` ${p.destino}${p.equipo_destino ? ' · ' + p.equipo_destino : ''}`),
        el('span', { class: 'insignia' }, el('span', { class: 'insignia-rotulo' }, 'Lugar'), ` ${p.ubicacion_nombre || 'Sin ubicación'}`),
      ),
      esDisco
        ? grupo('🔒 Borrado seguro', [
            boton('Hecho', p.borrado_seguro === 'Sí', () => cambiar('borrado_seguro', 'Sí'), 'mov-ok'),
            boton('Pendiente', p.borrado_seguro === 'No', () => cambiar('borrado_seguro', 'No')),
          ])
        : null,
      grupo('Estado', CAT.estados.map((e) => boton(e, p.estado === e, () => cambiar('estado', e)))),
      grupo('Destino', CAT.destinos.map((d) =>
        boton(`${d.nombre === 'Reutilizada en la sala' ? '🌱 ' : ''}${bloqueaDestino(d) ? '🔒 ' : ''}${d.nombre}`, p.destino === d.nombre, () => {
          if (d.nombre === 'Reutilizada en la sala') {
            zonaEquipo.hidden = false;
            document.getElementById('mov-equipo').focus();
          } else {
            cambiar('destino', d.nombre);
          }
        }, bloqueaDestino(d) ? 'mov-bloqueado' : ''),
      ), zonaEquipo),
      grupo('Ubicación', CAT.ubicaciones.map((u) => boton(u.nombre, p.ubicacion === u.codigo, () => cambiar('ubicacion', u.codigo)))),
    ),
  );
}

async function cambiar(campoCambio, valor, equipo) {
  if (!pieza) return;
  const id = pieza.id;
  let res;
  let d;
  try {
    res = await fetch(`/api/piezas/${id}/movimiento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-csrf-token': token },
      body: JSON.stringify({ campo: campoCambio, valor, equipo_destino: equipo }),
    });
    d = await res.json();
  } catch {
    return pintar(el('p', { class: 'mov-mensaje mov-error', role: 'alert' }, '📡 Sin conexión: el cambio no se guardó.'));
  }
  if (res.status === 401) {
    window.location.href = `/entrar?siguiente=${encodeURIComponent('/movimiento?id=' + id)}`;
    return;
  }
  if (!res.ok) {
    const clase = d.codigo === 'BORRADO_SEGURO' ? 'mov-ambar' : 'mov-error';
    return pintar(el('p', { class: `mov-mensaje ${clase}`, role: 'alert' }, `${d.codigo === 'BORRADO_SEGURO' ? '🔒 ' : '✖ '}${d.mensaje}`));
  }
  pieza = d.pieza;
  alMostrar(d);
  const texto = campoCambio === 'ubicacion'
    ? `Ubicación → ${pieza.ubicacion_nombre}`
    : campoCambio === 'borrado_seguro'
      ? `Borrado seguro → ${valor === 'Sí' ? 'hecho' : 'pendiente'}`
      : `${campoCambio === 'estado' ? 'Estado' : 'Destino'} → ${valor}${equipo ? ' · ' + equipo.toUpperCase() : ''}`;
  pintar(el('p', { class: 'mov-mensaje mov-ok', role: 'status' }, `✔ ${texto}. ${pieza.impacto.icono} ${pieza.impacto.texto}`));
  registrarCambio(id, texto);
  campo.focus({ preventScroll: true });
}

function registrarCambio(id, texto) {
  cambios.closest('section').hidden = false;
  cambios.prepend(el('li', { class: 'reciente reciente-ok' }, el('a', { href: `/p/${id}`, target: '_blank', rel: 'noopener' }, id), el('span', {}, `${texto} · ${hora()}`)));
  while (cambios.children.length > 8) cambios.lastElementChild.remove();
}

if (campo.value.trim()) {
  const inicial = campo.value.trim();
  campo.value = '';
  consultar(inicial);
}
}
