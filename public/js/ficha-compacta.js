// Ficha compacta de una pieza construida con datos de la API. La usan /consulta y /demo.
// Construcción segura del DOM: siempre textContent, nunca innerHTML.

export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v == null) continue;
    if (k === 'class') nodo.className = v;
    else nodo.setAttribute(k, v);
  }
  for (const h of hijos.flat()) {
    if (h == null || h === false) continue;
    nodo.append(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return nodo;
}

function dato(rotulo, valor, clase) {
  return el('div', { class: clase }, el('dt', {}, rotulo), el('dd', {}, valor || 'Sin registrar'));
}

export function construirFicha(p, historial, { hitos = 3 } = {}) {
  const borrado = p.requiere_borrado
    ? p.borrado_seguro === 'Sí'
      ? el('p', { class: 'borrado borrado-si', 'data-vivo': 'borrado' }, '🔒 ', el('strong', {}, 'Borrado seguro realizado.'))
      : el('p', { class: 'borrado borrado-no', 'data-vivo': 'borrado' }, '⚠️ ', el('strong', {}, 'Borrado seguro pendiente.'),
          ' No puede donarse, reutilizarse ni ir a reciclaje hasta borrarlo.')
    : null;

  const ultimos = historial.slice(0, hitos).map((m) =>
    el('li', { class: `hito hito-${m.tipo}` },
      el('span', { class: 'hito-icono', 'aria-hidden': 'true' }, m.icono),
      el('div', { class: 'hito-cuerpo' },
        el('p', { class: 'hito-titulo' }, m.titulo),
        el('p', { class: 'hito-detalle' }, m.valor_anterior ? `${m.valor_anterior} → ${m.valor_nuevo}` : m.valor_nuevo ?? ''),
        el('p', { class: 'hito-fecha' }, m.fecha_texto),
      ),
    ),
  );

  return el('article', { class: 'ficha ficha-kiosco' },
    el('header', { class: 'tarjeta ficha-cabecera' },
      el('div', { class: 'ficha-icono', 'aria-hidden': 'true' }, p.icono),
      el('div', { class: 'ficha-titulos' },
        el('p', { class: 'ficha-categoria' }, p.categoria),
        el('h2', { class: 'ficha-id' }, p.id),
        p.demo ? el('span', { class: 'etiqueta-demo' }, 'dato de demostración') : null,
      ),
    ),
    el('section', { class: 'tarjeta ubicacion-destacada', 'data-vivo': 'ubicacion' },
      el('span', { class: 'ubicacion-icono', 'aria-hidden': 'true' }, '📍'),
      el('div', {},
        el('p', { class: 'rotulo' }, 'Dónde está'),
        el('p', { class: 'ubicacion-nombre' }, p.ubicacion_nombre || 'Sin ubicación asignada'),
        p.ubicacion ? el('p', { class: 'ubicacion-codigo' }, `Código ${p.ubicacion}`) : null,
        p.ubicacion ? el('a', { class: 'enlace-mapa', href: `/ubicaciones?resaltar=${p.id}`, target: '_blank', rel: 'noopener' }, 'Ver en el mapa →') : null,
      ),
    ),
    el('div', { class: 'insignias' },
      el('span', { class: `insignia estado-${p.clase_estado}`, 'data-vivo': 'estado' }, el('span', { class: 'insignia-rotulo' }, 'Estado'), ` ${p.estado}`),
      el('span', { class: `insignia destino-${p.clase_destino}`, 'data-vivo': 'destino' }, el('span', { class: 'insignia-rotulo' }, 'Destino'), ` ${p.destino}`),
    ),
    el('p', { class: `impacto impacto-${p.clase_destino}`, 'data-vivo': 'impacto' }, `${p.impacto.icono} ${p.impacto.texto}`),
    el('section', { class: 'tarjeta' },
      el('dl', { class: 'datos' },
        dato('Marca', p.marca),
        dato('Modelo / P/N', p.modelo_pn),
        dato('Serial', p.serial, 'mono'),
        dato('Peso', `${p.peso_texto} (${p.peso_origen})`),
        dato('Descripción', p.descripcion, 'ancho'),
      ),
      borrado,
    ),
    ultimos.length
      ? el('section', { class: 'tarjeta' }, el('h3', {}, 'Últimos movimientos'), el('ol', { class: 'linea-tiempo', 'data-vivo': 'historial' }, ultimos))
      : null,
    el('p', {}, el('a', { class: 'boton boton-secundario', href: `/p/${p.id}`, target: '_blank', rel: 'noopener' }, 'Abrir ficha completa')),
  );
}

// Resalta brevemente lo que cambió entre la ficha anterior y la nueva (§7).
export function resaltarCambios(anterior, nueva) {
  if (!anterior) return;
  for (const nodo of nueva.querySelectorAll('[data-vivo]')) {
    const viejo = anterior.querySelector(`[data-vivo="${nodo.dataset.vivo}"]`);
    if (!viejo || viejo.textContent.trim() !== nodo.textContent.trim()) {
      (nodo.tagName === 'OL' ? nodo.firstElementChild : nodo)?.classList.add('resaltado');
    }
  }
}
