# Guion de la exposición · unos 8 minutos

**Pantallas:** PC conectado al proyector con **https://raee.smarteksoft.com/demo** (sesión
iniciada). Si hay una segunda pantalla, en ella **/panel?tv=1**.
**Red:** el celular con Barcode to PC y el PC en el router o hotspot propio. Los celulares del jurado
entran por datos móviles.

| Min | Momento | Qué se hace | Qué se dice |
|---|---|---|---|
| 0:00 | **1. Problema** | Fotos de las cajas desordenadas | "Nadie sabía qué había ni dónde estaba." |
| 1:00 | **2. Solución** | Abrir `/proyecto` (diagrama etiqueta → escaneo → base → ficha) | "Cada pieza tiene un nombre, un lugar y un destino." |
| 2:00 | **3a. Escanéala tú mismo** | Un jurado elige una pieza y escanea el QR **con la cámara de su celular** | "Sin instalar nada: aquí está, en la Caja 2, y esta es su historia." |
| 3:00 | **3b. Lo que hago aquí aparece en tu mano** | Con la ficha abierta en el celular del jurado, en `/demo` se escanea la misma pieza → 🌱 **Reutilizada en la sala** → `PC-15` | "Miren su celular." (cambia solo, y el panel sube la cifra con el aviso 🌱) |
| 4:00 | **3c / 5. El sistema protege la información** | En `/demo`: `RAEE-0014` → 🔒 **Donación** | "Un disco no sale sin borrado seguro. La regla está en la base de datos." Marcar **Hecho** → ahora sí se dona |
| 5:00 | **4. Búsqueda** | `/buscar` → "RAM DDR3 funcional" | "¿Tenemos RAM DDR3 que sirva? Sí: cuatro, y aquí están." |
| 5:30 | **6. Impacto y marco legal** | `/panel`: kg **inventariados** vs. kg **con destino final**, pesos **medidos** vs. estimados. Normas en `/proyecto` | "Las cifras son honestas: decimos cuáles son estimadas." |
| 6:30 | **7. Pruebas y hallazgos** | `docs/PROTOCOLO_PRUEBAS.md` | "Los códigos de fábrica no se leyeron; por eso el serial se escribe a mano." |
| 7:00 | **8. Siguientes pasos** | — | Convenio con un gestor RAEE certificado, más salas, reportes por semestre |

## Piezas para la demo (datos de ejemplo)

| Pieza | Para qué |
|---|---|
| `RAEE-0022` · tarjeta madre, Pendiente | Momento 3b: reutilizar en `PC-15` |
| `RAEE-0014` · disco WD, borrado pendiente | Momento 3c: bloqueo de borrado seguro |
| `RAEE-0010` · disco Seagate ya reutilizado | Ficha con historia completa |
| `RAEE-0001` · pieza **real** | Mostrar que hay datos reales (no se modifica) |

Antes de exponer, deja los datos como al principio (ver `docs/GUIA_DE_PRUEBA.md`, final).

## Plan B

1. **Sin internet:** la app corre en el portátil con `npm start` (copia de la base con
   ⚙️ Admin → Descargar respaldo, guardada como `data/raee.db`).
2. **Video** de 60 s de la demo, grabado el día anterior.
3. **Excel** exportado (⚙️ Admin → Exportar inventario a Excel).
