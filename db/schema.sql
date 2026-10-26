-- =====================================================================
--  Inventario RAEE · Sala de Sistemas
--  Esquema SQLite (fuente de verdad del modelo de datos)
--  Se aplica con:  npm run db:init   (ver CLAUDE.md §5)
-- =====================================================================
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ---------------------------------------------------------------------
--  Catálogos (equivalen a la hoja "Catalogo" del Excel)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id                INTEGER PRIMARY KEY,
  nombre            TEXT    NOT NULL UNIQUE,
  icono             TEXT    NOT NULL DEFAULT '📦',
  peso_estimado_kg  REAL    NOT NULL DEFAULT 0 CHECK (peso_estimado_kg >= 0),
  guia_descripcion  TEXT,                       -- qué conviene anotar en Descripción
  requiere_borrado  INTEGER NOT NULL DEFAULT 0 CHECK (requiere_borrado IN (0,1)), -- 1 = almacena datos (discos)
  orden             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS estados (
  nombre  TEXT PRIMARY KEY,
  color   TEXT NOT NULL,                        -- hex para badges
  orden   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS destinos (
  nombre            TEXT PRIMARY KEY,
  desvia_relleno    INTEGER NOT NULL DEFAULT 1 CHECK (desvia_relleno IN (0,1)), -- 1 = "no va a la basura"
  entrega_a_terceros INTEGER NOT NULL DEFAULT 0 CHECK (entrega_a_terceros IN (0,1)), -- sale de la institución o se reinstala
  color             TEXT NOT NULL,
  orden             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ubicaciones (
  codigo       TEXT PRIMARY KEY,                -- p. ej. S1-C1
  nombre       TEXT NOT NULL,                   -- p. ej. Sala 1 · Caja 1
  descripcion  TEXT
);

-- ---------------------------------------------------------------------
--  Etiquetas QR emitidas (impresas). Permite el flujo de etiquetas
--  preimpresas: un ID puede existir aquí sin estar aún en "piezas".
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS etiquetas (
  id          TEXT PRIMARY KEY CHECK (id GLOB 'RAEE-[0-9][0-9][0-9][0-9]'),
  formato     TEXT NOT NULL DEFAULT 'URL' CHECK (formato IN ('ID','URL')), -- ID = QR solo con texto (lote antiguo), URL = QR con enlace a la ficha
  lote        TEXT NOT NULL,
  impresa_en  TEXT NOT NULL DEFAULT (date('now','localtime'))
);

-- ---------------------------------------------------------------------
--  Piezas (equivale a la hoja "Inventario")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS piezas (
  id              TEXT PRIMARY KEY CHECK (id GLOB 'RAEE-[0-9][0-9][0-9][0-9]'),
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  marca           TEXT,
  modelo_pn       TEXT,
  serial          TEXT,
  descripcion     TEXT,
  estado          TEXT NOT NULL DEFAULT 'Por probar' REFERENCES estados(nombre),
  destino         TEXT NOT NULL DEFAULT 'Pendiente'  REFERENCES destinos(nombre),
  ubicacion       TEXT REFERENCES ubicaciones(codigo),
  equipo_destino  TEXT,                         -- p. ej. PC-15 (solo si se reutiliza en la sala)
  peso_real_kg    REAL CHECK (peso_real_kg IS NULL OR peso_real_kg >= 0),
  borrado_seguro  TEXT NOT NULL DEFAULT 'No aplica' CHECK (borrado_seguro IN ('Sí','No','No aplica')),
  foto            TEXT,                         -- ruta relativa en /data/fotos
  notas           TEXT,
  fecha_ingreso   TEXT NOT NULL DEFAULT (date('now','localtime')),
  demo            INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0,1)), -- 1 = dato de demostración (se borra con npm run demo:limpiar)
  creado_en       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  CHECK (destino <> 'Reutilizada en la sala' OR (equipo_destino IS NOT NULL AND equipo_destino <> ''))
);

-- Serial repetido = misma pieza registrada dos veces (equivale a la alerta roja del Excel)
CREATE UNIQUE INDEX IF NOT EXISTS ux_piezas_serial
  ON piezas(serial) WHERE serial IS NOT NULL AND serial <> '';
CREATE INDEX IF NOT EXISTS ix_piezas_categoria ON piezas(categoria_id);
CREATE INDEX IF NOT EXISTS ix_piezas_destino   ON piezas(destino);
CREATE INDEX IF NOT EXISTS ix_piezas_ubicacion ON piezas(ubicacion);

-- ---------------------------------------------------------------------
--  Seguridad de la información: un disco no puede donarse ni
--  reinstalarse sin borrado seguro confirmado.
-- ---------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS tr_borrado_seguro_ins
BEFORE INSERT ON piezas
WHEN (SELECT requiere_borrado FROM categorias WHERE id = NEW.categoria_id) = 1
 AND (SELECT entrega_a_terceros FROM destinos WHERE nombre = NEW.destino) = 1
 AND NEW.borrado_seguro <> 'Sí'
BEGIN
  SELECT RAISE(ABORT, 'BORRADO_SEGURO: este disco necesita borrado seguro antes de donarse o reutilizarse');
END;

CREATE TRIGGER IF NOT EXISTS tr_borrado_seguro_upd
BEFORE UPDATE ON piezas
WHEN (SELECT requiere_borrado FROM categorias WHERE id = NEW.categoria_id) = 1
 AND (SELECT entrega_a_terceros FROM destinos WHERE nombre = NEW.destino) = 1
 AND NEW.borrado_seguro <> 'Sí'
BEGIN
  SELECT RAISE(ABORT, 'BORRADO_SEGURO: este disco necesita borrado seguro antes de donarse o reutilizarse');
END;

CREATE TRIGGER IF NOT EXISTS tr_piezas_actualizado
AFTER UPDATE ON piezas
BEGIN
  UPDATE piezas SET actualizado_en = datetime('now','localtime') WHERE id = NEW.id;
END;

-- ---------------------------------------------------------------------
--  Historial de movimientos (trazabilidad de cada pieza)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos (
  id              INTEGER PRIMARY KEY,
  pieza_id        TEXT NOT NULL REFERENCES piezas(id) ON DELETE CASCADE,
  fecha           TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  tipo            TEXT NOT NULL CHECK (tipo IN ('registro','estado','destino','ubicacion','edicion','borrado_seguro')),
  valor_anterior  TEXT,
  valor_nuevo     TEXT,
  usuario         TEXT,
  nota            TEXT
);
CREATE INDEX IF NOT EXISTS ix_mov_pieza ON movimientos(pieza_id, fecha);

-- ---------------------------------------------------------------------
--  Usuarios (solo para editar; consultar es público)
--  No se siembran usuarios: se crean con  npm run admin:crear
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id        INTEGER PRIMARY KEY,
  usuario   TEXT NOT NULL UNIQUE,
  nombre    TEXT NOT NULL,
  hash      TEXT NOT NULL,                      -- bcrypt
  rol       TEXT NOT NULL DEFAULT 'editor' CHECK (rol IN ('admin','editor')),
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS config (
  clave  TEXT PRIMARY KEY,
  valor  TEXT NOT NULL
);

-- ---------------------------------------------------------------------
--  Vistas de apoyo
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS v_piezas;
CREATE VIEW v_piezas AS
SELECT p.*,
       c.nombre  AS categoria,
       c.icono   AS icono,
       c.requiere_borrado,
       COALESCE(p.peso_real_kg, c.peso_estimado_kg) AS peso_kg,
       CASE WHEN p.peso_real_kg IS NULL THEN 'estimado' ELSE 'medido' END AS peso_origen,
       u.nombre  AS ubicacion_nombre,
       d.desvia_relleno,
       (p.destino <> 'Pendiente') AS tiene_destino_final,
       -- alertas (equivalen a las celdas amarillas del Excel)
       TRIM(
         CASE WHEN p.ubicacion IS NULL THEN 'Sin ubicación. ' ELSE '' END ||
         CASE WHEN c.requiere_borrado = 1 AND p.borrado_seguro <> 'Sí' THEN 'Disco sin borrado seguro. ' ELSE '' END ||
         CASE WHEN COALESCE(p.marca,'') = '' AND COALESCE(p.modelo_pn,'') = '' THEN 'Falta marca o modelo. ' ELSE '' END
       ) AS alertas
FROM piezas p
JOIN categorias c ON c.id = p.categoria_id
JOIN destinos   d ON d.nombre = p.destino
LEFT JOIN ubicaciones u ON u.codigo = p.ubicacion;

DROP VIEW IF EXISTS v_panel;
CREATE VIEW v_panel AS
SELECT
  (SELECT COUNT(*) FROM piezas)                                              AS piezas_registradas,
  (SELECT ROUND(COALESCE(SUM(peso_kg),0),2) FROM v_piezas)                   AS kg_inventariados,
  (SELECT ROUND(COALESCE(SUM(peso_kg),0),2) FROM v_piezas WHERE tiene_destino_final = 1) AS kg_con_destino_final,
  (SELECT COUNT(*) FROM piezas WHERE destino = 'Reutilizada en la sala')     AS reutilizadas_en_sala,
  (SELECT COUNT(DISTINCT equipo_destino) FROM piezas
     WHERE destino = 'Reutilizada en la sala' AND COALESCE(equipo_destino,'') <> '') AS equipos_reparados,
  (SELECT COUNT(*) FROM piezas WHERE destino = 'Pendiente')                  AS pendientes,
  (SELECT ROUND(100.0 * SUM(desvia_relleno * tiene_destino_final) / NULLIF(COUNT(*),0), 1) FROM v_piezas) AS pct_no_va_a_basura,
  (SELECT COUNT(*) FROM v_piezas WHERE requiere_borrado = 1 AND borrado_seguro = 'Sí') AS discos_borrados,
  (SELECT COUNT(*) FROM v_piezas WHERE requiere_borrado = 1)                 AS discos_total,
  (SELECT COUNT(*) FROM v_piezas WHERE peso_origen = 'medido')               AS piezas_pesadas,
  (SELECT CAST(valor AS INTEGER) FROM config WHERE clave = 'meta_semestre')  AS meta_semestre;
