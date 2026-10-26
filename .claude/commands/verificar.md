---
description: Ejecuta todas las verificaciones del proyecto y resume qué falla
---
Verifica el estado del proyecto Inventario RAEE siguiendo CLAUDE.md:

1. `npm test` y, si la fase ≥ 8, `npm run test:e2e`.
2. Arranca el servidor en una base temporal sembrada y comprueba con `curl -s`: `/salud`, `/p/RAEE-0001`, `/p/RAEE-0999` (debe dar 404 amable), `/buscar?q=DDR3`, `/panel`, `/api/piezas/RAEE-0010` (sin campo `notas`).
3. Compara las cifras que muestra `/panel` con `SELECT * FROM v_panel`.
4. Revisa que `.env`, `data/` y `*.db` estén en `.gitignore` y que no haya secretos en el repositorio.
5. Indica en qué fase de §11 está el proyecto y qué criterio de aceptación falta.

Responde con una tabla corta: verificación · resultado · qué hacer. No corrijas nada sin preguntar.
