# Guía de usuario · Inventario RAEE de la Sala de Sistemas

> Guía paso a paso, escrita a medida que se prueba el sitio con la persona responsable.
> *Borrador en construcción: se completa en cada prueba.*

**Dirección del sitio:** https://raee.smarteksoft.com

---

## 1. Qué es el sitio

Cada pieza de computador en desuso de la sala lleva una etiqueta con un código QR
(`RAEE-0001`, `RAEE-0002`…). Al escanearla se sabe qué pieza es, dónde está guardada y qué pasó
con ella. Cada registro y cada cambio quedan en un historial con el nombre de quien los hizo, y
todo suma en un panel de impacto.

## 2. Quién puede hacer qué

| Puede… | Cualquier persona | Registrador | Administrador |
|---|---|---|---|
| Ver fichas, buscar, mapa y panel | ✔ | ✔ | ✔ |
| Registrar piezas nuevas | | ✔ | ✔ |
| Mover piezas (estado, destino, lugar) | | ✔ | ✔ |
| Imprimir etiquetas | | ✔ | ✔ |
| Editar todos los datos de una pieza | | | ✔ |
| Eliminar piezas (con motivo) | | | ✔ |
| Crear, desactivar y reactivar usuarios | | | ✔ |

Todos entran con **usuario y contraseña**.

---

## 3. La página de inicio

1. Abre **https://raee.smarteksoft.com**.
2. Verás:
   - el título *"Cada pieza con nombre, lugar y destino"*;
   - cuatro botones: **Consultar por escaneo**, **Buscar piezas**, **Mapa de la sala** y **Panel de impacto**;
   - tres cifras: **Piezas registradas**, **Kg inventariados** y **Reutilizadas en la sala**. Suben solas cuando alguien registra o cambia una pieza;
   - el cuadro **"Ver la ficha de una pieza"**, para escribir un código como `RAEE-0001`.

> Al empezar, el inventario está vacío y las cifras están en **0**.

## 4. Primer paso: crear el administrador (configuración inicial)

Cuando el sitio no tiene ningún usuario (recién instalado o después de reiniciarlo), el primer
paso es crear el **administrador**. Se hace desde la página, sin entrar al servidor.

1. En la página de inicio, toca **Entrar**, arriba a la derecha.
2. Como no hay usuarios, aparece **"Configuración inicial · Crea el administrador"**.
3. Llena el formulario:

   | Campo | Qué escribir |
   |---|---|
   | Nombre completo | el nombre de la persona |
   | Documento de identidad | el número, sin puntos |
   | Usuario para entrar | por ejemplo `admin` (da igual si es en mayúsculas o minúsculas) |
   | Contraseña y repetirla | mínimo 8 caracteres |

4. Toca **Crear administrador y entrar**.
5. Quedas dentro como administrador, en la página **⚙️ Admin**, con el mensaje *"Listo, [nombre]: eres el administrador…"*.
6. Desde ese momento la configuración inicial **se desactiva**: nadie más puede usarla.

> El documento de identidad es un dato personal: solo lo ve el administrador en ⚙️ Admin. En el
> historial de las piezas aparece el nombre, nunca el documento.

### Volver a empezar: reiniciar el sitio

Para mostrar de nuevo el primer paso en una demostración:

1. Entra como administrador → **⚙️ Admin** → sección **🔄 Reiniciar el sitio**, al final de la página.
2. Si quieres empezar también con el inventario vacío, marca **"También vaciar el inventario"**.
   Las etiquetas impresas se conservan.
3. Escribe `REINICIAR` y toca **Reiniciar el sitio**.
4. Se borran todos los usuarios (también el tuyo) y aparece otra vez **"Crea el administrador"**.

> Antes de borrar, el sitio guarda una copia automática de la base en el servidor, por si fue un error.

### Plan B: crear un administrador desde el servidor

Solo si se pierde la contraseña del único administrador. Lo hace la persona responsable del
servidor, desde una terminal:

```
ssh deploy@169.58.221.224
docker exec -it raee-app-1 npm run admin:crear
```

> ⚠️ **Error común:** si la línea ya empieza con `deploy@vmi3527475`, ya estás dentro del servidor:
> no vuelvas a escribir `ssh …`. Si pregunta *"Are you sure you want to continue connecting?"*,
> escribe `no` y luego solo el comando `docker exec …`. Los mensajes `npm notice` se pueden ignorar.

## 5. Entrar al sitio

1. En la página de inicio, toca **Entrar**, arriba a la derecha.
2. Escribe tu **usuario** y tu **contraseña**, y toca **Entrar**.
3. Verás arriba en verde *"✔ Hola, [tu nombre]. Ya puedes registrar y actualizar piezas."*
4. En el menú aparecen las opciones de tu rol:
   - **Registrador:** ＋ Registrar · ⚡ Movimiento · 🎬 Demo · 🏷️ Etiquetas
   - **Administrador:** lo mismo, más ⚙️ Admin
5. Para terminar, toca **Salir**.

> Si escribes mal la contraseña 5 veces, el sitio bloquea los intentos durante 15 minutos.
>
> El sitio no sugiere usuarios anteriores. Si el navegador ofrece **guardar la contraseña**, toca
> **Nunca** en los computadores de la sala: los usa más de una persona.

## 6. Crear usuarios registradores (solo administrador)

1. Entra como administrador → **⚙️ Admin** → sección **👤 Usuarios** → **Nuevo usuario**.
2. Llena el formulario:

   | Campo | Qué escribir | Ejemplo |
   |---|---|---|
   | Nombre completo | el nombre del aprendiz (es el que queda en el historial) | `Juan Perez` |
   | Documento de identidad | el número, sin puntos (no se puede repetir) | `6464646` |
   | Usuario para entrar | corto y fácil de recordar | `juanpe` |
   | Rol | **Registrador** (ya viene elegido) o **Administrador** | Registrador |
   | Contraseña y repetirla | mínimo 8 caracteres | la que elija |

3. Toca **Crear usuario**.
4. Verás *"✔ Usuario «juanpe» creado. Ya puede entrar."*
5. La tabla de usuarios queda así (el documento se ve solo en esta página):

   | Nombre completo | Documento | Usuario | Rol | Estado | |
   |---|---|---|---|---|---|
   | Maria Barrios | 23456543 | `admin` | **Administrador** | Activo | tú |
   | Juan Perez | 6464646 | `juanpe` | Registrador | Activo | Desactivar |

   *(Nombres y documentos ficticios, usados en las pruebas.)*

> Los usuarios no se borran: se **desactivan**. Así su nombre sigue en el historial de las piezas
> que tocó. Un usuario desactivado no puede entrar; con **Activar** vuelve a tener acceso.

## 7. Etiquetas QR

Las etiquetas se generan **antes** de registrar las piezas: se imprimen, se pegan y luego, al
escanearlas, se registra cada pieza. Las genera cualquier registrador o el administrador.

### Generar etiquetas nuevas

1. Entra con tu usuario → **🏷️ Etiquetas** → tarjeta **① Etiquetas nuevas**.
2. Llena:
   - **Cuántas:** por ejemplo `5`. El campo viene vacío a propósito, para no generar etiquetas por accidente. 24 llenan una hoja.
   - **Nombre del lote:** por ejemplo `Prueba 1`. Si lo dejas vacío, se llama *"Lote del [fecha]"*.
   - **Tamaño:** *Normal* (6,4 × 3,4 cm) o *Pequeña* (2 × 1 cm, para RAM y procesadores).
   - **Papel:** *Carta* (viene elegido) o *A4*.
3. Toca **Reservar y ver la hoja**.
4. Verás *"Se reservaron 5 IDs nuevos (RAEE-0049 a RAEE-0053) en el lote «Prueba 1»"* y la hoja
   lista para imprimir. Cada etiqueta lleva el QR, "SALA DE SISTEMAS", el código en grande y
   "No retirar esta etiqueta".

> Los números siguen después del más alto que ya exista: nunca se repite un código.
> Al leer uno de estos QR con la cámara del celular se abre la ficha; si aún no hay pieza,
> dice **"Etiqueta sin registrar"**.

### Imprimir

1. En la hoja toca **🖨️ Imprimir**.
2. En la impresora elige el **mismo papel** (carta o A4), escala **100 %** («Predeterminada») y
   márgenes **Ninguno**. No uses "Ajustar a página": el QR saldría más pequeño.
3. Prueba un QR con la cámara del celular a 10–20 cm antes de pegarlas.
4. Cuando las hayas pegado, toca **✔ Ya las imprimí y pegué**. Es opcional: solo anota la fecha
   de impresión. Las etiquetas sirven igual aunque no lo marques.

> Para volver a abrir la hoja de un lote, toca **Imprimir** en su fila de la tabla
> **Lotes de etiquetas**. Para imprimir solo una parte, usa **② Por rango** o **③ IDs sueltos**:
> esas opciones no crean lotes ni gastan números.

### Eliminar un lote (solo administrador)

Sirve para corregir un lote generado por error o con la cantidad equivocada.

1. En **Lotes de etiquetas**, toca **Eliminar** (en rojo) en la fila del lote.
2. La página de confirmación muestra los códigos y cuántas etiquetas se borran. Toca
   **Eliminar N etiquetas**.
3. Verás *"Se eliminaron N etiquetas del lote «…»"* y el lote sale de la tabla. Si era el último,
   sus números quedan libres para el próximo lote.

> Las etiquetas de piezas ya registradas **nunca se borran**: están pegadas en la pieza.
> Para cambiar la cantidad de un lote, elimínalo y resérvalo otra vez con la cantidad correcta.

### Borrar todas las etiquetas (solo administrador)

Para empezar de cero, sobre todo después de las pruebas.

1. En **🏷️ Etiquetas**, baja hasta el recuadro rojo **🗑️ Borrar todas las etiquetas**.
2. Escribe `BORRAR ETIQUETAS` y toca **Borrar las etiquetas**. Sin la frase no se borra nada.
3. Verás *"Se eliminaron N etiquetas."*, la tabla dice *"Todavía no hay etiquetas"* y el
   próximo lote empieza en **RAEE-0001**.

> ⚠️ Si quedan etiquetas impresas en papel, sepáralas o destrúyelas: las nuevas repetirán sus números.
> Las etiquetas de piezas registradas se conservan siempre.

---

*(Los siguientes capítulos se agregan a medida que avanzan las pruebas.)*
