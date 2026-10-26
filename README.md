# Inventario RAEE · versión web

Inventario trazable de residuos electrónicos (RAEE) de la Sala de Sistemas, con etiquetas QR,
ficha pública por celular, búsqueda, historial y panel de impacto en vivo.
Proyecto productivo SENA · Técnico en Sistemas Teleinformáticos.

La guía completa de construcción está en [`CLAUDE.md`](CLAUDE.md).

## Requisitos

- Node.js 22 o superior.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # en Windows: copy .env.example .env
npm run db:seed             # crea data/raee.db con los datos de demostración
npm run dev                 # http://localhost:3100
```

Comprobación rápida: <http://localhost:3100/salud> debe responder `{"ok":true,"piezas":36}`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor con recarga automática en el puerto 3100 |
| `npm start` | Servidor de producción |
| `npm run db:init` | Crea la base vacía desde `db/schema.sql` |
| `npm run db:seed` | Crea la base y carga `db/seed.sql` (usa `-- --force` para rehacerla) |
| `npm test` | Pruebas unitarias y de integración |

Comandos de Claude Code: `/verificar`, `/ensayo-demo`, `/desplegar`.

## Datos incluidos

`db/seed.sql` tiene 36 piezas. `RAEE-0001` es el registro real del Excel; las demás son datos
de demostración (seriales `D-…`) que se eliminarán con `npm run demo:limpiar` antes del uso real.
