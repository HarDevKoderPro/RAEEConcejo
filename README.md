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
| `npm run admin:crear` | Crea un usuario editor o admin (pide la contraseña sin mostrarla) |
| `npm test` | Pruebas unitarias y de integración |

Comandos de Claude Code: `/verificar`, `/ensayo-demo`, `/desplegar`.

## En producción

Publicado en **https://raee.smarteksoft.com** (Docker + Caddy en el VPS). Ver
[`deploy/DESPLIEGUE.md`](deploy/DESPLIEGUE.md).

## Pantallas disponibles

| Ruta | Qué muestra |
|---|---|
| `/` | Portada con acceso a la consulta y fichas de ejemplo |
| `/p/RAEE-0010` | Ficha de la pieza: ubicación, estado, destino, datos e historial |
| `/consulta` | Modo kiosco para Barcode to PC: escanear y ver la ficha sin recargar |
| `/buscar` | Búsqueda por texto y filtros (categoría, estado, destino, ubicación); la URL se puede compartir |
| `/ubicaciones` | Mapa de la sala: cada caja o estante con su contenido; `?resaltar=RAEE-0010` ilumina dónde está |
| `/ubicaciones/S1-C2` | Piezas de un lugar |
| `/api/piezas/:id` | Datos de la pieza en JSON (sin notas internas) |
| `/entrar` | Inicio de sesión de editores (5 intentos fallidos cada 15 min) |
| `/registrar` | Alta: escaneando la etiqueta preimpresa o con ID automático |
| `/p/RAEE-0010/editar` | Editar todo y subir foto |
| `/movimiento` | Cambio rápido por escaneo: estado, destino, ubicación y borrado seguro |
| `/api/buscar?q=…` | La misma búsqueda en JSON |
| `/api/escaneo?texto=…` | Interpreta el texto crudo del escáner (lo usa `/consulta`) |
| `/salud` | Estado del servicio |

## Probar el flujo completo

[`docs/RECORRIDO_ESCRITORIO.md`](docs/RECORRIDO_ESCRITORIO.md): escenarios paso a paso con datos reales de la demo.

## Datos incluidos

`db/seed.sql` tiene 36 piezas. `RAEE-0001` es el registro real del Excel; las demás son datos
de demostración (seriales `D-…`) que se eliminarán con `npm run demo:limpiar` antes del uso real.
