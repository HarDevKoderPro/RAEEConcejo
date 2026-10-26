---
description: Despliega o actualiza la app en el VPS (pide confirmación en cada paso que toque el servidor)
---
Despliega Inventario RAEE en el VPS siguiendo CLAUDE.md §14. Destino: $ARGUMENTS (usuario@host). Si falta, pregúntalo.

Primera vez: sigue §14 completo, paso a paso, mostrando cada comando antes de ejecutarlo en el servidor. Nunca sobrescribas configuración de Nginx existente; ejecuta `nginx -t` antes de recargar; no actives ufw sin permitir SSH.

Actualización:
1. `npm test` local en verde; si falla, detente.
2. Respaldo remoto: `scripts/respaldo.sh` en el servidor.
3. `rsync -avz --delete --exclude node_modules --exclude data --exclude .env ./ destino:/opt/raee-web/`
4. En el servidor: `npm ci --omit=dev && pm2 reload raee`.
5. Verifica `curl -s https://<dominio>/salud` y abre `/p/RAEE-0001`.
6. Resume qué versión (commit) quedó publicada.
