# Inventario RAEE · versión web

Paquete inicial para construir la aplicación con **Claude Code**.

## Cómo empezar

1. Instala Node.js LTS y Claude Code en tu PC.
2. Copia esta carpeta (`raee-web`) a donde vayas a trabajar y abre una terminal dentro de ella.
3. Ejecuta `git init` y luego `claude`.
4. Escribe: **"Lee CLAUDE.md y ejecuta la Fase 0"**. Revisa el resultado y continúa fase por fase.
5. Para publicar en tu VPS: `/desplegar usuario@ip-del-vps`.

Comandos del proyecto: `/verificar`, `/ensayo-demo`, `/desplegar`.

## Datos incluidos

`db/seed.sql` tiene 36 piezas. RAEE-0001 es el registro real del Excel; las demás son datos
de demostración (seriales `D-…`) que se eliminan con `npm run demo:limpiar`.
