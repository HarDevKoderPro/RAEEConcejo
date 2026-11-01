// Formato RAEE-NNNN y siguiente ID libre (CLAUDE.md §6.4, flujo b).
import { formatearId } from './escaneo.js';

// Mayor que cualquier ID en piezas o en etiquetas (las preimpresas también cuentan).
export function siguienteId(db) {
  const { maximo } = db
    .prepare(
      `SELECT MAX(n) AS maximo FROM (
         SELECT CAST(substr(id, 6) AS INTEGER) AS n FROM piezas
         UNION ALL
         SELECT CAST(substr(id, 6) AS INTEGER) AS n FROM etiquetas
       )`,
    )
    .get();
  const siguiente = (maximo ?? 0) + 1;
  if (siguiente > 9999) throw new Error('IDS_AGOTADOS');
  return formatearId(siguiente);
}
