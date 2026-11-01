# Guía de prueba · 15 minutos

Con esta guía revisas que todo el sitio funciona antes de aprobarlo. No necesitas saber
programar: abres una página, haces lo que dice la columna **Haz esto** y miras si pasa lo de
**Debe pasar**. Si algo no pasa, anota el número del paso y me lo dices.

**Dónde:** en el PC, con el navegador, en **https://raee.smarteksoft.com**.
**Escáner:** si no tienes Barcode to PC a mano, escribe el código y presiona ENTER. Es lo mismo.

---

## Paso 0 · Crea tu usuario (una sola vez, 2 minutos)

En la terminal de tu PC:

```
ssh deploy@169.58.221.224
docker exec -it raee-app-1 npm run admin:crear
```

Te va a preguntar:

| Pregunta | Qué escribir |
|---|---|
| Usuario | por ejemplo `instructor` |
| Nombre para mostrar | tu nombre |
| Rol | `admin` |
| Contraseña (dos veces) | la que quieras, mínimo 8 caracteres. No se ve mientras la escribes: es normal |

Debe decir `✔ Usuario "instructor" creado`. Escribe `exit` para salir.
Después puedes crear a los aprendices desde la página **⚙️ Admin**, sin la terminal.

---

## Parte 1 · Lo que ve el público (sin entrar)

| # | Haz esto | Debe pasar | ✔/✘ |
|---|---|---|---|
| 1 | Abre la página de inicio | Ves tres cifras (piezas, kilos, reutilizadas) y botones para Consultar, Buscar, Mapa y Panel | |
| 2 | **Consultar** → escribe `RAEE-0010` y ENTER | Aparece la ficha grande del disco Seagate, con su lugar: Sala 1 · Estante A1 | |
| 3 | En el mismo campo, escribe `RAEE-0999` y ENTER | Aviso **rojo**: "No está en el inventario" | |
| 4 | **Buscar** → toca el ejemplo "RAM DDR3 funcional" | Solo salen memorias DDR3 en estado Funcional | |
| 5 | En esa búsqueda, toca **⬇ Exportar a Excel** | Se descarga un Excel que abre bien, con esas mismas piezas | |
| 6 | Abre la ficha `RAEE-0014` → **Ver en el mapa →** | El mapa ilumina la Caja 2 y dice "Aquí está RAEE-0014" | |
| 7 | **Panel** | Ocho cifras, la barra de la meta, tres gráficos y "● En vivo" en verde | |
| 8 | Pie de página → **Sobre el proyecto** | Problema, solución, seguridad y marco legal | |

## Parte 2 · El trabajo del editor

Toca **Entrar** (arriba a la derecha) con tu usuario. Deben aparecer **＋ Registrar**,
**⚡ Movimiento**, **🎬 Demo**, **🏷️ Etiquetas** y **⚙️ Admin**.

| # | Haz esto | Debe pasar | ✔/✘ |
|---|---|---|---|
| 9 | **＋ Registrar** → escribe `raee-37` y ENTER | El campo se corrige a **RAEE-0037**, dice "etiqueta impresa" y el cursor pasa a Categoría | |
| 10 | Elige *Memoria RAM*, *Funcional*, *Sala 1 · Estante A1*, *Banco de repuestos* → **Registrar pieza** | Se abre la ficha con "✔ Pieza RAEE-0037 registrada" y en el historial sale "Registro" | |
| 11 | **⚡ Movimiento** → `RAEE-0014` y ENTER → toca **🔒 Donación** | Aviso ámbar: el disco necesita borrado seguro. **No cambia nada** | |
| 12 | Ahí mismo toca **Hecho** (en Borrado seguro) y luego **Donación** | Ahora sí: "✔ Destino → Donación" | |
| 13 | **🏷️ Etiquetas** → ② Por rango, de 1 a 24 → **Ver la hoja** | Hoja A4 con 24 etiquetas: QR, franja verde, ID grande y "No retirar esta etiqueta" | |
| 14 | Con el celular, apunta la **cámara** a uno de esos QR en la pantalla | El celular abre la ficha de esa pieza | |

## Parte 3 · El momento wow (lo que verá el jurado)

Necesitas el PC y tu celular.

| # | Haz esto | Debe pasar | ✔/✘ |
|---|---|---|---|
| 15 | En el **celular**, abre `https://raee.smarteksoft.com/p/RAEE-0022` y déjalo abierto | Ficha de la tarjeta madre, destino *Pendiente* | |
| 16 | En el **PC**, abre **🎬 Demo** | Tres zonas: ① Escanea y cambia, ② Lo que ve quien escanea, ③ Panel en vivo | |
| 17 | En Demo escribe `RAEE-0022` y ENTER → toca **🌱 Reutilizada en la sala** → escribe `pc-15` y ENTER | En el PC: "🌱 Volvió a la vida en el equipo PC-15", la cifra de reutilizadas **sube** y sale el aviso "🌱 RAEE-0022 → PC-15" | |
| 18 | Mira el **celular**, sin tocarlo | En 1 o 2 segundos la ficha cambia sola a 🌱 PC-15, con un resaltado amarillo y "Esta ficha se acaba de actualizar" | |
| 19 | Opcional: en otra pantalla abre `https://raee.smarteksoft.com/panel?tv=1` y repite el paso 17 con `RAEE-0007` | El panel grande (sin menú) sube la cifra y muestra el aviso | |

---

## ¿Y cómo vuelvo a dejar los datos como estaban?

Las pruebas cambian los datos de demostración, y eso está bien. Antes de la exposición, en el VPS:

```
ssh deploy@169.58.221.224
docker exec raee-app-1 npm run db:seed -- --force
docker restart raee-app-1
```

Eso guarda una copia de la base anterior y vuelve a cargar los 36 registros de ejemplo. **Ojo:** también borra lo que hayas registrado
a mano y los usuarios, así que después repite el Paso 0.

Cuando empiecen a cargar las **piezas reales**, borra los datos de demostración desde
**⚙️ Admin → Datos de demostración** (RAEE-0001, que es real, no se toca).
