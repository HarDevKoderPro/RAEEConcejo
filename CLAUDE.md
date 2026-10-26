# CLAUDE.md · Inventario RAEE web (Sala de Sistemas)

> Este archivo guía a Claude Code para construir, probar y desplegar el proyecto.
> Léelo completo antes de escribir código. Si algo de aquí choca con lo que pide la
> persona en la terminal, **gana la persona**: pregúntale y actualiza este archivo.

---

## 1. Contexto y objetivo

Proyecto productivo de aprendices SENA del programa **Técnico en Sistemas Teleinformáticos**.
La sala de sistemas tiene cajas de piezas de computador en desuso: tarjetas madre, RAM,
discos, fuentes, tarjetas, etc. El proyecto las convierte en un **inventario trazable de
residuos de aparatos eléctricos y electrónicos (RAEE)**:

1. Cada pieza recibe una **etiqueta con un QR** único (`RAEE-0001`, `RAEE-0002`…).
2. La etiqueta se **pega** en la pieza.
3. Con **Barcode to PC** (celular como lector) se escanea el QR y la pieza se **registra o
   actualiza** de forma ordenada en la base de datos.
4. Al escanear el QR de una pieza se ven **sus datos y su ubicación en pantalla**. Hay además
   un **buscador por componente** sobre toda la base de datos.
5. Un **panel de impacto** muestra cuántas piezas, cuántos kilos y cuántos equipos de la sala
   se recuperaron.

Este proyecto **reemplaza un libro de Excel** (`Inventario_RAEE_Sala_Sistemas.xlsx`) que ya
funciona con estas hojas: Inventario, Consulta, Panel, Catálogo y Flujo y prueba. La versión web
debe hacer **todo lo que hacía el Excel** y además lo que el Excel no podía:

- ver la ficha desde **cualquier celular**, escaneando con la cámara (sin instalar nada);
- buscar y filtrar;
- usarse **entre varias personas a la vez**;
- generar las etiquetas solo;
- guardar el **historial** de cada pieza.

**Meta inmediata:** una versión de prueba desplegada en el VPS de la persona que se pueda
mostrar ante un jurado, cargada con los datos de demostración de `db/seed.sql`.

## 2. Reglas de trabajo para Claude

1. **Idioma:** toda la interfaz, los mensajes de error, los commits y la documentación van en
   **español de Colombia**. El código (variables, funciones) puede ir en español sin tildes.
2. **Trabaja por fases (§11).** Al terminar cada fase:
   - ejecuta `npm test`;
   - muestra a la persona qué quedó funcionando, con la URL local y los pasos para verlo;
   - haz un commit `fase N: …`;
   - **espera su visto bueno** antes de pasar a la siguiente fase.
3. **Antes de tocar el VPS** (fase 2 y siguientes), pide a la persona: IP o dominio, usuario SSH, cómo entra
   (llave o contraseña) y si el servidor ya aloja otros sitios. **Nunca** sobrescribas una
   configuración de Nginx existente: crea un `server` block nuevo. **Nunca** ejecutes
   `ufw enable` sin confirmar que el puerto 22 (o el puerto SSH real) queda permitido.
4. **Datos:**
   - `RAEE-0001` es un registro **real**; no lo borres ni lo modifiques en pruebas.
   - Los demás registros sembrados son de demostración (`demo = 1`, seriales `D-…`).
   - Las pruebas usan una base temporal, nunca `data/raee.db`.
5. **Secretos:** nada de contraseñas, llaves ni `.env` en el repositorio. Usa `.env.example`.
   `.gitignore` debe incluir `.env`, `data/`, `node_modules/`, `*.db*` y `Desktop.ini`
   (ícono de carpeta de Windows de la persona: no se borra, solo se ignora).
6. **Dependencias mínimas** (lista cerrada en §3). Si necesitas otra, justifícala y pregunta.
   Nada de CDN: todo se sirve desde el propio servidor, para que la demo funcione aunque falle
   el internet externo.
7. **Calidad visible:** es para una exposición. Cada pantalla debe:
   - verse bien en un celular de 360 px y proyectada a 1920 px;
   - tener estados vacíos y mensajes de error claros;
   - no mostrar nunca un error técnico crudo.
8. Si una instrucción de este archivo resulta técnicamente mala, **dilo** y propone la
   alternativa; no la sigas a ciegas.

## 3. Stack (decidido)

| Capa | Elección | Por qué |
|---|---|---|
| Servidor | **Node.js LTS (22+) + Express 4** | Simple, un solo proceso, fácil de explicar al jurado |
| Base de datos | **SQLite** con `better-sqlite3` | Un archivo, cero administración, respaldo con un comando; suficiente para miles de piezas |
| Vistas | **EJS** renderizado en servidor + JS sin framework | Funciona en celulares viejos; sin paso de compilación |
| QR | `qrcode` (genera SVG en el servidor) | Etiquetas nítidas al imprimir |
| Gráficos | `chart.js` servido desde `node_modules` (copiado a `public/vendor`) | Sin CDN |
| Sesiones | `express-session` + `better-sqlite3-session-store` | Sesiones guardadas en la misma base |
| Seguridad | `helmet`, `express-rate-limit`, `bcryptjs`, `csrf-sync` | Básicos obligatorios |
| Fotos | `multer` + `sharp` (redimensionar a 1200 px, WebP) | Fotos livianas en la ficha |
| Excel | `exceljs` | Importar el Excel actual y exportar el inventario |
| Pruebas | `node:test` + `supertest`; `@playwright/test` para el flujo e2e | Sin frameworks extra |
| Producción | **PM2** + **Nginx** (proxy inverso) + **Certbot** (HTTPS) en Ubuntu | Estándar y documentable |

Puerto interno por defecto: **3100** (evita choques con otros servicios del VPS).

## 4. Estructura del proyecto

```
raee-web/
├── CLAUDE.md                 ← este archivo
├── .claude/
│   ├── settings.json         ← permisos de Claude Code
│   └── commands/             ← /verificar, /ensayo-demo, /desplegar
├── db/
│   ├── schema.sql            ← modelo de datos (fuente de verdad)
│   └── seed.sql              ← catálogos + 36 piezas (1 real + 35 demo) + historial
├── src/
│   ├── server.js             ← arranque (lee .env, monta app)
│   ├── app.js                ← Express, middlewares, rutas (exportable para pruebas)
│   ├── db.js                 ← conexión, migración inicial, helpers
│   ├── lib/
│   │   ├── escaneo.js        ← extraerId() — ver §6.2
│   │   ├── ids.js            ← siguienteId(), formato RAEE-NNNN
│   │   ├── qr.js             ← SVG del QR con URL de ficha
│   │   ├── eventos.js        ← canal en vivo (Server-Sent Events) — ver §6.6
│   │   └── validacion.js     ← reglas de negocio §6
│   ├── routes/               ← publicas.js, piezas.js, etiquetas.js, panel.js, auth.js, api.js
│   └── views/                ← EJS: layout, ficha, consulta, buscar, registrar, panel, demo, etiquetas…
├── public/                   ← css/, js/, img/, vendor/ (chart.js)
├── scripts/
│   ├── db-init.js            ← aplica schema.sql (+ seed.sql si --seed)
│   ├── crear-admin.js        ← crea usuario con contraseña pedida por consola
│   ├── importar-excel.js     ← importa la hoja "Inventario" del Excel actual
│   ├── demo-limpiar.js       ← borra filas demo=1 (pide confirmación)
│   └── respaldo.sh           ← copia en caliente de la base (sqlite .backup)
├── deploy/
│   ├── nginx-raee.conf       ← plantilla de server block
│   ├── ecosystem.config.cjs  ← PM2
│   └── DESPLIEGUE.md         ← pasos manuales equivalentes (para el informe)
├── docs/
│   ├── GUION_EXPOSICION.md   ← §13
│   └── PROTOCOLO_PRUEBAS.md  ← §12.3 con casillas para marcar
├── tests/                    ← unit + integración + e2e
├── data/                     ← raee.db, fotos/ (ignorado por git)
├── .env.example
└── package.json
```

### Scripts de `package.json` (deben existir)

```
npm run dev            # servidor con --watch en :3100
npm start              # producción
npm run db:init        # crea data/raee.db desde schema.sql
npm run db:seed        # db:init + seed.sql (falla si ya hay piezas, salvo --force)
npm run admin:crear    # crea usuario admin/editor
npm run excel:importar -- ruta/al/archivo.xlsx
npm run demo:limpiar   # elimina datos demo=1
npm test               # unit + integración
npm run test:e2e       # Playwright (celular 360 px y escritorio)
```

### Variables de entorno (`.env.example`)

```
PORT=3100
BASE_URL=http://localhost:3100    # en el VPS: https://raee.midominio.com  (se usa en los QR)
SESSION_SECRET=cambiar-por-una-cadena-larga-aleatoria
DB_PATH=./data/raee.db
FOTOS_DIR=./data/fotos
MOSTRAR_AVISO_DEMO=true
# TZ=America/Bogota               # solo en el VPS: las fechas 'localtime' de SQLite dependen de esto
```

El `.env` se carga con `process.loadEnvFile()` de Node (sin dependencia `dotenv`).

## 5. Modelo de datos

La fuente de verdad es **`db/schema.sql`**; no dupliques el esquema en el código. Resumen:

| Tabla / vista | Para qué |
|---|---|
| `categorias` | Tipo de pieza, ícono, peso estimado, guía de descripción, `requiere_borrado` (discos) |
| `estados` | Funcional · Por probar · Para repuestos · Dañado |
| `destinos` | Reutilizada en la sala · Banco de repuestos · Donación · Gestor RAEE (reciclaje) · Pendiente |
| `ubicaciones` | Lugares físicos con código (`S1-C1` = Sala 1 · Caja 1). Elimina la escritura libre que generaba "Caja 1 Sala 1" vs "Estante A1" |
| `etiquetas` | IDs ya impresos. Permite etiquetas **preimpresas**: un ID puede existir aquí sin pieza todavía |
| `piezas` | El inventario |
| `movimientos` | Historial: registro, cambios de estado, destino, ubicación y borrado seguro |
| `usuarios`, `config` | Acceso para editar; meta del semestre y nombre de la sala |
| `v_piezas` | Pieza + categoría + peso efectivo (`peso_real` o el estimado) + texto de alertas |
| `v_panel` | Todos los indicadores del panel en una fila |

**Reglas que ya impone la base** (no las debilites; la app debe traducir el error a un mensaje
amable):

- Formato de ID `RAEE-NNNN`.
- Serial único: detecta piezas registradas dos veces.
- "Reutilizada en la sala" exige `equipo_destino` (p. ej. `PC-15`).
- **Borrado seguro:** un disco (`requiere_borrado = 1`) no puede ir a un destino con
  `entrega_a_terceros = 1` (Reutilizada, Donación, Gestor RAEE) si `borrado_seguro <> 'Sí'`.
  El trigger lanza `BORRADO_SEGURO: …`; muéstralo como: *"Este disco puede contener
  información de la institución. Haz el borrado seguro y márcalo antes de darle este destino."*

## 6. Reglas de negocio

### 6.1 Qué lleva el QR

- El QR **NO** lleva los datos de la pieza; lleva un **enlace a la ficha**:
  `{BASE_URL}/p/RAEE-0001`. Así:
  - si cambian la ubicación o el estado, la etiqueta pegada sigue sirviendo;
  - cualquier cámara de celular abre la ficha sin instalar nada.
- Las 48 etiquetas del **lote 1** ya impresas tienen solo el texto `RAEE-0001`
  (`etiquetas.formato = 'ID'`). Deben seguir funcionando con Barcode to PC. En la ficha de esas
  piezas, sugiere reimprimir con formato URL ("Reimprimir etiqueta").

### 6.2 Entrada del escáner — `extraerId(texto)`

Barcode to PC escribe en el campo con foco como si fuera un teclado y termina con ENTER. El texto
puede llegar de cuatro formas, y todas deben resolverse:

| Llega | Resultado |
|---|---|
| `RAEE-0001` | `RAEE-0001` |
| `https://raee.dominio.com/p/RAEE-0001` | `RAEE-0001` |
| ` raee-1 `, `raee 0001`, `RAEE0001` | `RAEE-0001` (normaliza mayúsculas, espacios, guion y ceros) |
| Texto de los QR antiguos con datos (`Tipo: …`) | error `QR_ANTIGUO` → mensaje "Es un QR antiguo con texto: reimprímelo con su ID" |

Regex base: `/RAEE[\s\-_]?0*(\d{1,4})/i`. Cubre esta función con pruebas unitarias de **todos**
los casos de la tabla.

**Orden de evaluación:** primero se detecta el QR antiguo (contiene `Tipo:` u otros rótulos de
datos, o varias líneas) y **después** se aplica la regex. Si se hiciera al revés, un QR antiguo
que incluya el ID en su texto pasaría como válido y nunca saldría el aviso ámbar. Pedir a la
persona un ejemplo real del texto de esos QR para la prueba.

### 6.3 Qué pasa al escanear un ID

| Situación | Público (sin sesión) | Con sesión de editor |
|---|---|---|
| Pieza registrada | Ficha | Ficha + botones de acción rápida |
| ID en `etiquetas` pero sin pieza | "Etiqueta sin registrar" | Abre **Registrar** con el ID ya puesto |
| ID inexistente | "✖ No está en el inventario" (rojo) | Ofrece registrarlo y reservar la etiqueta |

### 6.4 Registro

- **Dos flujos** que deben funcionar:
  - **(a) Etiqueta preimpresa:** se escanea el ID existente.
  - **(b) Pieza nueva:** el sistema asigna el siguiente ID libre, mayor que cualquier ID en
    `piezas` o en `etiquetas`.
- **Obligatorios:** categoría, estado, destino y ubicación.
- **Recomendados:** marca, modelo, serial y descripción. Al elegir la categoría, muestra su
  `guia_descripcion` como ayuda y el peso estimado.
- **Modelo y serial se escriben a mano.** Se probó que los códigos de barras de los fabricantes
  no se leen bien. No construyas un flujo que dependa de escanearlos, aunque el campo puede
  aceptar un escaneo si funciona.
- **Fecha:** automática (hoy), editable.
- **Discos:** el campo **Borrado seguro** aparece y es obligatorio.
- Cada alta y cada cambio escriben en `movimientos` con el usuario.

### 6.5 Panel: definiciones exactas

Usa `v_panel`. Los rótulos deben ser **honestos**: el jurado puede preguntar por ellos.

| Indicador | Definición |
|---|---|
| Piezas registradas | `COUNT(piezas)` |
| **Kg inventariados** | Suma de peso efectivo de todas las piezas. *(Antes decía "kg recuperados", y eso era impreciso)* |
| **Kg con destino final** | Suma de peso de las piezas cuyo destino no es "Pendiente" |
| Reutilizadas en la sala | Destino = Reutilizada en la sala |
| Equipos reparados | Equipos distintos (`equipo_destino`) que recibieron piezas |
| % que no va a la basura | Piezas con destino final que desvía del relleno ÷ total |
| Discos con borrado seguro | `discos_borrados / discos_total` (indicador de seguridad de la información) |
| Pesos medidos | `piezas_pesadas` de N: indica cuántas cifras son medidas y no estimadas |
| Meta del semestre | Barra de avance contra `config.meta_semestre` |

Gráficos: piezas por categoría (barras horizontales), por destino (dona) y por estado (barras).
Además, una línea de "últimos movimientos". Agrega `?tv=1` para la versión de proyector: letra
grande, sin menú y **actualizado en vivo** (§6.6): las cifras suben con animación y cada
movimiento aparece como aviso ("🌱 RAEE-0022 → PC-15"). Si el canal en vivo se cae, la página
vuelve a recargarse cada 30 s como respaldo.

### 6.6 Actualización en vivo (Server-Sent Events)

Es el "momento wow" de la demo: lo que se cambia en el PC proyectado aparece al instante en el
celular del jurado y en el panel.

- `GET /eventos` abre un canal SSE nativo de Express (`text/event-stream`), **sin dependencias
  nuevas**. `src/lib/eventos.js` mantiene la lista de clientes y expone `emitir(tipo, datos)`.
- Cada escritura en `movimientos` emite `movimiento` con `{pieza_id, tipo, valor_nuevo,
  icono, categoria}` (nunca `notas` ni datos de usuarios).
- La ficha `/p/:id`, `/panel` y `/demo` escuchan el canal: la ficha se refresca si el evento es
  de su pieza; el panel vuelve a pedir `v_panel` y anima las cifras.
- Latido cada 25 s (comentario `:`) para que Nginx y los celulares no corten la conexión. En
  Nginx: `proxy_buffering off` y `proxy_read_timeout 1h` para `/eventos`.
- Reconexión automática del `EventSource` del navegador; si no hay soporte, se recarga cada 30 s.

## 7. Pantallas y rutas

| Ruta | Acceso | Descripción |
|---|---|---|
| `/` | público | Portada: qué es el proyecto, 3 cifras del panel y botones Consultar, Buscar y Panel |
| `/p/:id` | público | **Ficha** de la pieza, pensada primero para celular. Ver contenido abajo |
| `/consulta` | público | **Modo kiosco para Barcode to PC.** Un campo grande con foco permanente (si lo pierde, se recupera solo cada 1 s). Al recibir ENTER muestra la ficha en grande, debajo, sin recargar, y limpia el campo. Cada escaneo reemplaza la ficha anterior. Errores en rojo; QR antiguo en ámbar |
| `/buscar` | público | Texto libre (ID, marca, modelo, serial, descripción) + filtros por categoría, estado, destino y ubicación. Resultados con ícono, ubicación y estado. Filtros en la URL (se pueden compartir). Botón "Exportar a Excel" |
| `/ubicaciones` y `/ubicaciones/:codigo` | público | **Mapa visual** de la sala: cada caja o estante es una tarjeta con su conteo e íconos de lo que contiene. Responde "¿dónde está?" al revés. `/ubicaciones?resaltar=RAEE-0010` ilumina la caja donde está esa pieza (se enlaza desde la ficha) |
| `/panel` | público | Panel de impacto (§6.5), en vivo (§6.6) |
| `/demo` | editor | **Escenario del proyector:** en una sola pantalla, el campo de escaneo con acciones rápidas (como `/movimiento`), la ficha de la pieza escaneada y el panel en vivo con el aviso de movimientos. Evita cambiar de ventana frente al jurado. A 1920 px se ve en tres columnas; en pantallas pequeñas se apila |
| `/eventos` | público | Canal SSE (§6.6) |
| `/proyecto` | público | Problema, solución, diagrama del flujo, marco legal (§10.3), equipo de aprendices |
| `/entrar`, `/salir` | — | Inicio de sesión (límite de 5 intentos cada 15 min por IP) |
| `/registrar` | editor | Alta. Su primer campo con foco recibe el escaneo del ID (flujo a) o queda vacío para ID automático (flujo b) |
| `/p/:id/editar` | editor | Editar todo + subir foto |
| `/movimiento` | editor | **Actualización rápida por escaneo:** se escanea y aparecen botones grandes de estado, destino y ubicación. Ideal para la demo en vivo |
| `/etiquetas` | editor | Generar hojas A4 imprimibles (§8): por rango, por IDs nuevos (reservar N) o reimpresión de lote antiguo |
| `/admin` | admin | Usuarios, catálogos (categorías, ubicaciones, meta), exportar o respaldar, limpiar datos demo |
| `/api/piezas/:id` | público | JSON para `/consulta` (sin campo `notas` si no hay sesión) |
| `/api/buscar` | público | JSON de búsqueda |
| `/salud` | público | `{"ok":true,"piezas":N}` para monitorear |

**Contenido de la ficha `/p/:id`:**

- ícono y categoría en grande;
- ID;
- **ubicación destacada** (es lo primero que se busca), con enlace "Ver en el mapa";
- estado y destino como etiquetas de color;
- marca, modelo, serial, descripción y peso (con "medido" o "estimado");
- foto;
- borrado seguro (solo discos);
- historial de movimientos como **línea de tiempo** vertical con íconos (registro, estado,
  destino, ubicación, borrado seguro): es la prueba visual de la trazabilidad;
- mensaje de impacto, según el destino:
  - 🌱 "Volvió a la vida en el equipo PC-15";
  - ♻ "Va a reciclaje certificado: no termina en la basura".
- se actualiza sola si la pieza cambia mientras está abierta (§6.6), con un resaltado breve
  de lo que cambió.

Si la pieza es demo, muestra una etiqueta discreta "dato de demostración".

**Diseño:** mantener la identidad del Excel y de las etiquetas:

- verde petróleo oscuro `#12403c`, verde `#1f7a6b`, menta claro `#e6f4f0`, fondo `#f5f3ee`;
- tipografía del sistema;
- tarjetas con borde suave;
- íconos emoji de las categorías;
- contraste AA;
- modo oscuro opcional;
- aviso superior "Incluye datos de demostración" si `MOSTRAR_AVISO_DEMO=true` y existen filas
  `demo=1`.

## 8. Etiquetas QR

- Hoja **A4, 3 columnas × 8 filas** (24 por hoja), igual al PDF actual, con márgenes que no
  corten la impresión.
- Cada etiqueta lleva:
  - QR SVG a la izquierda (mínimo 22 mm, corrección de errores `M`);
  - a la derecha: "SALA DE SISTEMAS", el **ID en grande**, "Inventario de residuos
    electrónicos" y "No retirar esta etiqueta";
  - franja verde a la izquierda;
  - opcionalmente, el ícono de la categoría si la pieza ya existe.
- Opción "**Etiqueta pequeña**" (2 × 1 cm, solo QR + ID) para RAM y procesadores.
- La página de impresión usa `@media print` (sin menú). Instrucción visible: "Imprimir al 100 %,
  sin ajustar a página".
- Al generar IDs nuevos, se insertan en `etiquetas` con `formato='URL'` y un nombre de lote.
- Verificación: los QR generados deben poder leerse con la cámara del celular a 10–20 cm.

## 9. Barcode to PC: configuración recomendada

- **Output template:** `[Barcode]` → `ENTER`. **Solo eso:** nada de TAB, P/N, serial ni fecha
  (el formulario web se encarga del resto).
- Flujo en el PC: abrir `/consulta`, `/registrar` o `/movimiento` en el navegador, hacer clic en
  el campo verde y escanear.
- Documenta esta configuración, con capturas, en `docs/` (la persona ya tiene una guía con
  capturas para la versión Excel; reutiliza su estructura).

## 10. Seguridad, respaldo y cumplimiento

### 10.1 Seguridad mínima

- Consultar es público y editar exige sesión.
- Contraseñas con bcrypt (costo 12).
- Cookies `httpOnly`, `sameSite=lax` y `secure` en producción.
- Protección CSRF en todos los formularios POST.
- `helmet` con CSP propia (sin `unsafe-inline` en scripts).
- Consultas SQL **siempre parametrizadas**.
- Validar y limitar el tamaño de las fotos (máx. 8 MB, solo imágenes).
- La API pública no expone `notas` ni datos de usuarios.

### 10.2 Respaldo

- `scripts/respaldo.sh` usa `sqlite3 data/raee.db ".backup /var/backups/raee/raee-$(date +%F).db"`
  y conserva 14 días.
- Se programa con cron diario a las 02:00 en el VPS.
- En `/admin` hay un botón "Exportar inventario a Excel" (mismas columnas que la hoja Inventario
  original), que sirve como plan B.

### 10.3 Marco legal (página `/proyecto` y presentación)

- **Ley 1672 de 2013:** política pública de gestión integral de RAEE en Colombia.
- **Decreto 284 de 2018:** reglamenta la gestión integral de RAEE.
- **Resolución 1512 de 2010:** sistemas de recolección selectiva y gestión ambiental de residuos
  de computadores y/o periféricos.

> ⚠ Antes de publicar, **verifica con la persona** que estas normas sigan vigentes y que las
> descripciones sean exactas. No inventes artículos ni cifras.

No pongas cifras de impacto ambiental (CO₂ evitado, metales recuperados) **salvo** que la persona
dé una fuente citable. Si las agrega, muestra la fuente en pantalla.

## 11. Fases de construcción (con criterio de aceptación)

Cada fase termina con: pruebas en verde, demostración a la persona, commit y visto bueno.

El orden prioriza la **ruta crítica de la demo** y despliega **temprano**: los QR llevan
`BASE_URL`, así que el dominio definitivo debe existir antes de imprimir etiquetas, y conviene
probar con celulares reales desde el principio.

| Fase | Entrega | Hecho cuando… |
|---|---|---|
| **0 · Base** | `package.json`, estructura §4, `.env.example`, `.gitignore`, `db:init`, `db:seed`, `/salud` | `npm run db:seed && npm run dev` → `/salud` responde `{"ok":true,"piezas":36}` |
| **1 · Lectura** | `extraerId`, `/p/:id` (ficha mobile-first con línea de tiempo), `/consulta` (kiosco), `/api/piezas/:id`, layout y estilos | Las pruebas de `extraerId` pasan. En `/consulta`, escribir `RAEE-0010` + ENTER muestra la ficha, y `RAEE-0999` muestra el error rojo |
| **2 · Despliegue temprano** | VPS (§14) con HTTPS y dominio definitivo, `deploy/`, comando `/desplegar` probado | `https://dominio/p/RAEE-0001` abre desde un celular con datos móviles |
| **3 · Búsqueda** | `/buscar`, `/ubicaciones` con mapa visual y resaltado | Buscar "DDR3" da las RAM DDR3; filtrar por "Sala 1 · Caja 2" da solo lo de esa caja; desde la ficha, "Ver en el mapa" ilumina la caja |
| **4 · Edición** | Sesiones, `admin:crear`, `/registrar` (flujos a y b), editar, fotos, `/movimiento`, historial | Registrar `RAEE-0037` escaneando (preimpresa) funciona. Intentar donar `RAEE-0014` muestra el aviso de borrado seguro. Se crea un movimiento |
| **5 · Panel en vivo** | `/panel` + `?tv=1`, `/eventos` (SSE), `/demo`, portada con cifras | Las cifras coinciden con `SELECT * FROM v_panel`. Con la ficha abierta en un celular y `/panel?tv=1` en otra pantalla, un cambio en `/demo` aparece en ambas en menos de 2 s sin recargar |
| **6 · Etiquetas** | `/etiquetas`: hoja A4 y etiqueta pequeña, reservar IDs | Imprimir en PDF con el `BASE_URL` definitivo y leer 3 QR con la cámara del celular abre la ficha correcta |
| **7 · Excel** | Exportar (obligatorio, plan B); `excel:importar` solo si el Excel trae piezas reales además de `RAEE-0001` | Exportar abre bien en Excel con las columnas de la hoja Inventario. Si se importa: crea o actualiza `RAEE-0001` sin duplicar |
| **8 · Pulido** | `/proyecto`, aviso demo, accesibilidad, `demo:limpiar`, `docs/` (guion, protocolo, Barcode to PC), `/admin` mínimo (usuarios, meta, exportar, respaldo, limpiar demo). Si sobra tiempo: modo oscuro, edición de catálogos, acta de entrega imprimible para donación o gestor RAEE | `npm run test:e2e` (recorrido de la demo) pasa en 360 px y 1920 px. Lighthouse móvil en la ficha ≥ 90 en accesibilidad. `/ensayo-demo` sale todo en ✔ |

Cada fase posterior a la 2 termina también con `/desplegar`, para que el VPS tenga siempre la
última versión aprobada.

## 12. Pruebas

### 12.1 Unitarias

- `extraerId` (todos los casos de §6.2);
- `siguienteId`;
- traducción de errores SQLite (`UNIQUE serial`, `BORRADO_SEGURO`, `CHECK equipo_destino`) a
  mensajes en español.

### 12.2 Integración (supertest, base temporal sembrada)

- rutas públicas: 200 y 404;
- editar sin sesión: redirige a `/entrar`;
- POST sin token CSRF: 403;
- las cifras del panel coinciden con `v_panel`;
- la API no expone `notas`;
- un movimiento emite el evento SSE correspondiente, sin `notas`.

### 12.3 Protocolo manual con escáner real (`docs/PROTOCOLO_PRUEBAS.md`)

Equivale a la hoja "Flujo y prueba" del Excel. Cada paso tiene casillas ✔/✘ y observaciones:

1. Barcode to PC configurado con `[Barcode] → ENTER`.
2. Un QR del PDF antiguo se lee en `/consulta`.
3. Un QR nuevo (URL) leído con la **cámara del celular** abre `/p/:id`.
4. El mismo QR nuevo leído con Barcode to PC en `/consulta` muestra la ficha.
5. Escanear 3 piezas seguidas sin tocar el mouse reemplaza la ficha cada vez.
6. Registrar con etiqueta preimpresa.
7. Registrar con ID automático e imprimir su etiqueta.
8. Serial repetido: se rechaza con mensaje claro.
9. Cambiar estado en `/movimiento`: se ve en la ficha y en el historial.
10. Reutilizar en `PC-xx`: la ficha muestra 🌱 y el panel suma.
11. Disco sin borrado → donación: se bloquea con el aviso. Marcar borrado → se permite.
12. ID inexistente: error rojo.
13. QR antiguo con texto: aviso ámbar.
14. Buscar por componente y por ubicación.
15. Exportar a Excel.
16. Probar 5 etiquetas de fabricante y anotar resultado. *(Ya se sabe que no se leyeron: queda
    documentado como hallazgo.)*
17. Ver todo en un celular con datos móviles (fuera de la red local).

## 13. Exposición: lo que la aplicación debe permitir

Escribe `docs/GUION_EXPOSICION.md` con este guion (unos 8 min) y asegúrate de que cada paso sea
posible:

1. **Problema** (1 min): fotos de las cajas desordenadas, "nadie sabe qué hay ni dónde".
2. **Solución** (1 min): diagrama de etiqueta → escaneo → base de datos → ficha, búsqueda y panel
   (`/proyecto`).
3. **Demo en vivo** (3 min), los tres momentos:
   - **"Escanéala tú mismo":** un jurado elige una pieza física y la escanea **con su propio
     celular**: se abre la ficha con su ubicación y su línea de tiempo;
   - **"Lo que hago aquí aparece en tu mano":** con la ficha aún abierta en el celular del
     jurado, en el PC proyectado (`/demo`) se escanea la misma pieza y se cambia a
     "Reutilizada en la sala · PC-xx". Al instante el celular muestra 🌱 y el panel del
     proyector sube la cifra con el aviso del movimiento;
   - **"El sistema protege la información":** ver punto 5.
4. **Búsqueda** (30 s): "¿Tenemos RAM DDR3 funcional?" se responde con `/buscar`.
5. **Seguridad de la información** (1 min): un disco no sale sin borrado seguro; se muestra el
   bloqueo.
6. **Impacto y marco legal** (1 min): panel con cifras honestas (inventariado vs. destino final,
   medido vs. estimado) y normas.
7. **Pruebas y hallazgos** (30 s): protocolo con escáner real, incluido que los códigos del
   fabricante no se leyeron y la decisión que se tomó.
8. **Siguientes pasos:** convenio con un gestor RAEE certificado, más salas, reportes por
   semestre.

**Plan B obligatorio:**

- la app corre también en el portátil (`npm start`) con la misma base;
- video de 60 s de la demo;
- Excel exportado.

**Checklist del día anterior** (comando `/ensayo-demo`):

- datos demo coherentes (o reales cargados);
- etiquetas de las piezas de la demo impresas y pegadas;
- HTTPS válido;
- celular con Barcode to PC conectado a la misma red que el PC. **Llevar router o hotspot
  propio**: no depender del wifi del lugar. Los celulares del jurado entran por datos móviles.

## 14. Despliegue en el VPS (fase 2, y actualizaciones al cerrar cada fase)

Supuesto: **Ubuntu 22.04/24.04**. Confirma el sistema con `lsb_release -a` y pide los datos de la
regla 2.3 antes de empezar. Pasos (documentarlos también en `deploy/DESPLIEGUE.md`):

1. Usuario sin privilegios `raee` y carpeta `/opt/raee-web`. Node LTS (NodeSource o `nvm`),
   `pm2` global, `sqlite3` (CLI, para respaldos), `nginx` y `certbot`.
2. Subir el código: `git clone` si hay repositorio o `rsync -avz --exclude node_modules
   --exclude data ./ usuario@vps:/opt/raee-web/`.
3. Instalar y preparar:
   - `npm ci --omit=dev`;
   - crear `.env` en el servidor, con `BASE_URL` = dominio o IP pública, `SESSION_SECRET`
     generado con `openssl rand -hex 32` y `TZ=America/Bogota`;
   - `npm run db:seed`;
   - `npm run admin:crear` cuando exista (fase 4) (la persona escribe la contraseña; Claude no
     la ve ni la guarda).
4. Arrancar con PM2: `pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup`.
5. Nginx:
   - copiar `deploy/nginx-raee.conf` a `sites-available` con el dominio correcto (proxy a
     `127.0.0.1:3100`, `client_max_body_size 10m`, y para `/eventos`: `proxy_buffering off`,
     `proxy_read_timeout 1h`);
   - enlazarlo y ejecutar `nginx -t` **antes** de `systemctl reload nginx`.
6. HTTPS: `certbot --nginx -d dominio`. **Sin dominio:** desplegar por `http://IP` solo como
   prueba, y advertir que la cámara del celular abrirá el enlace igual, pero sin candado.
   Recomendar un subdominio.
7. Firewall: `ufw allow OpenSSH && ufw allow 'Nginx Full'` y luego `ufw enable` (con
   confirmación).
8. Cron de respaldo (§10.2).
9. Verificar:
   - `curl -s https://dominio/salud`;
   - abrir `/p/RAEE-0001` desde un celular con datos móviles;
   - imprimir 3 etiquetas con el `BASE_URL` final y probarlas.

> **Importante:** los QR llevan `BASE_URL`. Si cambia el dominio, las etiquetas con formato URL
> impresas antes dejan de apuntar bien. Define el dominio definitivo **antes** de imprimir el
> lote real.

Actualizaciones posteriores: `/desplegar` (comando) hace respaldo, rsync, `npm ci`,
`pm2 reload raee` y verifica `/salud`.

## 15. Pendientes que dependen de la persona (no inventar)

- [ ] Fecha de la exposición (define qué entra de la fase 8).
- [ ] Datos del VPS: IP o dominio, usuario SSH, si hay otros sitios en Nginx.
- [ ] Excel original `Inventario_RAEE_Sala_Sistemas.xlsx` (columnas de la exportación e
      importación).
- [ ] Ejemplo real del texto de un QR antiguo (prueba de `QR_ANTIGUO`, §6.2).
- [ ] Dominio o subdominio definitivo para los QR.
- [ ] Nombres de los aprendices del equipo y del instructor para `/proyecto`.
- [ ] Fotos reales de "antes" para la portada y la exposición.
- [ ] Confirmar la vigencia del marco legal (§10.3).
- [ ] Gestor RAEE certificado con el que se entregaría (si existe).
- [ ] Cargar las piezas reales y ejecutar `npm run demo:limpiar` antes del uso real.
