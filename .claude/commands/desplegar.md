---
description: Actualiza la app en el VPS (https://raee.smarteksoft.com) con la última versión de main
---
Actualiza Inventario RAEE en el VPS siguiendo CLAUDE.md §14 (Docker + Caddy).

1. `npm test` local en verde; si falla, detente.
2. `git status` limpio y `git push origin main` (pregunta antes de hacer push si la persona no lo autorizó en esta sesión).
3. Comprueba el acceso: `SSH_AUTH_SOCK=~/.ssh/claude-agent.sock ssh -o BatchMode=yes deploy@169.58.221.224 true`.
   Si falla, pide a la persona que cargue la llave en Git Bash:
   `rm -f ~/.ssh/claude-agent.sock; eval $(ssh-agent -a ~/.ssh/claude-agent.sock); ssh-add -t 4h ~/.ssh/contabo_deploy`
4. En el VPS: `/opt/apps/raee/scripts/desplegar.sh` (respalda, descarga main, reconstruye y espera /salud).
5. Desde el PC: `curl -s https://raee.smarteksoft.com/salud` y `/p/RAEE-0001` con 200.
6. Comprueba que los otros sitios siguen arriba: `https://smarteksoft.com`, `https://sql.smarteksoft.com`, `https://vps.girabienes.com`.
7. Resume qué commit quedó publicado.

Nunca toques los bloques de otros sitios en `/opt/caddy/Caddyfile` ni sus contenedores.
