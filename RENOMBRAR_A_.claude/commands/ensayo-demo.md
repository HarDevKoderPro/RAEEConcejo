---
description: Checklist del día anterior a la exposición ante el jurado
---
Prepara y revisa la demo según CLAUDE.md §13 (usa $ARGUMENTS como URL pública si se da; si no, BASE_URL del .env):

1. `/salud` responde y el certificado HTTPS es válido (`curl -sI`).
2. Lista las piezas que conviene usar en la demo en vivo: una "Por probar" que se pueda pasar a "Reutilizada en la sala", un disco sin borrado seguro (para mostrar el bloqueo) y una pieza con foto. Da sus IDs y ubicaciones.
3. Genera la URL de la hoja de etiquetas de esas piezas para imprimirlas.
4. Confirma que existe `docs/GUION_EXPOSICION.md` y que cada paso del guion se puede hacer en la app actual; señala los que no.
5. Recuerda el plan B: `npm start` local con copia de la base, video de 60 s y Excel exportado. Ofrece generar la copia y el Excel.
6. Recuerda: celular con Barcode to PC en la misma red wifi que el PC proyectado; plantilla `[Barcode] → ENTER`.

Entrega el resultado como checklist con ✔ / ✘.
