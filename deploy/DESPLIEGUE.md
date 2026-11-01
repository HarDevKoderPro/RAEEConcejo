# Despliegue en el VPS · Inventario RAEE

Publicado en **https://raee.smarteksoft.com** el 1 de noviembre de 2026.

El VPS (Contabo, Ubuntu 24.04) ya alojaba otros sitios con **Docker** y **Caddy**. Por eso la app
no usa Nginx ni PM2: se monta igual que las demás, en su propio contenedor, y Caddy la publica con
HTTPS automático.

```
Celular / PC ──HTTPS──► Caddy (contenedor "caddy", puertos 80/443)
                          │  red Docker "proxy"
                          ▼
                     raee-app-1 :3100  (Node 22 + Express + SQLite)
                          │
                     volumen raee_raee_data  (/app/data: raee.db y fotos)
```

## 1. DNS (Cloudflare)

Registro **A**: nombre `raee` → `169.58.221.224`, **Proxy status: DNS only** (nube gris).
Con la nube naranja, Cloudflare cortaría la actualización en vivo (Server-Sent Events).

Comprobar: `nslookup raee.smarteksoft.com 1.1.1.1` → `169.58.221.224`.

## 2. Código en el servidor

```bash
cd /opt/apps
git clone https://github.com/HarDevKoderPro/RAEEConcejo.git raee
cd raee
umask 077
cat > .env <<ENV
BASE_URL=https://raee.smarteksoft.com
SESSION_SECRET=$(openssl rand -hex 32)
MOSTRAR_AVISO_DEMO=true
ENV
```

El secreto se genera en el servidor y no sale de ahí.

## 3. Contenedor

```bash
./scripts/desplegar.sh
```

El script:
1. hace un respaldo si la app ya corre;
2. descarga `main` de GitHub;
3. ejecuta `docker compose up -d --build`;
4. espera a que el contenedor esté sano y muestra `/salud`.

La primera vez, la imagen crea la base con los datos de demostración (`db/seed.sql`).

`Dockerfile` en dos etapas: la primera compila `better-sqlite3` (python3, make, g++); la final
queda sin herramientas de compilación, corre con el usuario `node` y tiene límite de 256 MB.

## 4. Caddy

```bash
cd /opt/caddy
cp -p Caddyfile Caddyfile.bak-$(date +%Y%m%d-%H%M%S)
{ printf '\n'; grep -v '^#' /opt/apps/raee/deploy/Caddyfile.raee; } >> Caddyfile
docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec caddy caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
```

Se agrega con `>>` para conservar el mismo archivo que Caddy tiene montado. Los bloques de los
otros sitios no se tocan. Caddy obtiene el certificado de Let's Encrypt en segundos y lo renueva
solo.

## 5. Respaldo diario

```bash
crontab -e
0 8 * * * /opt/apps/raee/scripts/respaldo.sh >> $HOME/backups/raee/respaldo.log 2>&1
```

El VPS está en hora de Berlín: las 08:00 de allá son las 02:00 en Colombia. Los respaldos quedan
en `~/backups/raee/raee-AAAA-MM-DD.db` y se conservan 14 días. Restaurar:

```bash
docker compose -f /opt/apps/raee/compose.yml stop app
docker cp ~/backups/raee/raee-AAAA-MM-DD.db raee-app-1:/app/data/raee.db
docker compose -f /opt/apps/raee/compose.yml start app
```

## 6. Verificación (1 nov 2026)

| Prueba | Resultado |
|---|---|
| `https://raee.smarteksoft.com/salud` | `{"ok":true,"piezas":36}` |
| `/`, `/p/RAEE-0001`, `/consulta` | 200 |
| `/p/RAEE-0999` | 404 amable |
| `http://` | redirige a `https://` (308) |
| Certificado | Let's Encrypt, válido hasta 30 ene 2027 |
| Cabeceras | CSP sin `unsafe-inline`, HSTS, nosniff |
| Otros sitios del VPS | siguen respondiendo 200 |
| Respaldo manual | `raee-2026-11-01.db` creado |

Pendiente de la persona: abrir `/p/RAEE-0001` desde un celular con **datos móviles**.

## Actualizaciones

En el PC: `npm test` y `git push`. En el VPS: `/opt/apps/raee/scripts/desplegar.sh`. El comando
`/desplegar` de Claude Code hace las dos cosas.

## Comandos útiles

```bash
docker compose -f /opt/apps/raee/compose.yml logs -f app    # registros en vivo
docker exec -it raee-app-1 npm run admin:crear               # crear usuario (fase 4)
```
