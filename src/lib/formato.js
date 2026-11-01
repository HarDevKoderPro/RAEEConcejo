// Fechas en español de Colombia. SQLite guarda texto local ('2026-10-14' o
// '2026-10-14 09:30:00'); se formatea a mano para no depender de la zona horaria del proceso.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partes(texto) {
  const m = String(texto ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return { anio: m[1], mes: Number(m[2]), dia: Number(m[3]), hora: m[4] ? Number(m[4]) : null, min: m[5] };
}

export function fechaCorta(texto) {
  const p = partes(texto);
  if (!p) return '';
  return `${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;
}

export function fechaHora(texto) {
  const p = partes(texto);
  if (!p) return '';
  if (p.hora === null) return fechaCorta(texto);
  const sufijo = p.hora < 12 ? 'a. m.' : 'p. m.';
  const h12 = p.hora % 12 === 0 ? 12 : p.hora % 12;
  return `${fechaCorta(texto)} · ${h12}:${p.min} ${sufijo}`;
}

export function kg(valor) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString('es-CO', { maximumFractionDigits: n < 1 ? 3 : 2 })} kg`;
}
