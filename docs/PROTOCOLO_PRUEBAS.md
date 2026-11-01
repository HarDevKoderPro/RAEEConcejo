# Protocolo de pruebas con escáner real

Equivale a la hoja "Flujo y prueba" del Excel. Fecha: ____________ · Responsable: ____________

| # | Prueba | ✔ | ✘ | Observaciones |
|---|---|---|---|---|
| 1 | Barcode to PC configurado con `[Barcode] → ENTER` (ver `BARCODE_TO_PC.md`) | ☐ | ☐ | |
| 2 | Un QR del PDF antiguo (lote 1) se lee en `/consulta` | ☐ | ☐ | |
| 3 | Un QR nuevo (con enlace) leído con la **cámara del celular** abre `/p/:id` | ☐ | ☐ | |
| 4 | El mismo QR nuevo leído con Barcode to PC en `/consulta` muestra la ficha | ☐ | ☐ | |
| 5 | Escanear 3 piezas seguidas sin tocar el mouse reemplaza la ficha cada vez | ☐ | ☐ | |
| 6 | Registrar con etiqueta preimpresa | ☐ | ☐ | |
| 7 | Registrar con ID automático e imprimir su etiqueta (🏷️ Etiquetas → Imprimir pendientes) | ☐ | ☐ | |
| 8 | Serial repetido: se rechaza con un mensaje claro | ☐ | ☐ | |
| 9 | Cambiar estado en `/movimiento`: se ve en la ficha y en el historial | ☐ | ☐ | |
| 10 | Reutilizar en `PC-xx`: la ficha muestra 🌱 y el panel suma | ☐ | ☐ | |
| 11 | Disco sin borrado → donación: se bloquea con el aviso. Marcar borrado → se permite | ☐ | ☐ | |
| 12 | ID inexistente: error rojo | ☐ | ☐ | |
| 13 | QR antiguo con texto: aviso ámbar | ☐ | ☐ | |
| 14 | Buscar por componente y por ubicación | ☐ | ☐ | |
| 15 | Exportar a Excel | ☐ | ☐ | |
| 16 | Probar 5 etiquetas de fabricante y anotar el resultado | ☐ | ☐ | Ya se sabe que no se leyeron: queda como hallazgo |
| 17 | Ver todo en un celular con datos móviles (fuera de la red local) | ☐ | ☐ | |
| 18 | Etiqueta pequeña (2 × 1 cm) leída con la cámara a 10 cm | ☐ | ☐ | Si no se lee bien, usar la normal |
| 19 | Con la ficha abierta en un celular, un cambio en `/demo` aparece en menos de 2 s | ☐ | ☐ | |

**Pruebas automáticas:** `npm test` (unitarias e integración, base temporal).
