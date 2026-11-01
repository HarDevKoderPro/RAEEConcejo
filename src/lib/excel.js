// Exportar el inventario a Excel (CLAUDE.md §10.2, plan B de la exposición).
// Columnas de la hoja "Inventario" del Excel original. Sin sesión no se exportan las notas.
import ExcelJS from 'exceljs';
import { filtroSql } from './busqueda.js';
import { cifrasPanel } from './panel.js';

const VERDE = 'FF12403C';
const MENTA = 'FFE6F4F0';
const MAX_FILAS = 10000;

const COLUMNAS = [
  { header: 'ID', key: 'id', width: 12 },
  { header: 'Categoría', key: 'categoria', width: 22 },
  { header: 'Marca', key: 'marca', width: 16 },
  { header: 'Modelo / P/N', key: 'modelo_pn', width: 20 },
  { header: 'Serial', key: 'serial', width: 20 },
  { header: 'Descripción', key: 'descripcion', width: 34 },
  { header: 'Estado', key: 'estado', width: 15 },
  { header: 'Destino', key: 'destino', width: 22 },
  { header: 'Equipo destino', key: 'equipo_destino', width: 14 },
  { header: 'Ubicación', key: 'ubicacion_nombre', width: 26 },
  { header: 'Código ubicación', key: 'ubicacion', width: 14 },
  { header: 'Peso (kg)', key: 'peso_kg', width: 10, style: { numFmt: '0.000' } },
  { header: 'Peso medido o estimado', key: 'peso_origen', width: 14 },
  { header: 'Borrado seguro', key: 'borrado_seguro', width: 14 },
  { header: 'Fecha de ingreso', key: 'fecha_ingreso', width: 14 },
  { header: 'Alertas', key: 'alertas', width: 30 },
  { header: 'Dato de demostración', key: 'demo', width: 12 },
];

function encabezado(hoja) {
  const fila = hoja.getRow(1);
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
  fila.alignment = { vertical: 'middle', wrapText: true };
  fila.height = 30;
  hoja.views = [{ state: 'frozen', ySplit: 1 }];
}

// Texto que empieza por =, +, - o @ se guarda como texto, para que Excel no lo ejecute como fórmula.
const seguro = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v);

export async function libroInventario(db, filtros, { privado = false, baseUrl = '' } = {}) {
  const { where, params } = filtroSql(filtros);
  const filas = db
    .prepare(
      `SELECT ${COLUMNAS.map((c) => c.key).join(', ')}${privado ? ', notas' : ''}
         FROM v_piezas ${where} ORDER BY id LIMIT ${MAX_FILAS}`,
    )
    .all(...params);

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Inventario RAEE · Sala de Sistemas';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Inventario');
  hoja.columns = [
    ...COLUMNAS,
    ...(privado ? [{ header: 'Notas internas', key: 'notas', width: 30 }] : []),
    { header: 'Ficha', key: 'ficha', width: 16 },
  ];
  for (const p of filas) {
    const fila = {};
    for (const c of hoja.columns) fila[c.key] = seguro(p[c.key] ?? '');
    fila.peso_kg = p.peso_kg;
    fila.demo = p.demo ? 'Sí' : 'No';
    fila.ficha = baseUrl ? { text: 'Ver ficha', hyperlink: `${baseUrl}/p/${p.id}` } : '';
    hoja.addRow(fila);
  }
  encabezado(hoja);
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } };
  hoja.eachRow((fila, n) => {
    if (n > 1 && n % 2 === 0) fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAF9' } };
  });

  // Hoja Panel: las mismas definiciones de §6.5.
  const c = cifrasPanel(db);
  const panel = libro.addWorksheet('Panel');
  panel.columns = [{ header: 'Indicador', key: 'k', width: 34 }, { header: 'Valor', key: 'v', width: 14 }, { header: 'Cómo se calcula', key: 'd', width: 60 }];
  [
    ['Piezas registradas', c.piezas_registradas, 'Todas las piezas del inventario'],
    ['Kg inventariados', c.kg_inventariados, 'Peso de todas las piezas (medido o, si no se pesó, el estimado de su categoría)'],
    ['Kg con destino final', c.kg_con_destino_final, 'Peso de las piezas cuyo destino no es "Pendiente"'],
    ['Reutilizadas en la sala', c.reutilizadas_en_sala, 'Destino = Reutilizada en la sala'],
    ['Equipos reparados', c.equipos_reparados, 'Equipos distintos que recibieron piezas'],
    ['% que no va a la basura', c.pct_no_va_a_basura, 'Piezas con destino final que evita el relleno ÷ total'],
    ['Discos con borrado seguro', `${c.discos_borrados} de ${c.discos_total}`, 'Seguridad de la información'],
    ['Pesos medidos', `${c.piezas_pesadas} de ${c.piezas_registradas}`, 'Cuántos pesos son medidos y no estimados'],
    ['Meta del semestre', c.meta_semestre ?? '', 'Piezas que se espera registrar'],
  ].forEach(([k, v, d]) => panel.addRow({ k, v, d }));
  encabezado(panel);
  panel.getColumn('k').font = { bold: true };
  panel.getColumn('k').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MENTA } };
  panel.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE } };
  panel.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' } };

  if (privado) {
    const movs = db
      .prepare(
        `SELECT m.pieza_id, m.fecha, m.tipo, m.valor_anterior, m.valor_nuevo, m.usuario, m.nota
           FROM movimientos m ${where ? `WHERE m.pieza_id IN (SELECT id FROM v_piezas ${where})` : ''}
          ORDER BY m.fecha, m.id`,
      )
      .all(...params);
    const hojaMov = libro.addWorksheet('Movimientos');
    hojaMov.columns = [
      { header: 'Pieza', key: 'pieza_id', width: 12 },
      { header: 'Fecha', key: 'fecha', width: 19 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Antes', key: 'valor_anterior', width: 28 },
      { header: 'Después', key: 'valor_nuevo', width: 32 },
      { header: 'Usuario', key: 'usuario', width: 16 },
      { header: 'Nota', key: 'nota', width: 30 },
    ];
    for (const m of movs) {
      const fila = {};
      for (const [k, v] of Object.entries(m)) fila[k] = seguro(v ?? '');
      hojaMov.addRow(fila);
    }
    encabezado(hojaMov);
  }

  return { libro, total: filas.length };
}
