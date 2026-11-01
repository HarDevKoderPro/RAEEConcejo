#!/usr/bin/env bash
# Actualiza el Inventario RAEE en el VPS con la última versión de GitHub (rama main).
# Se ejecuta EN el VPS:  /opt/apps/raee/scripts/desplegar.sh
#  1. respaldo de la base (si la app ya corre)
#  2. git pull
#  3. reconstruye y reinicia el contenedor
#  4. espera a que /salud responda
set -euo pipefail

cd "$(dirname "$0")/.."
exec 9>.deploy.lock
flock -n 9 || { echo "Ya hay un despliegue en curso."; exit 1; }

if docker ps --format '{{.Names}}' | grep -qx raee-app-1; then
  echo "== Respaldo previo"
  ./scripts/respaldo.sh
fi

echo "== Código"
git fetch --quiet origin main
git reset --hard --quiet origin/main
export GIT_COMMIT="$(git rev-parse --short HEAD)"
echo "Commit $GIT_COMMIT: $(git log -1 --format=%s)"

echo "== Contenedor"
docker compose up -d --build --remove-orphans
docker image prune -f --filter label=com.docker.compose.project=raee >/dev/null || true

echo "== Verificación"
for i in $(seq 1 30); do
  estado="$(docker inspect -f '{{.State.Health.Status}}' raee-app-1 2>/dev/null || echo desconocido)"
  if [ "$estado" = healthy ]; then
    docker exec raee-app-1 node -e "fetch('http://127.0.0.1:3100/salud').then(r=>r.text()).then(t=>console.log('salud:', t))"
    echo "Despliegue listo ($GIT_COMMIT)."
    exit 0
  fi
  sleep 2
done
echo "La app no quedó sana. Últimos registros:"
docker compose logs --tail 40 app
exit 1
