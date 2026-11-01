# Recorrido de punta a punta · versión de escritorio

Guía para probar el flujo completo del inventario con ejemplos reales de la base de demostración.
Cada escenario dice qué hacer y qué debe pasar. Marca ✔ o ✘ en cada uno.

**Dónde:** en el PC, en `http://localhost:3100` (`npm run dev`) o en `https://raee.smarteksoft.com`.
**Escáner:** si no tienes Barcode to PC a mano, escribe el código y presiona ENTER; es lo mismo
que hace el escáner.

## 0 · Preparación (una sola vez)

Crea tu usuario de editor. La contraseña la escribes tú y no se muestra en pantalla.

| Dónde | Comando |
|---|---|
| En el PC | `npm run admin:crear` |
| En el VPS | `ssh deploy@169.58.221.224` y luego `docker exec -it raee-app-1 npm run admin:crear` |

Si quieres empezar con los datos de demostración limpios en el PC: `npm run db:seed -- --force`.

---

## Parte A · Lo que ve cualquier persona (sin entrar)

| # | Escenario | Haz esto | Debe pasar | ✔/✘ |
|---|---|---|---|---|
| A1 | **¿Qué es esta pieza?** | Abre `/consulta`, escribe `RAEE-0010` + ENTER | Ficha grande del disco Seagate: 📍 Sala 1 · Estante A1, 🌱 "Volvió a la vida en el equipo PC-11" | |
| A2 | Escanear seguido | Sin tocar el mouse: `RAEE-0005` ENTER, `RAEE-0027` ENTER, `raee 14` ENTER | La ficha se reemplaza cada vez; a la derecha, la lista de escaneos recientes | |
| A3 | Etiqueta que no existe | `RAEE-0999` + ENTER | Aviso **rojo** "No está en el inventario" | |
| A4 | QR antiguo con texto | `Tipo: Tarjeta madre` + ENTER | Aviso **ámbar** "QR antiguo: reimprímelo con su ID" | |
| A5 | **¿Tenemos RAM DDR3 funcional?** | `/buscar` → ejemplo "RAM DDR3 funcional" | 4 RAM DDR3 en estado Funcional, con su lugar | |
| A6 | ¿Qué hay en una caja? | `/buscar` → filtro Ubicación "Sala 1 · Caja 2" | Solo las piezas de esa caja | |
| A7 | **¿Dónde está?** | Ficha `RAEE-0014` → "Ver en el mapa →" | Mapa con la **Caja 2 iluminada** y "Aquí está RAEE-0014" | |
| A8 | Editar sin permiso | Abre `/registrar` | Te lleva a "Entrar para editar" | |

## Parte B · El trabajo del editor (después de entrar)

Entra con "Entrar" (arriba a la derecha). Deben aparecer **＋ Registrar**, **⚡ Movimiento** y tu nombre.

### B1 · Llega una pieza con etiqueta ya impresa (flujo a)

1. Abre **＋ Registrar**. El cursor ya está en el campo verde.
2. Escanea (o escribe) `raee-37` + ENTER.
   - El campo se corrige solo a **RAEE-0037** y dice "✔ etiqueta impresa, lista para registrar".
   - El cursor pasa a **Categoría**: el ENTER del escáner no envía el formulario a medias.
3. Elige **Memoria RAM**: aparece la guía "Anota: Tipo (DDR2/3/4), capacidad GB…" y el peso estimado.
4. Estado *Funcional* · Ubicación *Sala 1 · Estante A1* · Destino *Banco de repuestos*.
   Marca *Kingston*, descripción *DDR3 4 GB*.
5. **Registrar pieza**.

**Debe pasar:**
- se abre la ficha con "✔ Pieza RAEE-0037 registrada";
- aparecen los botones **⚡ Movimiento rápido** y **✏️ Editar todo**;
- sale el aviso de que su etiqueta es del lote antiguo y conviene reimprimirla;
- el historial muestra "Registro" con tu usuario.

### B2 · Llega una pieza sin etiqueta (flujo b)

1. **＋ Registrar** y deja el campo de la etiqueta **vacío**. Arriba dice "se asignará RAEE-0049".
2. Fuente de poder · Funcional · Sala 1 · Estante A2 · Banco de repuestos · peso medido `1,45`.
3. **Registrar pieza**.

**Debe pasar:** "Pieza registrada con el ID **RAEE-0049**. Imprime su etiqueta y pégala en la
pieza". El peso aparece como *medido*.

### B3 · El sistema protege la información (momento 3 de la demo)

1. **⚡ Movimiento** → escanea `RAEE-0014` (disco WD de 160 GB, borrado pendiente).
2. En *Destino* el botón **🔒 Donación** sale punteado. Tócalo.
   - **Debe pasar:** aviso ámbar *"Este disco puede contener información de la institución. Haz
     el borrado seguro y márcalo antes de darle este destino."* No cambia nada.
3. En *🔒 Borrado seguro* toca **Hecho**. Luego toca **Donación** otra vez.
   - **Debe pasar:** "✔ Destino → Donación. 🤝 Se donará…". A la derecha quedan los dos cambios.
4. "Ver ficha": el historial muestra 🔒 *Borrado seguro* y 🎯 *Nuevo destino*, con tu usuario.

### B4 · "Lo que hago aquí aparece en tu mano" (momento 2 de la demo)

1. En otra ventana (o en tu celular) abre la ficha `/p/RAEE-0022` (tarjeta madre, Pendiente).
2. En **⚡ Movimiento** escanea `RAEE-0022` → toca **🌱 Reutilizada en la sala**.
3. El cursor salta al campo *Equipo*: escribe `pc-15` + ENTER.

**Debe pasar:**
- en Movimiento sale "✔ Destino → Reutilizada en la sala · PC-15. 🌱 Volvió a la vida en el equipo PC-15";
- al **recargar** la otra ventana, la ficha muestra 🌱 y el historial "Pendiente → Reutilizada en la sala → PC-15".

> En la **fase 5** la otra ventana se actualizará **sola, sin recargar**, y el panel subirá la cifra.

### B5 · Cambiar estado y ubicación sin formularios

En **⚡ Movimiento**, escanea `RAEE-0007` → toca **Funcional** → toca **Sala 1 · Estante A1**.
**Debe pasar:** dos avisos ✔ seguidos y, en la ficha, "Por probar → Funcional" y "Sala 1 · Caja 2 → Sala 1 · Estante A1".

### B6 · Corregir datos y subir una foto

1. Ficha `RAEE-0030` → **✏️ Editar todo**.
2. Cambia la marca, elige una foto del PC (JPG o PNG) y guarda.

**Debe pasar:** "✔ Cambios de RAEE-0030 guardados", la foto aparece en la ficha y el historial dice
"Edición de datos · Actualizó marca, foto".

### B7 · Errores que el sistema atrapa

| # | Haz esto | Debe pasar |
|---|---|---|
| B7.1 | Registrar con etiqueta `RAEE-0010` | "✖ RAEE-0010 ya está registrada" con enlace a su ficha (aparece al escanear) |
| B7.2 | Registrar una pieza con serial `UYRL81507803` | "Ese serial ya está registrado en RAEE-0001. Puede ser la misma pieza registrada dos veces." |
| B7.3 | Registrar un disco sin marcar el borrado seguro | "Indica si ya se hizo el borrado seguro del disco." |
| B7.4 | Registrar con destino "Reutilizada" sin equipo | "Escribe el equipo donde se instaló (por ejemplo, PC-15)." |
| B7.5 | Enviar el formulario vacío | Los cuatro obligatorios en rojo y el cursor en el primero |

### B8 · Salir

**Salir** (arriba a la derecha). Abre `/p/RAEE-0022`: la ficha sigue igual, pero sin los botones de
edición, sin notas internas y sin los nombres de usuario en el historial.

---

## Lo que cubren las pruebas automáticas

`npm test` repite estos escenarios en una base temporal (86 pruebas): acceso y CSRF, límite de
intentos, flujos a y b, serial repetido, borrado seguro (por formulario y por movimiento rápido),
reutilizar con equipo, fotos (WebP de 1200 px, archivos falsos rechazados) y que `RAEE-0001` no se
toca.
