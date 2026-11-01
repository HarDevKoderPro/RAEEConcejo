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

## 4. Crear el primer administrador (una sola vez, en el servidor)

Esto lo hace la persona responsable del servidor, solo para el primer usuario. Los demás usuarios
se crean desde la página **⚙️ Admin** (ver más adelante).

1. Abre una terminal y entra al servidor:
   ```
   ssh deploy@169.58.221.224
   ```
   Sabrás que estás dentro cuando el inicio de la línea diga `deploy@vmi3527475`.
2. Escribe este comando y presiona ENTER:
   ```
   docker exec -it raee-app-1 npm run admin:crear
   ```
3. Responde las preguntas:

   | Pregunta | Qué escribir |
   |---|---|
   | Nombre completo | el nombre de la persona |
   | Documento de identidad | el número, sin puntos |
   | Usuario para entrar | por ejemplo `Admin` (da igual si es en mayúsculas o minúsculas) |
   | Rol | ENTER (queda como administrador) |
   | Contraseña y repetirla | mínimo 8 caracteres. No se ve mientras la escribes: es normal |

4. Debe salir: `✔ Usuario "admin" creado como administrador.`
   Los mensajes `npm notice` que salen después se pueden ignorar.
5. Escribe `exit` para salir del servidor.

> ⚠️ **Error común:** si ya estás dentro del servidor (`deploy@vmi3527475`), no vuelvas a escribir
> `ssh …`. Si te pregunta *"Are you sure you want to continue connecting?"*, escribe `no` y ENTER,
> y luego solo el comando del paso 2.

## 5. Entrar al sitio

1. En la página de inicio, toca **Entrar**, arriba a la derecha.
2. Escribe tu **usuario** y tu **contraseña**, y toca **Entrar**.
3. Verás arriba en verde *"✔ Hola, [tu nombre]. Ya puedes registrar y actualizar piezas."*
4. En el menú aparecen las opciones de tu rol:
   - **Registrador:** ＋ Registrar · ⚡ Movimiento · 🎬 Demo · 🏷️ Etiquetas
   - **Administrador:** lo mismo, más ⚙️ Admin
5. Para terminar, toca **Salir**.

> Si escribes mal la contraseña 5 veces, el sitio bloquea los intentos durante 15 minutos.

---

*(Los siguientes capítulos se agregan a medida que avanzan las pruebas.)*
