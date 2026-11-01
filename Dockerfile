# Inventario RAEE · imagen de producción (dos etapas)

# 1) Dependencias: better-sqlite3 se compila si no hay binario precompilado para esta versión de Node.
FROM node:22-bookworm-slim AS dependencias
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Imagen final, sin herramientas de compilación.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PORT=3100 \
    DB_PATH=/app/data/raee.db \
    FOTOS_DIR=/app/data/fotos \
    TZ=America/Bogota

WORKDIR /app

COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json package-lock.json ./

COPY db ./db
COPY src ./src
COPY public ./public
COPY scripts ./scripts

ARG GIT_COMMIT=dev
ENV GIT_COMMIT=$GIT_COMMIT

# La carpeta de datos se monta como volumen; se crea aquí para que el volumen herede el dueño.
RUN mkdir -p /app/data/fotos && chown -R node:node /app/data
USER node

EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3100/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Primera vez: crea la base con los datos de demostración. Después solo arranca.
CMD ["sh", "-c", "[ -f \"$DB_PATH\" ] || node scripts/db-init.js --seed; exec node src/server.js"]
