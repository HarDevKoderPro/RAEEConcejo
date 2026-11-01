# Barcode to PC · configuración para el inventario web

El celular funciona como lector: escribe el código en el campo que tenga el foco en el PC, como si
fuera un teclado, y termina con ENTER.

## Configuración (una sola vez)

1. Instala **Barcode to PC** en el celular y el servidor en el PC (misma red wifi o el hotspot propio).
2. En la app del celular: **Settings → Output template**.
3. Deja la plantilla **solo** así:

   ```
   [Barcode]  →  ENTER
   ```

   Nada de TAB, P/N, serial ni fecha: el formulario web se encarga del resto.

> 📷 Agrega aquí las capturas de la guía de la versión Excel (misma estructura).

## Uso

| Quiero… | Abro en el PC | Hago clic en el campo verde y escaneo |
|---|---|---|
| Ver qué es una pieza | `/consulta` | La ficha aparece abajo; cada escaneo la reemplaza |
| Registrar una pieza | `/registrar` | El ID se corrige solo y el cursor pasa a Categoría |
| Cambiar estado, destino o lugar | `/movimiento` | Aparecen botones grandes |
| Hacer la demo frente al jurado | `/demo` | Escaneo, ficha y panel en una sola pantalla |

## Problemas comunes

| Pasa esto | Solución |
|---|---|
| No escribe nada | Haz clic en el campo verde; revisa que el celular y el PC estén en la misma red |
| Sale "QR antiguo" en ámbar | Es una etiqueta del formato antiguo con texto: reimprímela en 🏷️ Etiquetas |
| Los códigos del fabricante no se leen | Es un hallazgo conocido: el modelo y el serial se escriben a mano |
